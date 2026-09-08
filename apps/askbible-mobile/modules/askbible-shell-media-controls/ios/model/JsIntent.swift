import Foundation

/**
 JS 载荷 → `Intent` 的翻译。Android 侧 `model/JsIntent.kt` 的对照实现，规则必须一致。

 JS 目前仍按老样子发一坨「当前会话状态」（kind / playing / userPlay / userPause /
 assetUri / next…），这里把它翻成对**某一路**的意图。等 JS 侧改成直接发意图即可删掉。
 */
public struct JsPayload: Equatable, Sendable {
  public var kind: String
  public var playing: Bool
  public var userPlay: Bool
  public var userPause: Bool
  public var assetUri: String?
  public var nextUris: [String]
  public var gapSec: Double
  public var title: String
  public var artist: String
  public var album: String
  public var artworkUri: String?
  public var positionSec: Double
  public var durationSec: Double

  public init(
    kind: String,
    playing: Bool,
    userPlay: Bool = false,
    userPause: Bool = false,
    assetUri: String? = nil,
    nextUris: [String] = [],
    gapSec: Double = 0,
    title: String = "",
    artist: String = "",
    album: String = "",
    artworkUri: String? = nil,
    positionSec: Double = 0,
    durationSec: Double = 0
  ) {
    self.kind = kind
    self.playing = playing
    self.userPlay = userPlay
    self.userPause = userPause
    self.assetUri = assetUri
    self.nextUris = nextUris
    self.gapSec = gapSec
    self.title = title
    self.artist = artist
    self.album = album
    self.artworkUri = artworkUri
    self.positionSec = positionSec
    self.durationSec = durationSec
  }
}

/// JS 的 kind 字符串 → 流。认不出的（旧的环境音等）返回 nil，直接忽略。
public func streamOf(_ kind: String) -> StreamId? {
  StreamId(rawValue: kind.trimmingCharacters(in: .whitespaces).lowercased())
}

/**
 把一次 JS 同步翻成零或多条意图。

 - `userPlay` → `.play`。这是唯一会换轨、会清暂停标记的输入。
 - `userPause` → `.pause`，**只针对它自己那一路**。
 - 其余是 JS 每秒一次的保活同步：只允许补充队列与元数据，**不允许改变谁在播**。
   保活的答案比原生慢一拍，让它换轨就会把刚起头的音轨顶掉。
 */
public func intentsFor(_ payload: JsPayload, _ state: PlaybackState) -> [Intent] {
  guard let stream = streamOf(payload.kind) else { return [] }
  let trimmed = payload.assetUri?.trimmingCharacters(in: .whitespaces)
  let uri = (trimmed?.isEmpty == false && trimmed != "null" && trimmed != "undefined") ? trimmed : nil

  if payload.userPlay {
    guard let uri else { return [] }
    return [
      .play(
        stream: stream,
        uri: uri,
        queue: payload.nextUris.map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty },
        gapSec: payload.gapSec,
        title: payload.title,
        artist: payload.artist,
        album: payload.album,
        artworkUri: payload.artworkUri,
        positionSec: payload.positionSec
      )
    ]
  }

  if payload.userPause { return [.pause(stream)] }

  var out: [Intent] = []
  let queue = payload.nextUris.map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
  if !queue.isEmpty && queue != state[stream].queue {
    out.append(.setQueue(stream, queue))
  }
  if payload.durationSec > 0 && payload.durationSec != state[stream].durationSec {
    out.append(.progress(stream, positionSec: state[stream].positionSec, durationSec: payload.durationSec))
  }
  return out
}
