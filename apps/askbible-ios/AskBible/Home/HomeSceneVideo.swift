import SwiftUI
import AVFoundation

/// 首页全屏循环场景视频（RN FullBleedCoverVideo.ios）：静音、无缝循环（AVPlayerLooper）、resizeAspectFill。
/// 出首帧前透明，让底下的海报顶住，避免黑闪；退到后台暂停解码，回来接着播。与 Android 的 HomeSceneVideo 对等。
struct HomeSceneVideo: UIViewRepresentable {
    let sceneId: String
    var paused = false

    final class PlayerView: UIView {
        override class var layerClass: AnyClass { AVPlayerLayer.self }
        var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
        let queue = AVQueuePlayer()
        private var looper: AVPlayerLooper?
        private var loadedId: String?
        private var readyObserver: NSKeyValueObservation?

        override init(frame: CGRect) {
            super.init(frame: frame)
            playerLayer.player = queue
            playerLayer.videoGravity = .resizeAspectFill
            queue.isMuted = true
            queue.preventsDisplaySleepDuringVideoPlayback = false
            isOpaque = false
            backgroundColor = .clear
            alpha = 0
            readyObserver = playerLayer.observe(\.isReadyForDisplay, options: [.new]) { [weak self] layer, _ in
                guard layer.isReadyForDisplay else { return }
                DispatchQueue.main.async { UIView.animate(withDuration: 0.25) { self?.alpha = 1 } }
            }
        }

        required init?(coder: NSCoder) { fatalError() }

        func load(_ id: String) {
            guard loadedId != id else { return }
            loadedId = id
            looper = nil
            queue.removeAllItems()
            guard let url = NatureScenes.videoURL(id: id) else { return }
            looper = AVPlayerLooper(player: queue, templateItem: AVPlayerItem(url: url))
            queue.play()
        }

        func setPaused(_ paused: Bool) {
            if paused { queue.pause() } else if queue.rate == 0 { queue.play() }
        }
    }

    func makeUIView(context: Context) -> PlayerView { PlayerView(frame: .zero) }

    func updateUIView(_ v: PlayerView, context: Context) {
        v.load(sceneId)
        v.setPaused(paused)
    }
}
