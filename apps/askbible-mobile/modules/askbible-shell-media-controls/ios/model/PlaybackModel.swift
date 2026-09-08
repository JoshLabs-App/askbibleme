import Foundation

/**
 播放状态机（纯 Swift，不 import AVFoundation / UIKit，以便直接跑 `swift test`）。

 这是 Android 侧 `me.askbible.playback.model.PlaybackModel` 的对照实现，**行为必须一致**：
 两边的测试用例是同一组，改了一边就要同步另一边，否则两个平台会慢慢长歪。

 ## 为什么推倒重来

 旧的 `AskBibleMusicService` 是一个 1956 行的类，`userPaused` / `wantPlaying` /
 `contentKind` 等标志由音乐、读经、金句三路共用，再加一套 `verse*` 影子字段。
 Android 侧同构的写法在 2026-09-07~08 那一晚被证明会持续产出同一类 bug：
 关掉一路会把另一路连坐停掉、点播一路会把另一路打回开头、两个播放器隔着标志互抢焦点。
 结论不是再补条件，而是三路根本不该共用状态。
 */

/// 三路互不相干的音频。
public enum StreamId: String, CaseIterable, Sendable {
  /// 背景音乐。
  case music
  /// 读经朗读（整章）。
  case scripture
  /// 首页金句轮播。
  case verse
}

/**
 谁与谁不能同时响。

 音乐是背景，金句是叠在背景上的短句，两者可以同时；读经是长篇朗读，与音乐、与金句都互斥
 （两段人声叠在一起听不清）。改互斥关系只改这张表。**必须与 Android 的 EXCLUSIVE_WITH 一致。**
 */
private let exclusiveWith: [StreamId: Set<StreamId>] = [
  .music: [.scripture],
  .scripture: [.music, .verse],
  .verse: [.scripture],
]

/// 一路音频的全部状态。除了 `PlaybackState` 里的系统级字段，没有任何跨路共享。
public struct StreamState: Equatable, Sendable {
  /// 用户/JS 表达的意图：这一路应该在响。真的有没有出声由播放器回报。
  public var wantPlaying: Bool = false
  /// 当前音轨。
  public var uri: String?
  /// 待播队列；进入后台时原生靠它自己接下一条，不依赖 JS 醒着。
  public var queue: [String] = []
  /// 两条之间的静默间隔（金句轮播用）。
  public var gapSec: Double = 0
  public var positionSec: Double = 0
  /// 用户显式按了**这一路**的暂停。不是全局的。
  public var userPaused: Bool = false
  public var title: String = ""
  public var artist: String = ""
  public var album: String = ""
  public var artworkUri: String?
  public var durationSec: Double = 0

  public init() {}

  /// 这一路此刻是否应该出声。
  public var shouldPlay: Bool { wantPlaying && !userPaused && uri != nil }
}

/// 整个播放子系统的状态。
public struct PlaybackState: Equatable, Sendable {
  public var music = StreamState()
  public var scripture = StreamState()
  public var verse = StreamState()
  /// 来电 / 系统打断：全部停播，但不算用户暂停，结束后应能恢复。
  public var systemInterrupted = false
  /// 上一次锁屏/控制中心暂停键停掉的几路；播放键要恢复的正是这几路。
  public var transportPaused: Set<StreamId> = []

  public init() {}

  public subscript(id: StreamId) -> StreamState {
    get {
      switch id {
      case .music: return music
      case .scripture: return scripture
      case .verse: return verse
      }
    }
    set {
      switch id {
      case .music: music = newValue
      case .scripture: scripture = newValue
      case .verse: verse = newValue
      }
    }
  }

  /// 此刻真正该出声的几路。系统打断时一路都不响。
  public var audibleStreams: Set<StreamId> {
    if systemInterrupted { return [] }
    return Set(StreamId.allCases.filter { self[$0].shouldPlay })
  }
}

