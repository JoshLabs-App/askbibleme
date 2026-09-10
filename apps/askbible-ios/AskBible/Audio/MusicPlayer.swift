import AVFoundation
import Combine
import MediaPlayer

/// 音乐页播放器。曲库是 MusicCatalog（内置 5 首 + R2 点播），队列 = 当前专辑的全部曲目。
///
/// 与整章朗读的 ChapterAudioPlayer 是两个独立播放器（RN 版是一个 shell 播放器切模式）；
/// 互斥靠 `onWillPlay` 由 RootView 接线，锁屏命令靠 RemoteControlHub 路由。
/// 专辑规则（循环 / 音量 / 睡眠定时联动 / 起播曲）见 MusicAlbumRules，与 RN 的 useMusicHomeAlbum 一致。
@MainActor
final class MusicPlayer: ObservableObject {
    @Published private(set) var album: String
    /// 当前曲在 MusicCatalog.tracks 里的下标
    @Published private(set) var trackIndex: Int
    @Published private(set) var isPlaying = false
    @Published private(set) var isLoading = false
    @Published private(set) var currentTime: Double = 0
    @Published private(set) var duration: Double = 0
    @Published private(set) var errorMessage: String?
    @Published private(set) var repeatMode: MusicRepeatMode
    @Published private(set) var interrupted = false
    @Published private(set) var sleepDeadline: Date?
    /// 用户选的睡眠档位（0 = 未设），切专辑的联动规则要看它
    private var sleepMinutes = 0
    private var sleepTimer: Timer?

    /// 开播前先让别的播放器（整章朗读）停下
    var onWillPlay: (() -> Void)?

    private var player: AVPlayer?
    private var timeObserver: Any?
    private var endObserver: NSObjectProtocol?
    private var statusObserver: NSKeyValueObservation?
    private var loadedId: String?
    private var wantsPlayback = false
    private var gain: Float

    init() {
        let a = MusicCatalog.defaultAlbum
        album = a
        trackIndex = MusicAlbumRules.startIndex(MusicCatalog.tracks, album: a, current: -1) ?? 0
        repeatMode = MusicAlbumRules.defaultRepeatMode(a) ?? .all
        gain = MusicAlbumRules.defaultGain(a)
        observeInterruptions()
    }

    deinit {
        if let timeObserver { player?.removeTimeObserver(timeObserver) }
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
    }

    // MARK: 队列

    /// 当前专辑的全部曲目（全曲库下标）
    var queue: [Int] {
        MusicCatalog.tracks.indices.filter { MusicCatalog.tracks[$0].album == album }
    }

    var track: MusicTrack? {
        MusicCatalog.tracks.indices.contains(trackIndex) ? MusicCatalog.tracks[trackIndex] : nil
    }

    /// 队列里的邻居，首尾相接；队列不足两首返回 nil
    private func neighbor(_ step: Int) -> Int? {
        let q = queue
        guard q.count > 1, let pos = q.firstIndex(of: trackIndex) else { return nil }
        return q[(pos + step + q.count) % q.count]
    }

    var previousTrack: MusicTrack? { neighbor(-1).map { MusicCatalog.tracks[$0] } }
    var nextTrack: MusicTrack? { neighbor(1).map { MusicCatalog.tracks[$0] } }

    /// 还没探到真实时长前先用曲库元数据，进度条右侧不闪「—:—」
    var displayDuration: Double {
        duration > 0 ? duration : Double(track?.durationSec ?? 0)
    }

    var progress: Double {
        let d = displayDuration
        return d > 0 ? min(1, max(0, currentTime / d)) : 0
    }

    // MARK: 专辑

    /// 切专辑（RN useMusicHomeAlbum.selectAlbum）：换循环模式、联动睡眠定时、换音量、
    /// 跳到该专辑起播曲；正在播就接着播，不然停在暂停态。
    func selectAlbum(_ raw: String) {
        let next = MusicAlbumRules.normalize(raw)
        guard next != album else { return }
        album = next
        if let mode = MusicAlbumRules.defaultRepeatMode(next) { repeatMode = mode }
        if let mins = MusicAlbumRules.sleepTimerOnSwitch(to: next, currentMinutes: sleepMinutes) {
            setSleepTimer(minutes: mins == 0 ? nil : mins)
        }
        gain = MusicAlbumRules.defaultGain(next)
        player?.volume = gain
        if let idx = MusicAlbumRules.startIndex(MusicCatalog.tracks, album: next, current: trackIndex) {
            play(index: idx, autoPlay: isPlaying || wantsPlayback)
        }
    }

