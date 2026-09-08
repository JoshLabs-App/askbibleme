import AVFoundation
import CallKit
import ExpoModulesCore
import Foundation
import MediaPlayer
import os

/**
 JS 与原生播放之间的桥（iOS）。

 只做三件事：把 JS 载荷翻成意图、把原生事件回传 JS、处理系统打断。
 **播放决策一概不在这里**——那在 `PlaybackEngine`，状态在 `PlaybackStore`，
 语义在 `model/`（纯 Swift，有单测，与 Android 同一组用例）。

 旧版本是 1117 行，带 `sharedUserPaused` / `sharedLastPayload` / `sharedLastMusicPayload`
 等静态量，再通过 NotificationCenter 与另一个 1956 行的 `AskBibleMusicService` 互相喊话。
 两边各存一份「现在在播什么」，谁都可能被对方覆盖——2026-09-07~08 在 Android 上定位到的
 六个 bug 全是这个结构的产物，iOS 只是还没被逐一撞上。
 */
public final class AskbibleShellMediaControlsModule: Module {

  private let log = Logger(subsystem: "me.askbible", category: "playback.bridge")

  private var interruptionObserver: NSObjectProtocol?
  private let callObserver = CXCallObserver()
  private var sleepTimer: DispatchWorkItem?
  private var wired = false

  public func definition() -> ModuleDefinition {
    Name("AskBibleShellMediaControls")

    Events(
      "RemotePlay",
      "RemotePause",
      "RemoteToggle",
      "RemoteNext",
      "RemotePrevious",
      "AudioSessionInterruptionBegan",
      "AudioSessionInterruptionEnded",
      "ShellMediaPlaybackPulse",
      "ShellMediaNativeTakeover",
      "ShellMediaNativeRelease",
      "ShellMediaNativeStopped",
      "ShellMediaNativeProgress",
      "ShellMediaNativeMusicEnded",
      "ShellMediaNativeVerseAdvance",
      "ShellMediaNativeVerseRestart",
      "ShellMediaNativeScriptureEnded",
      "ShellMediaSleepTimerFired",
      // 三条流的完整状态；JS 订阅它，不再自己维护影子状态。
      "ShellPlaybackState"
    )

    OnCreate {
      DispatchQueue.main.async { self.wireUp() }
    }

    OnDestroy {
      if let interruptionObserver {
        NotificationCenter.default.removeObserver(interruptionObserver)
      }
      sleepTimer?.cancel()
    }

    /// JS 每次同步。解析 JSON、翻成意图，语义判断全在 `intentsFor`（纯函数，有单测）。
    Function("updateSession") { (json: String) in
      DispatchQueue.main.async {
        guard let payload = Self.parse(json) else { return }
        if payload.userPlay {
          /*
           账本上三条来源（用户点击 / 章末续播 / JS 兜底）本来长得一模一样，
           「JS 为什么突然播了下一章」只能靠临时日志一轮轮试。来源只打日志，不参与判断。
           */
          let origin = Self.parseOrigin(json) ?? "?"
          self.log.info(
            "js userPlay \(payload.kind, privacy: .public) origin=\(origin, privacy: .public)")
        }
        for intent in intentsFor(payload, PlaybackStore.shared.state) {
          PlaybackStore.shared.dispatch(intent)
        }
      }
    }

    /**
     JS 的 `clearSession`。

     只有用户显式解散才真停。旧实现在这里做了一大段「拒绝清除并尝试恢复上一首音乐」的补偿，
     那是因为 JS 有时会送来空载荷；现在保活同步碰不到播放状态，不需要那套补偿。
     */
    Function("clearSession") { (reason: String?) in
      let why = reason ?? "unspecified"
      DispatchQueue.main.async {
        guard why == "user-dismissed" || why == "user-dismiss" else {
          self.log.info("ignore clearSession reason=\(why, privacy: .public)")
          return
        }
        for id in StreamId.allCases { PlaybackStore.shared.dispatch(.stop(id)) }
      }
    }

    /// **只停音乐。** 名字一直是 pause app music，旧实现却停了全部——
    /// 在 Android 上这正是「关掉音乐，正在响的金句也没声了」的根因。
    Function("pauseAppMusic") {
      DispatchQueue.main.async { PlaybackStore.shared.dispatch(.pause(.music)) }
    }

    /// 与 pauseAppMusic 对称：只恢复音乐。
    Function("resumeAppMusic") {
      DispatchQueue.main.async { PlaybackStore.shared.dispatch(.resume(.music)) }
    }

    Function("seekTo") { (positionSec: Double) in
      DispatchQueue.main.async {
        guard let np = nowPlaying(PlaybackStore.shared.state) else { return }
        PlaybackEngine.shared.player(for: np.stream)?.seek(to: positionSec)
      }
    }

    /// 语速只对读经有意义。
    Function("setPlaybackRate") { (rate: Double) in
      DispatchQueue.main.async {
        PlaybackEngine.shared.player(for: .scripture)?.setRate(rate)
      }
    }

    Function("setMusicVolume") { (volume: Double) in
      DispatchQueue.main.async {
        PlaybackEngine.shared.player(for: .music)?.setVolume(Float(volume))
      }
    }

    /// 墙钟截止，一次性到期，不依赖 JS 循环。
    Function("setSleepTimerDeadlineMs") { (deadlineMs: Double) in
      DispatchQueue.main.async { self.armSleepTimer(deadlineMs: deadlineMs) }
    }
  }

