import AVFoundation
import Foundation
import MediaPlayer
import os

/**
 把 `PlaybackStore` 的状态落到三个 `StreamPlayer` 上，并维护锁屏信息（iOS）。

 Android 侧 `PlaybackEngine.kt` 的对照实现。**这是全 App 唯一决定「谁该响」的地方。**
 旧实现里这个决定散在 `AskBibleMusicService` 的几十个实例变量和模块的静态量之间，
 两边还靠 NotificationCenter 互喊，不一致就出 bug。

 音频会话：三路共用一个 `AVAudioSession`，只在「从没有声音变成有声音」时激活，
 全部停下后再停用——不必每路各自 setActive，那正是旧实现里互相打断的来源。
 */
final class PlaybackEngine {
  static let shared = PlaybackEngine()

  private let log = Logger(subsystem: "me.askbible", category: "playback.engine")

  private let players: [StreamId: StreamPlayer] = [
    .music: StreamPlayer(streamId: .music),
    .scripture: StreamPlayer(streamId: .scripture),
    .verse: StreamPlayer(streamId: .verse),
  ]

  private var started = false
  private var sessionActive = false

  /// 事件上报出口，由模块注入。
  var emit: ((String, [String: Any]) -> Void)? {
    didSet { for player in players.values { player.emit = emit } }
  }

  private init() {}

  func start() {
    guard !started else { return }
    started = true
    PlaybackStore.shared.subscribe { [weak self] _, next in
      self?.apply(next)
    }
    configureRemoteCommands()
    apply(PlaybackStore.shared.state)
  }

  func player(for stream: StreamId) -> StreamPlayer? { players[stream] }

  // MARK: - 状态 → 播放器

  /// 幂等：同样的状态跑两遍不会有额外动作。
  private func apply(_ state: PlaybackState) {
    let audible = state.audibleStreams
    updateAudioSession(active: !audible.isEmpty)

    for id in StreamId.allCases {
      guard let player = players[id] else { continue }
      let stream = state[id]
      if audible.contains(id), let uri = stream.uri {
        player.play(uri: uri, positionSec: stream.positionSec)
      } else if stream.uri != nil {
        /// 只是暂停：保留 AVPlayer 与进度，续播才不用重新缓冲。
        player.pause()
      } else {
        player.stop()
      }
    }

    updateNowPlaying(state)
  }

  private func updateAudioSession(active: Bool) {
    guard active != sessionActive else { return }
    sessionActive = active
    let session = AVAudioSession.sharedInstance()
    do {
      if active {
        /// 关屏 / 后台续播靠 .playback；混音由各播放器的音量控制，不用 .mixWithOthers，
        /// 否则系统会把我们当成「不重要」的声音，锁屏控制也拿不到。
        try session.setCategory(.playback, mode: .default)
        try session.setActive(true)
      } else {
        try session.setActive(false, options: [.notifyOthersOnDeactivation])
      }
    } catch {
      log.warning("audio session \(active ? "activate" : "deactivate", privacy: .public) failed: \(error.localizedDescription, privacy: .public)")
    }
  }

  // MARK: - 锁屏

  private func updateNowPlaying(_ state: PlaybackState) {
    let center = MPNowPlayingInfoCenter.default()
    guard let np = nowPlaying(state) else {
      center.nowPlayingInfo = nil
      return
    }
    var info: [String: Any] = [
      MPMediaItemPropertyTitle: np.title,
      MPMediaItemPropertyArtist: np.artist,
      MPNowPlayingInfoPropertyElapsedPlaybackTime: np.positionSec,
      MPNowPlayingInfoPropertyPlaybackRate: np.playing ? 1.0 : 0.0,
    ]
    if !np.album.isEmpty { info[MPMediaItemPropertyAlbumTitle] = np.album }
    if np.durationSec > 0 { info[MPMediaItemPropertyPlaybackDuration] = np.durationSec }
    if let artwork = artwork(for: np.artworkUri) {
      info[MPMediaItemPropertyArtwork] = artwork
    }
    center.nowPlayingInfo = info
  }

  private var cachedArtwork: (uri: String, artwork: MPMediaItemArtwork)?

  private func artwork(for uri: String?) -> MPMediaItemArtwork? {
    guard let uri, !uri.isEmpty else { return nil }
    if let cachedArtwork, cachedArtwork.uri == uri { return cachedArtwork.artwork }
    let url = uri.hasPrefix("file://") ? URL(string: uri) : URL(fileURLWithPath: uri)
    guard let url, let data = try? Data(contentsOf: url), let image = UIImage(data: data) else {
      return nil
    }
    let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
    cachedArtwork = (uri, artwork)
    return artwork
  }

  // MARK: - 锁屏控制键

  private func configureRemoteCommands() {
    let center = MPRemoteCommandCenter.shared()

    center.playCommand.addTarget { _ in
      PlaybackStore.shared.dispatch(.resumeTransport)
      return .success
    }
    center.pauseCommand.addTarget { _ in
      PlaybackStore.shared.dispatch(.pauseAll)
      return .success
    }
    center.togglePlayPauseCommand.addTarget { _ in
      let playing = !PlaybackStore.shared.state.audibleStreams.isEmpty
      PlaybackStore.shared.dispatch(playing ? .pauseAll : .resumeTransport)
      return .success
    }
    center.changePlaybackPositionCommand.addTarget { event in
      guard let event = event as? MPChangePlaybackPositionCommandEvent,
        let np = nowPlaying(PlaybackStore.shared.state)
      else { return .commandFailed }
      PlaybackEngine.shared.player(for: np.stream)?.seek(to: event.positionTime)
      return .success
    }
    for command in [center.playCommand, center.pauseCommand, center.togglePlayPauseCommand,
                    center.changePlaybackPositionCommand] {
      command.isEnabled = true
    }
  }

  /// 下一首 / 上一首交回 JS：它才知道曲库与今日计划。
  func bindTransportSkip(next: @escaping () -> Void, previous: @escaping () -> Void) {
    let center = MPRemoteCommandCenter.shared()
    center.nextTrackCommand.addTarget { _ in
      next()
      return .success
    }
    center.previousTrackCommand.addTarget { _ in
      previous()
      return .success
    }
    center.nextTrackCommand.isEnabled = true
    center.previousTrackCommand.isEnabled = true
  }
}