    // MARK: 传输

    /// 音乐页播放键（RN resolveMusicPageToggleAction）：
    /// 正在播且当前曲就在选中专辑 → 暂停；否则在选中专辑里起播（当前曲在专辑内就接着它）。
    func toggle() {
        if isPlaying, track?.album == album { pause(); return }
        if let t = track, t.album == album {
            if loadedId == t.id { resume() } else { play(index: trackIndex, autoPlay: true) }
            return
        }
        if let idx = MusicAlbumRules.startIndex(MusicCatalog.tracks, album: album, current: trackIndex) {
            play(index: idx, autoPlay: true)
        }
    }

    func next() {
        guard let n = neighbor(1) else { seek(to: 0); return }
        play(index: n, autoPlay: isPlaying || wantsPlayback)
    }

    func previous() {
        // 与常见播放器一致：播过 3 秒先回本曲开头
        if currentTime > 3 { seek(to: 0); return }
        guard let p = neighbor(-1) else { seek(to: 0); return }
        play(index: p, autoPlay: isPlaying || wantsPlayback)
    }

    func select(index: Int) {
        guard MusicCatalog.tracks.indices.contains(index) else { return }
        play(index: index, autoPlay: true)
    }

    func toggleRepeatOne() { repeatMode = repeatMode == .one ? .off : .one }
    func toggleRepeatAll() { repeatMode = repeatMode == .all ? .off : .all }

    /// 装载并（可选）起播某一首
    func play(index: Int, autoPlay: Bool) {
        guard MusicCatalog.tracks.indices.contains(index) else { return }
        let t = MusicCatalog.tracks[index]
        trackIndex = index
        if loadedId != t.id { load(t) }
        if autoPlay { resume() }
    }

