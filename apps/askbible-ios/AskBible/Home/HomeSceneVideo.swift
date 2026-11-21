import SwiftUI
import AVFoundation

/// 首页全屏循环场景视频（RN FullBleedCoverVideo.ios）：静音、无缝循环（AVPlayerLooper）、竖屏贴左裁切（left center）、横屏居中裁切。
/// 出首帧前透明，让底下的海报顶住，避免黑闪；退到后台暂停解码，回来接着播。与 Android 的 HomeSceneVideo 对等。
struct HomeSceneVideo: UIViewRepresentable {
    let sceneId: String
    var paused = false

    final class PlayerView: UIView {
        let playerLayer = AVPlayerLayer()
        let queue = AVQueuePlayer()
        private var looper: AVPlayerLooper?
        private var loadedId: String?
        private var readyObserver: NSKeyValueObservation?
        private var sizeObserver: NSKeyValueObservation?
        private var videoSize: CGSize = .zero

        override init(frame: CGRect) {
            super.init(frame: frame)
            clipsToBounds = true
            playerLayer.player = queue
            playerLayer.videoGravity = .resizeAspectFill
            layer.addSublayer(playerLayer)
            queue.isMuted = true
            queue.preventsDisplaySleepDuringVideoPlayback = false
            isOpaque = false
            backgroundColor = .clear
            alpha = 0
            readyObserver = playerLayer.observe(\.isReadyForDisplay, options: [.new]) { [weak self] layer, _ in
                guard layer.isReadyForDisplay else { return }
                DispatchQueue.main.async {
                    self?.updateLayerFrame()
                    UIView.animate(withDuration: 0.25) { self?.alpha = 1 }
                }
            }
        }

        required init?(coder: NSCoder) { fatalError() }

        override func layoutSubviews() {
            super.layoutSubviews()
            updateLayerFrame()
        }

        private func updateLayerFrame() {
            let bw = bounds.width, bh = bounds.height
            guard bw > 0, bh > 0 else { return }
            let media = (videoSize.width > 0 && videoSize.height > 0) ? videoSize : CGSize(width: 16, height: 9)
            let scale = max(bw / media.width, bh / media.height)
            let w = media.width * scale
            let h = media.height * scale
            // 竖屏贴左（x = 0，与 Web object-position: left center 及 Android HomeSceneVideo 一致），横屏居中
            let x: CGFloat = bw > bh ? (bw - w) * 0.5 : 0
            let y: CGFloat = (bh - h) * 0.5
            CATransaction.begin()
            CATransaction.setDisableActions(true)
            playerLayer.frame = CGRect(x: x, y: y, width: w, height: h)
            CATransaction.commit()
        }

        func load(_ id: String) {
            guard loadedId != id else { return }
            loadedId = id
            looper = nil
            sizeObserver = nil
            videoSize = .zero
            queue.removeAllItems()
            guard let url = NatureScenes.videoURL(id: id) else { return }
            let item = AVPlayerItem(url: url)
            sizeObserver = item.observe(\.presentationSize, options: [.initial, .new]) { [weak self] it, _ in
                let sz = it.presentationSize
                guard sz.width > 0, sz.height > 0 else { return }
                DispatchQueue.main.async {
                    self?.videoSize = sz
                    self?.updateLayerFrame()
                }
            }
            looper = AVPlayerLooper(player: queue, templateItem: item)
            // 静音视频也会按当前类别激活会话：自家没在出声就先退回混音，免得掐停「听到」等别的 App（O-24）
            AudioSessionPolicy.relaxIfIdle()
            queue.play()
            updateLayerFrame()
        }

        func setPaused(_ paused: Bool) {
            if paused { queue.pause() } else if queue.rate == 0 { AudioSessionPolicy.relaxIfIdle(); queue.play() }
        }
    }

    func makeUIView(context: Context) -> PlayerView { PlayerView(frame: .zero) }

    func updateUIView(_ v: PlayerView, context: Context) {
        v.load(sceneId)
        v.setPaused(paused)
    }
}
