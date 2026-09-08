import AVFoundation
import Foundation
import os

/**
 一条流的播放器（iOS）。三路各持一个实例，**互相不知道对方存在**。

 Android 侧 `StreamPlayer.kt` 的对照实现。职责同样收窄成一句话：
 **把这一条流放成 `PlaybackStore` 说的样子**，别的一概不管。

 保留了旧 `AskBibleMusicService` 里用真机换来的几处细节：
 - 远端 URI 带 User-Agent：R2 对空 UA 的请求偶发直接断连。
 - 起播失败要退避，不能立刻重试。
 - 队列自接必须由原生做：App 进后台后 JS 会被挂起，靠它补队列金句会哑掉。
 */
final class StreamPlayer {
  private let streamId: StreamId
  private let log: Logger

  private var player: AVPlayer?
  private var currentUri: String?
  private var endObserver: NSObjectProtocol?
  private var statusObservation: NSKeyValueObservation?
  private var progressObserver: Any?
  private var gapWorkItem: DispatchWorkItem?

  private var lastFailedUri: String?
  private var lastFailedAt: TimeInterval = 0
  private static let failBackoff: TimeInterval = 2.5

  /// 上报给 JS 的事件；由模块注入，避免播放器直接依赖 Expo。
  var emit: ((String, [String: Any]) -> Void)?

  init(streamId: StreamId) {
    self.streamId = streamId
    self.log = Logger(subsystem: "me.askbible", category: "playback.\(streamId.rawValue)")
  }

  // MARK: - 对外

  /// 让这条流播 `uri`。已经在播同一条就只恢复，不重建。
  func play(uri: String, positionSec: Double) {
    if uri == currentUri, let player {
      player.play()
      return
    }
    if uri == lastFailedUri, Date().timeIntervalSince1970 - lastFailedAt < Self.failBackoff {
      return
    }
    start(uri: uri, positionSec: positionSec)
  }

  func pause() {
    cancelGap()
    player?.pause()
  }

  func stop() {
    cancelGap()
    if currentUri != nil { emitEvent("ShellMediaNativeStopped") }
    teardown()
    currentUri = nil
  }

  func seek(to positionSec: Double) {
    player?.seek(to: CMTime(seconds: max(0, positionSec), preferredTimescale: 600))
  }

  func setVolume(_ volume: Float) {
    player?.volume = min(1, max(0, volume))
  }

  func setRate(_ rate: Double) {
    guard let player, player.timeControlStatus == .playing else { return }
    player.rate = Float(min(2, max(0.5, rate)))
  }

  var positionSec: Double {
    guard let t = player?.currentTime().seconds, t.isFinite else { return 0 }
    return t
  }

  var durationSec: Double {
    guard let d = player?.currentItem?.duration.seconds, d.isFinite, d > 0 else { return 0 }
    return d
  }

  var isPlayingNow: Bool { player?.timeControlStatus == .playing }

  // MARK: - 内部

  private func start(uri: String, positionSec: Double) {
    cancelGap()
    teardown()
    currentUri = uri

    guard let item = makeItem(uri: uri) else {
      markFailed(uri)
      return
    }
    let avPlayer = AVPlayer(playerItem: item)
    avPlayer.automaticallyWaitsToMinimizeStalling = false
    player = avPlayer

    endObserver = NotificationCenter.default.addObserver(
      forName: .AVPlayerItemDidPlayToEndTime,
      object: item,
      queue: .main
    ) { [weak self] _ in
      self?.onCompleted()
    }

    statusObservation = item.observe(\.status, options: [.new]) { [weak self] observed, _ in
      guard let self else { return }
      switch observed.status {
      case .failed:
        self.log.warning("item failed \(uri.suffix(48), privacy: .public)")
        self.markFailed(uri)
      case .readyToPlay:
        if positionSec > 0.05 {
          avPlayer.seek(to: CMTime(seconds: positionSec, preferredTimescale: 600))
        }
        avPlayer.play()
        self.log.info("playing \(uri.suffix(48), privacy: .public)")
        self.emitEvent("ShellMediaNativeTakeover")
      default:
        break
      }
    }

    /// 每秒把进度写回状态并上报 JS。
    progressObserver = avPlayer.addPeriodicTimeObserver(
      forInterval: CMTime(seconds: 1, preferredTimescale: 1),
      queue: .main
    ) { [weak self] _ in
      guard let self, self.isPlayingNow else { return }
      PlaybackStore.shared.dispatch(
        .progress(self.streamId, positionSec: self.positionSec, durationSec: self.durationSec)
      )
      self.emitEvent("ShellMediaNativeProgress")
    }
  }