    private func load(_ t: MusicTrack) {
        teardown()
        loadedId = t.id
        errorMessage = nil
        currentTime = 0
        duration = 0
        guard let url = MusicAudioSource.url(for: t) else {
            errorMessage = "这首曲子没有可用音源"
            return
        }
        isLoading = !url.isFileURL
        let asset = AVURLAsset(url: url, options: [
            "AVURLAssetHTTPHeaderFieldsKey": ["User-Agent": MusicAudioSource.userAgent]
        ])
        let item = AVPlayerItem(asset: asset)
        let avPlayer = AVPlayer(playerItem: item)
        avPlayer.automaticallyWaitsToMinimizeStalling = true
        avPlayer.volume = gain
        player = avPlayer

        statusObserver = item.observe(\.status, options: [.new]) { [weak self] item, _ in
            Task { @MainActor in
                guard let self else { return }
                switch item.status {
                case .readyToPlay:
                    self.isLoading = false
                    let d = item.duration.seconds
                    self.duration = d.isFinite && d > 0 ? d : 0
                    self.updateNowPlaying()
                case .failed:
                    self.isLoading = false
                    self.errorMessage = item.error?.localizedDescription ?? "音乐加载失败"
                    self.isPlaying = false
                default:
                    break
                }
            }
        }

        timeObserver = avPlayer.addPeriodicTimeObserver(
            forInterval: CMTime(seconds: 0.25, preferredTimescale: 600), queue: .main
        ) { [weak self] time in
            Task { @MainActor in
                guard let self else { return }
                self.currentTime = time.seconds.isFinite ? time.seconds : 0
                if self.duration == 0, let d = self.player?.currentItem?.duration.seconds, d.isFinite, d > 0 {
                    self.duration = d
                }
            }
        }

        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.handleEnded() }
        }
    }

    /// 播完一首：单曲循环回头；整专辑循环顺延（首尾相接）；不循环则顺延到队尾停下
    private func handleEnded() {
        switch repeatMode {
        case .one:
            seek(to: 0)
            resume()
        case .all:
            if let n = neighbor(1) { play(index: n, autoPlay: true) } else { seek(to: 0); resume() }
        case .off:
            let q = queue
            if let pos = q.firstIndex(of: trackIndex), pos + 1 < q.count {
                play(index: q[pos + 1], autoPlay: true)
            } else {
                isPlaying = false
                wantsPlayback = false
                currentTime = duration
                updateNowPlaying()
            }
        }
    }

    /// 用户点播放（或打断结束自动续播）：不看 `interrupted` —— 通话 / Siri / 别的 App 抢声道后 iOS 常常不发「打断结束」，
    /// 之前这里 guard 一下就把播放键永久点死了（Josh 真机 2026-09-10「点播放播放不了」）。RN 也只挡后台自动续播，不挡用户点。
    func resume() {
        guard player != nil else { return }
        wantsPlayback = true
        interrupted = false
        onWillPlay?()
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
        try? AVAudioSession.sharedInstance().setActive(true)
        RemoteControlHub.shared.claim(self)
        player?.volume = gain
        player?.play()
        isPlaying = true
        updateNowPlaying()
    }

    func pause() {
        wantsPlayback = false
        player?.pause()
        isPlaying = false
        updateNowPlaying()
    }

    func seek(ratio: Double) {
        let d = displayDuration
        guard d > 0 else { return }
        seek(to: min(1, max(0, ratio)) * d)
    }

    func seek(to seconds: Double) {
        let d = displayDuration
        let clamped = d > 0 ? min(max(0, seconds), d) : max(0, seconds)
        player?.seek(to: CMTime(seconds: clamped, preferredTimescale: 600))
        currentTime = clamped
        updateNowPlaying()
    }

    // MARK: 睡眠定时（与 ChapterAudioPlayer 同一套：到期只暂停）

    func setSleepTimer(minutes: Int?) {
        sleepTimer?.invalidate()
        sleepTimer = nil
        guard let minutes, minutes > 0 else { sleepMinutes = 0; sleepDeadline = nil; return }
        sleepMinutes = minutes
        let deadline = Date().addingTimeInterval(TimeInterval(minutes * 60))
        sleepDeadline = deadline
        sleepTimer = Timer.scheduledTimer(withTimeInterval: deadline.timeIntervalSinceNow, repeats: false) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                self.sleepDeadline = nil
                self.sleepMinutes = 0
                self.pause()
            }
        }
    }

    var sleepRemainingLabel: String? {
        guard let d = sleepDeadline else { return nil }
        let s = max(0, Int(d.timeIntervalSinceNow.rounded()))
        return String(format: "%d:%02d", s / 60, s % 60)
    }

    // MARK: 系统

    private func observeInterruptions() {
        NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: AVAudioSession.sharedInstance(), queue: .main
        ) { [weak self] note in
            Task { @MainActor in
                guard let self,
                      let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                      let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
                switch type {
                case .began:
                    self.interrupted = true
                    if self.isPlaying {
                        self.player?.pause()
                        self.isPlaying = false
                        self.updateNowPlaying()
                    }
                case .ended:
                    self.interrupted = false
                    let opts = (note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt)
                        .map(AVAudioSession.InterruptionOptions.init(rawValue:)) ?? []
                    if opts.contains(.shouldResume), self.wantsPlayback { self.resume() }
                @unknown default:
                    break
                }
            }
        }
        NotificationCenter.default.addObserver(
            forName: AVAudioSession.routeChangeNotification,
            object: AVAudioSession.sharedInstance(), queue: .main
        ) { [weak self] note in
            Task { @MainActor in
                guard let self,
                      let raw = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
                      AVAudioSession.RouteChangeReason(rawValue: raw) == .oldDeviceUnavailable
                else { return }
                self.pause()
            }
        }
    }

    private func updateNowPlaying() {
        guard let t = track else { return }
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: t.title,
            MPMediaItemPropertyArtist: t.artist.isEmpty ? "AskBible" : t.artist,
            MPMediaItemPropertyAlbumTitle: t.album,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: currentTime,
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? 1.0 : 0.0,
        ]
        if displayDuration > 0 { info[MPMediaItemPropertyPlaybackDuration] = displayDuration }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    private func teardown() {
        if let timeObserver { player?.removeTimeObserver(timeObserver) }
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
        statusObserver?.invalidate()
        timeObserver = nil
        endObserver = nil
        statusObserver = nil
        player?.pause()
        player = nil
        loadedId = nil
        isPlaying = false
    }
}

extension MusicPlayer: RemotePlayable {
    func remotePlay() { resume() }
    func remotePause() { pause() }
    func remoteToggle() { isPlaying ? pause() : resume() }
    func remoteNext() { next() }
    func remotePrevious() { previous() }
    func remoteSeek(to seconds: Double) { seek(to: seconds) }
}
