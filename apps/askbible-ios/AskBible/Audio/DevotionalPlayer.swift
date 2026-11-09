import AVFoundation
import Combine
import MediaPlayer

/// 一次读一篇；与读经、金句互斥，复用统一锁屏命令入口。
@MainActor
final class DevotionalPlayer: ObservableObject, RemotePlayable {
    @Published private(set) var currentKey: String?
    @Published private(set) var isPlaying = false
    @Published private(set) var isLoading = false
    @Published private(set) var failed = false
    @Published private(set) var position = 0.0
    @Published private(set) var duration = 0.0
    var onWillPlay: (() -> Void)?
    var onStopped: (() -> Void)?
    private var player: AVPlayer?
    private var status: NSKeyValueObservation?
    private var endObserver: NSObjectProtocol?
    private var ticker: Any?
    private var title = ""
    @Published private(set) var wantsPlayback = false
    private var sleepTask: Task<Void, Never>?
    @Published private(set) var sleepDeadline: Date?

    init() { AudioSessionPolicy.register { [weak self] in self?.isPlaying == true } }
    func play(_ day: DevotionalDay) {
        guard let url = day.audioURL else { return }
        if currentKey == day.md, !failed { remotePlay(); return }
        stop()
        currentKey = day.md; title = "\(day.dateLabel) \(day.title)"
        let item = AVPlayerItem(asset: AVURLAsset(url: url, options: ["AVURLAssetHTTPHeaderFieldsKey": ["User-Agent": MusicAudioSource.userAgent]]))
        let av = AVPlayer(playerItem: item); player = av
        isLoading = true; failed = false
        status = item.observe(\.status, options: [.new]) { [weak self] item, _ in
            Task { @MainActor in
                guard let self, self.player?.currentItem === item else { return }
                if item.status == .failed { self.failed = true; self.isLoading = false; self.remotePause() }
                if item.status == .readyToPlay { self.isLoading = false; self.updateInfo() }
            }
        }
        endObserver = NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.player?.currentItem === item else { return }
                self.remotePause(); self.remoteSeek(to: 0)
            }
        }
        ticker = av.addPeriodicTimeObserver(forInterval: CMTime(seconds: 0.5, preferredTimescale: 600), queue: .main) { [weak self] time in
            Task { @MainActor in
                guard let self else { return }
                self.position = time.seconds.isFinite ? time.seconds : 0
                let d = self.player?.currentItem?.duration.seconds ?? 0
                self.duration = d.isFinite ? max(0, d) : 0
                self.isLoading = self.wantsPlayback && self.player?.timeControlStatus == .waitingToPlayAtSpecifiedRate
                self.isPlaying = self.player?.timeControlStatus == .playing
                self.updateInfo()
            }
        }
        remotePlay()
    }
    func stop() {
        remotePause()
        if let ticker { player?.removeTimeObserver(ticker) }; ticker = nil
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }; endObserver = nil
        status?.invalidate(); status = nil; player = nil
        currentKey = nil; position = 0; duration = 0; isLoading = false
        RemoteControlHub.shared.release(self)
    }
    func setSleepTimer(minutes: Int?) {
        sleepTask?.cancel(); sleepTask = nil; sleepDeadline = nil
        guard let minutes, minutes > 0 else { return }
        sleepDeadline = Date().addingTimeInterval(Double(minutes * 60))
        sleepTask = Task { [weak self] in
            do { try await Task.sleep(for: .seconds(minutes * 60)) } catch { return }
            self?.remotePause(); self?.sleepDeadline = nil
        }
    }
    func remotePlay() {
        guard player != nil else { return }
        onWillPlay?(); AudioSessionPolicy.playback(mode: .spokenAudio)
        RemoteControlHub.shared.claim(self); wantsPlayback = true; player?.play(); isPlaying = player?.timeControlStatus == .playing; updateInfo()
    }
    func remotePause() { wantsPlayback = false; player?.pause(); isPlaying = false; isLoading = false; updateInfo(); onStopped?() }
    func remoteToggle() { wantsPlayback ? remotePause() : remotePlay() }
    func remoteNext() {}
    func remotePrevious() { remoteSeek(to: 0) }
    func remoteSeek(to seconds: Double) { player?.seek(to: CMTime(seconds: max(0, seconds), preferredTimescale: 600)) }
    private func updateInfo() {
        guard currentKey != nil else { return }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [MPMediaItemPropertyTitle: title,
            MPMediaItemPropertyArtist: SolidJoys.title, MPNowPlayingInfoPropertyElapsedPlaybackTime: position,
            MPMediaItemPropertyPlaybackDuration: duration, MPNowPlayingInfoPropertyPlaybackRate: wantsPlayback ? 1 : 0]
    }
}