  private func makeItem(uri: String) -> AVPlayerItem? {
    if uri.hasPrefix("http://") || uri.hasPrefix("https://") {
      guard let url = URL(string: uri) else { return nil }
      /// R2 对空 User-Agent 的请求偶发直接断连，必须带上。
      let asset = AVURLAsset(
        url: url,
        options: [
          "AVURLAssetHTTPHeaderFieldsKey": [
            "User-Agent": "AskBible.me/1.0 (iOS AVPlayer)",
            "Accept": "*/*",
          ]
        ]
      )
      return AVPlayerItem(asset: asset)
    }
    let url = uri.hasPrefix("file://") ? URL(string: uri) : URL(fileURLWithPath: uri)
    guard let url else { return nil }
    return AVPlayerItem(url: url)
  }

  private func markFailed(_ uri: String) {
    lastFailedUri = uri
    lastFailedAt = Date().timeIntervalSince1970
    teardown()
    /// 失败也要往下走，否则金句会卡在坏的一条上再不前进。
    scheduleNext(gapSec: 0)
  }

  private func onCompleted() {
    scheduleNext(gapSec: PlaybackStore.shared.state[streamId].gapSec)
  }

  /**
   只在「播完且队列里没有下一条」时通知 JS。

   队列里还有就自己接上，JS 从状态里看到 uri 变了即可跟随。一度是每次播完都发，
   而 JS 靠事件里的 `nativeChained` 标志判断原生有没有接上；新播放器没带这个标志，
   JS 就以为没接，自己又推进了一章，把原生刚接上的那章重新点播一次（Android 上实测到）。
   事件名不变，JS 侧既有处理继续有效。
   */
  private func emitEndedNeedingJs() {
    /*
     账本上必须看得见这一步。`.ended` 在状态没变时会被 store 静默丢掉（不打日志），
     于是「原生播完了、把接力交回 JS」在账本上毫无痕迹，只剩后面 JS 发来的一条 play——
     看上去就像 JS 无缘无故抢播（2026-09-08 模拟器实测就卡在这里）。
     */
    log.info("endedNeedingJs \(self.streamId.rawValue, privacy: .public)")
    switch streamId {
    case .scripture: emitEvent("ShellMediaNativeScriptureEnded")
    case .music: emitEvent("ShellMediaNativeMusicEnded")
    case .verse: emitEvent("ShellMediaNativeVerseAdvance")
    }
  }

  /**
   接下一条。

   队列取自 `PlaybackStore`，取到就用 `.nativeAdvanced` 回报——**原生是唯一真相**，JS 只能听。
   */
  private func scheduleNext(gapSec: Double) {
    guard let next = PlaybackStore.shared.state[streamId].queue.first, !next.isEmpty else {
      PlaybackStore.shared.dispatch(.ended(streamId))
      emitEndedNeedingJs()
      return
    }
    let delay = min(15, max(0, gapSec))
    let work = DispatchWorkItem { [weak self] in
      guard let self else { return }
      self.gapWorkItem = nil
      PlaybackStore.shared.dispatch(.nativeAdvanced(self.streamId, next))
    }
    gapWorkItem = work
    DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: work)
  }

  private func cancelGap() {
    gapWorkItem?.cancel()
    gapWorkItem = nil
  }

  private func teardown() {
    if let progressObserver { player?.removeTimeObserver(progressObserver) }
    progressObserver = nil
    statusObservation?.invalidate()
    statusObservation = nil
    if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
    endObserver = nil
    player?.pause()
    player = nil
  }

  private func emitEvent(_ name: String) {
    emit?(
      name,
      [
        "kind": streamId.rawValue,
        "assetUri": currentUri ?? "",
        "positionSec": positionSec,
        "durationSec": durationSec,
      ]
    )
  }
}
