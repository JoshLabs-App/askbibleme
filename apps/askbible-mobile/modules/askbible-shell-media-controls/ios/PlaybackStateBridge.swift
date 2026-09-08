import Foundation

/**
 把三条流的状态推给 JS（iOS）。Android 侧 `PlaybackStateBridge.kt` 的对照实现，
 事件名与载荷形状必须一致。

 **JS 从此不再自己记「现在在播什么」**，只订阅这里推来的事实。

 旧代码里 JS 维护着 `playing` / `playbackMode` 两个共用状态，三路都读它，于是同一个按钮的
 图标和点击处理可能得出不同答案——2026-09-08 实测「播着音乐点读经没反应」就是这么来的。
 */
enum PlaybackStateBridge {
  static let eventName = "ShellPlaybackState"

  /// 序列化成 JS 载荷。`playing` 是「此刻真的该出声」，已把用户暂停与系统打断算进去。
  static func serialize(_ state: PlaybackState) -> [String: Any] {
    let audible = state.audibleStreams
    var out: [String: Any] = [:]
    for id in StreamId.allCases {
      out[id.rawValue] = streamPayload(state[id], playing: audible.contains(id))
    }
    out["systemInterrupted"] = state.systemInterrupted
    out["nowPlayingStream"] = nowPlaying(state)?.stream.rawValue as Any
    return out
  }

  private static func streamPayload(_ stream: StreamState, playing: Bool) -> [String: Any] {
    [
      "playing": playing,
      "wantPlaying": stream.wantPlaying,
      "userPaused": stream.userPaused,
      "uri": stream.uri as Any,
      "positionSec": stream.positionSec,
      "durationSec": stream.durationSec,
      "queueLength": stream.queue.count,
      "title": stream.title,
      "artist": stream.artist,
      "album": stream.album,
    ]
  }
}
