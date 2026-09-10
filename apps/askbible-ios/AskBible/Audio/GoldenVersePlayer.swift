import AVFoundation
import Combine
import MediaPlayer

/// 首页金句朗读播放器：一次一句，播完（或取不到音频）回调 `onEnded`，由 HomeVerseController 决定下一句。
/// 与整章朗读互斥（都是人声），与音乐可同时出声（RN 首页「音乐+金句 均可」）。
@MainActor
final class GoldenVersePlayer: ObservableObject {
    @Published private(set) var isPlaying = false
    @Published private(set) var isLoading = false

    var onEnded: (() -> Void)?
    /// 开播前先让整章朗读停下
    var onWillPlay: (() -> Void)?

    private var player: AVPlayer?
    private var endObserver: NSObjectProtocol?
    private var statusObserver: NSKeyValueObservation?
    private var title = ""

    func play(url: URL, title: String) {
        teardown()
        self.title = title
        onWillPlay?()
        isLoading = true
        let asset = AVURLAsset(url: url, options: [
            "AVURLAssetHTTPHeaderFieldsKey": ["User-Agent": MusicAudioSource.userAgent]
        ])
        let item = AVPlayerItem(asset: asset)
        let avPlayer = AVPlayer(playerItem: item)
        player = avPlayer

        statusObserver = item.observe(\.status, options: [.new]) { [weak self] item, _ in
            Task { @MainActor in
                guard let self else { return }
                switch item.status {
                case .readyToPlay:
                    self.isLoading = false
                    self.updateNowPlaying()
                case .failed:
                    // R2 上没这句（404）会走到这里：当作播完，别对着空文件干等
                    self.isLoading = false
                    self.isPlaying = false
                    self.onEnded?()
                default:
                    break
                }
            }
        }
        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                self.isPlaying = false
                self.onEnded?()
            }
        }

        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
        try? AVAudioSession.sharedInstance().setActive(true)
        RemoteControlHub.shared.claim(self)
        avPlayer.play()
        isPlaying = true
        updateNowPlaying()
    }

    func stop() {
        teardown()
        isPlaying = false
        isLoading = false
        RemoteControlHub.shared.release(self)
    }

    private func updateNowPlaying() {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: title,
            MPMediaItemPropertyArtist: SiteCopy.t("native.goldenVerseNowPlaying"),
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? 1.0 : 0.0,
        ]
    }

    private func teardown() {
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
        statusObserver?.invalidate()
        endObserver = nil
        statusObserver = nil
        player?.pause()
        player = nil
    }
}

extension GoldenVersePlayer: RemotePlayable {
    func remotePlay() { player?.play(); isPlaying = player != nil; updateNowPlaying() }
    func remotePause() { player?.pause(); isPlaying = false; updateNowPlaying() }
    func remoteToggle() { isPlaying ? remotePause() : remotePlay() }
    func remoteNext() { onEnded?() }
    func remotePrevious() { player?.seek(to: .zero) }
    func remoteSeek(to seconds: Double) { player?.seek(to: CMTime(seconds: seconds, preferredTimescale: 600)) }
}