  // MARK: - 接线

  private func wireUp() {
    guard !wired else { return }
    wired = true

    PlaybackEngine.shared.emit = { [weak self] name, body in
      self?.sendEvent(name, body)
    }
    PlaybackEngine.shared.start()
    PlaybackStore.shared.subscribe { [weak self] _, next in
      self?.sendEvent(PlaybackStateBridge.eventName, PlaybackStateBridge.serialize(next))
    }
    sendEvent(PlaybackStateBridge.eventName, PlaybackStateBridge.serialize(PlaybackStore.shared.state))
    /// 下一首 / 上一首交回 JS：它才知道曲库与今日计划。
    PlaybackEngine.shared.bindTransportSkip(
      next: { [weak self] in self?.sendEvent("RemoteNext", [:]) },
      previous: { [weak self] in self?.sendEvent("RemotePrevious", [:]) }
    )
    observeInterruptions()
  }

  /**
   系统打断（来电、闹钟、其它 App 抢占）。

   打断不是用户暂停：`.systemInterrupt(true)` 会让全部静音但不置各路的 userPaused，
   结束后 `.systemInterrupt(false)` 原样恢复。旧实现把两者混在同一批标志里，
   来电结束后常有一路回不来。
   */
  private func observeInterruptions() {
    interruptionObserver = NotificationCenter.default.addObserver(
      forName: AVAudioSession.interruptionNotification,
      object: nil,
      queue: .main
    ) { [weak self] notification in
      guard let self,
        let raw = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
        let type = AVAudioSession.InterruptionType(rawValue: raw)
      else { return }

      switch type {
      case .began:
        PlaybackStore.shared.dispatch(.systemInterrupt(true))
        self.sendEvent("AudioSessionInterruptionBegan", [:])
      case .ended:
        /// 通话仍在进行时不要抢回来，否则会和通话音频打架。
        let onCall = !self.callObserver.calls.filter { !$0.hasEnded }.isEmpty
        if !onCall {
          PlaybackStore.shared.dispatch(.systemInterrupt(false))
        }
        self.sendEvent("AudioSessionInterruptionEnded", [:])
      @unknown default:
        break
      }
    }
  }

  private func armSleepTimer(deadlineMs: Double) {
    sleepTimer?.cancel()
    sleepTimer = nil
    guard deadlineMs > 0 else { return }
    let delay = max(0, deadlineMs / 1000 - Date().timeIntervalSince1970)
    let work = DispatchWorkItem { [weak self] in
      PlaybackStore.shared.dispatch(.sleepTimerFired)
      self?.sendEvent("ShellMediaSleepTimerFired", [:])
      self?.sleepTimer = nil
    }
    sleepTimer = work
    DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: work)
  }

  // MARK: - 载荷解析

  /// 只给账本用的来源字段；不进 `JsPayload`，状态机不该知道谁调用了它。
  private static func parseOrigin(_ json: String) -> String? {
    guard let data = json.data(using: .utf8),
      let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let raw = object["origin"] as? String
    else { return nil }
    let trimmed = raw.trimmingCharacters(in: .whitespaces)
    return trimmed.isEmpty ? nil : trimmed
  }

  private static func parse(_ json: String) -> JsPayload? {
    guard let data = json.data(using: .utf8),
      let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return nil }

    func string(_ key: String) -> String? {
      guard let raw = object[key] as? String else { return nil }
      let trimmed = raw.trimmingCharacters(in: .whitespaces)
      return (trimmed.isEmpty || trimmed == "null" || trimmed == "undefined") ? nil : trimmed
    }
    func double(_ key: String) -> Double { (object[key] as? NSNumber)?.doubleValue ?? 0 }
    func bool(_ key: String) -> Bool { (object[key] as? NSNumber)?.boolValue ?? false }

    var next: [String] = []
    func appendNext(_ value: String?) {
      guard let value, !value.isEmpty, !next.contains(value) else { return }
      next.append(value)
    }
    appendNext(string("nextAssetUri"))
    appendNext(string("nextNextAssetUri"))
    for value in (object["nextAssetUris"] as? [String]) ?? [] {
      appendNext(value.trimmingCharacters(in: .whitespaces))
    }

    return JsPayload(
      kind: (object["kind"] as? String) ?? "",
      playing: bool("playing"),
      userPlay: bool("userPlay"),
      userPause: bool("userPause"),
      assetUri: string("assetUri"),
      nextUris: next,
      gapSec: double("gapSec"),
      title: (object["title"] as? String) ?? "",
      artist: (object["artist"] as? String) ?? "",
      album: (object["album"] as? String) ?? "",
      artworkUri: string("artworkUri"),
      positionSec: double("positionSec"),
      durationSec: double("durationSec")
    )
  }
}
