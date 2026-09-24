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
    /// 句间那 5 秒静音播完了（见 `playGap()`）
    var onGapEnded: (() -> Void)?
    /// 当前这条是不是静音垫片 —— 播完要走 onGapEnded，不是 onEnded
    private var isGap = false
    /// 开播前先让整章朗读停下
    var onWillPlay: (() -> Void)?

    private var player: AVPlayer?
    private var endObserver: NSObjectProtocol?
    private var statusObserver: NSKeyValueObservation?
    private var title = ""

    func play(url: URL, title: String) {
        isGap = false
        playItem(url: url, title: title)
    }

    /**
     句间停顿**播一段静音**，而不是停下来等计时器。

     为什么非这样不可：停顿期间一旦真的没有声音，iOS 会把 App 挂起（锁屏 / 切后台时尤其快），
     `Timer` 跟着不再触发，下一句永远不来 —— 现象就是「念完一句就不往下走了」
     （Josh 2026-09-23 实测）。安卓那边同一天踩的是同一个坑，见
     `GoldenVersePlayer.kt` 的 `wantsPlayback`。

     垫一段 5 秒静音之后，播放链路从头到尾没断过，系统就不会挂起我们，锁屏也照常接下一句。
     */
    func playGap() {
        guard let url = Bundle.main.url(forResource: "silence-5s", withExtension: "m4a") else {
            // 资源缺失时退回「直接下一句」，总比卡死强
            onGapEnded?()
            return
        }
        isGap = true
        playItem(url: url, title: title)
    }

    private func playItem(url: URL, title: String) {
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
                    if self.isGap { self.onGapEnded?() } else { self.onEnded?() }
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
                // 静音垫片播完不算「念完一句」：isPlaying 保持 true，
                // 免得锁屏界面在这 5 秒里显示成暂停
                if self.isGap {
                    self.onGapEnded?()
                } else {
                    self.isPlaying = false
                    self.onEnded?()
                }
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
        isGap = false
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