/// 状态机的输入。JS、锁屏控制、播放器回报都走这里，没有别的入口。
public enum Intent: Equatable, Sendable {
  /// 用户点播某一路（换轨或从头开始）。
  case play(
    stream: StreamId,
    uri: String,
    queue: [String] = [],
    gapSec: Double = 0,
    title: String = "",
    artist: String = "",
    album: String = "",
    artworkUri: String? = nil,
    positionSec: Double = 0
  )
  /// 用户暂停某一路。只影响这一路。
  case pause(StreamId)
  /// 用户从暂停中续播某一路。
  case resume(StreamId)
  /// 彻底停掉某一路并清空它的队列。
  case stop(StreamId)
  /// 补充/替换待播队列。
  case setQueue(StreamId, [String])
  /// 播放器自己接上了下一条，回报事实——**它就是唯一真相**，JS 只能听。
  case nativeAdvanced(StreamId, String)
  /// 播放器回报进度。
  case progress(StreamId, positionSec: Double, durationSec: Double)
  /// 某一路自然播完且队列空了。
  case ended(StreamId)
  /// 来电 / 系统打断开始或结束。
  case systemInterrupt(Bool)
  /// 锁屏或控制中心的暂停键。
  case pauseAll
  /// 锁屏或控制中心的播放键：恢复上一次 `pauseAll` 停掉的那几路。
  case resumeTransport
  /// 睡眠定时器到点。
  case sleepTimerFired
}

/**
 状态转移。纯函数，无副作用。

 调用方拿前后状态做差，决定去启动或停止哪个播放器——播放器不再自己猜「现在轮不轮到我」。
 */
public func reduce(_ state: PlaybackState, _ intent: Intent) -> PlaybackState {
  var out = state
  switch intent {
  case let .play(stream, uri, queue, gapSec, title, artist, album, artworkUri, positionSec):
    var next = state[stream]
    next.wantPlaying = true
    next.userPaused = false
    next.uri = uri
    next.queue = queue
    next.gapSec = gapSec
    next.positionSec = positionSec
    next.title = title
    next.artist = artist
    next.album = album
    next.artworkUri = artworkUri
    out[stream] = next
    // 开一路就让与它互斥的几路让位——集中在这里，播放器不必各自判断。
    for other in exclusiveWith[stream] ?? [] {
      out[other].wantPlaying = false
    }

  case let .pause(stream):
    out[stream].userPaused = true

  case let .resume(stream):
    // 与它互斥的一路正在响时，续播不生效——最近一次明确的 play 优先。
    let blocked = (exclusiveWith[stream] ?? []).contains { state.audibleStreams.contains($0) }
    if !blocked {
      out[stream].userPaused = false
      out[stream].wantPlaying = true
    }

  case let .stop(stream):
    out[stream] = StreamState()

  case let .setQueue(stream, queue):
    out[stream].queue = queue

  case let .nativeAdvanced(stream, uri):
    out[stream].uri = uri
    out[stream].queue = Array(state[stream].queue.dropFirst())
    out[stream].positionSec = 0

  case let .progress(stream, positionSec, durationSec):
    out[stream].positionSec = positionSec
    out[stream].durationSec = durationSec

  case let .ended(stream):
    out[stream].wantPlaying = false
    out[stream].uri = nil

  case let .systemInterrupt(active):
    out.systemInterrupted = active

  case .pauseAll:
    let paused = state.audibleStreams
    out.transportPaused = paused
    for id in paused { out[id].userPaused = true }

  case .resumeTransport:
    for id in state.transportPaused {
      out = reduce(out, .resume(id))
    }
    out.transportPaused = []

  case .sleepTimerFired:
    for id in StreamId.allCases {
      out[id].wantPlaying = false
      out[id].userPaused = true
    }
  }
  return out
}

/// 锁屏 / 控制中心要显示的那一路。
public struct NowPlaying: Equatable, Sendable {
  public let stream: StreamId
  public let title: String
  public let artist: String
  public let album: String
  public let artworkUri: String?
  public let positionSec: Double
  public let durationSec: Double
  public let playing: Bool
}

/**
 谁占锁屏。

 读经 > 音乐 > 金句：金句是叠在音乐上的短句，抢标题会让锁屏每十几秒跳一次。
 都没在响时，显示最后一个还留着音轨的，好让锁屏上仍有可续播的对象。
 */
public func nowPlaying(_ state: PlaybackState) -> NowPlaying? {
  let order: [StreamId] = [.scripture, .music, .verse]
  let audible = state.audibleStreams
  guard let pick = order.first(where: { audible.contains($0) })
    ?? order.first(where: { state[$0].uri != nil })
  else { return nil }
  let s = state[pick]
  return NowPlaying(
    stream: pick,
    title: s.title,
    artist: s.artist,
    album: s.album,
    artworkUri: s.artworkUri,
    positionSec: s.positionSec,
    durationSec: s.durationSec,
    playing: audible.contains(pick)
  )
}
