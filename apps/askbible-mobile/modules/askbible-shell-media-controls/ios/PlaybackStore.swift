import Foundation
import os

/**
 播放状态的唯一持有者（iOS）。Android 侧 `model/PlaybackStore.kt` 的对照实现。

 所有改动都必须经过 `dispatch`——没有第二个入口。旧的 `AskBibleMusicService` 有几十个
 实例变量，加上模块里的 `sharedUserPaused` / `sharedLastPayload` 等静态量，两边还靠
 NotificationCenter 互相喊话，「谁改了状态」无从追溯。

 线程：全部在主线程上跑（AVPlayer 与 MPNowPlayingInfoCenter 都要求），因此不必加锁；
 非主线程调用会被转到主线程。
 */
final class PlaybackStore {
  static let shared = PlaybackStore()

  private let log = Logger(subsystem: "me.askbible", category: "playback")

  private(set) var state = PlaybackState()

  private var listeners: [UUID: (PlaybackState, PlaybackState) -> Void] = [:]

  private init() {}

  @discardableResult
  func subscribe(_ listener: @escaping (_ previous: PlaybackState, _ next: PlaybackState) -> Void)
    -> UUID
  {
    let id = UUID()
    listeners[id] = listener
    return id
  }

  func unsubscribe(_ id: UUID) {
    listeners.removeValue(forKey: id)
  }

  func dispatch(_ intent: Intent) {
    guard Thread.isMainThread else {
      DispatchQueue.main.async { [weak self] in self?.dispatch(intent) }
      return
    }
    let previous = state
    let next = reduce(previous, intent)
    guard next != previous else { return }
    state = next

    // 每条意图都留痕。Android 上正是这一行让「关音乐为什么会停金句」一眼可见。
    if case .progress = intent {} else {
      log.info("\(describe(intent), privacy: .public) -> audible=\(next.audibleStreams.map(\.rawValue).sorted().joined(separator: ","), privacy: .public)")
    }

    for listener in listeners.values {
      listener(previous, next)
    }
  }

  /// 仅供测试与冷启动重置。
  func resetForTesting() {
    state = PlaybackState()
  }
}

private func describe(_ intent: Intent) -> String {
  switch intent {
  case let .play(stream, uri, queue, _, _, _, _, _, _):
    return "play \(stream.rawValue) \(uri.suffix(28)) q=\(queue.count)"
  case let .pause(s): return "pause \(s.rawValue)"
  case let .resume(s): return "resume \(s.rawValue)"
  case let .stop(s): return "stop \(s.rawValue)"
  case let .setQueue(s, q): return "setQueue \(s.rawValue) q=\(q.count)"
  case let .nativeAdvanced(s, uri): return "nativeAdvanced \(s.rawValue) \(uri.suffix(28))"
  case .progress: return "progress"
  case let .ended(s): return "ended \(s.rawValue)"
  case let .systemInterrupt(active): return "systemInterrupt \(active)"
  case .pauseAll: return "pauseAll"
  case .resumeTransport: return "resumeTransport"
  case .sleepTimerFired: return "sleepTimerFired"
  }
}
