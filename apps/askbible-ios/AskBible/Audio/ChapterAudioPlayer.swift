import AVFoundation
import Combine
import MediaPlayer

/// 整章朗读播放器。
///
/// 相对 RN 版的差别：那边要靠自定义原生模块把 AVPlayer 的状态桥回 JS，
/// 再由 JS 侧维护一份镜像（`src/audio/` 那 2700 行大半在做这件事）；
/// 这里播放状态就是唯一那一份，SwiftUI 直接订阅，没有跨语言镜像可漂移。
/// 循环模式。与 RN 版 `ReadScripturePlaybackDock` 的 LoopMode 一致：
/// off → chapter（单章循环）→ all（顺延整卷）→ off。
enum LoopMode: String, CaseIterable {
    case off, chapter, all

    var next: LoopMode {
        switch self {
        case .off: return .chapter
        case .chapter: return .all
        case .all: return .off
        }
    }

    var symbol: String {
        self == .chapter ? "repeat.1" : "repeat"
    }
}

@MainActor
final class ChapterAudioPlayer: ObservableObject {
    @Published private(set) var isPlaying = false
    @Published private(set) var isLoading = false
    @Published private(set) var currentTime: Double = 0
    @Published private(set) var duration: Double = 0
    @Published private(set) var errorMessage: String?
    @Published var rate: Float = 1.0 {
        didSet { if isPlaying { player?.rate = rate } }
    }
    @Published var loopMode: LoopMode = .off
    /// 被来电之类打断时置位：停播但不清「想听」的意图，打断结束才续播。
    /// 对应 RN 版 `shellAudioInterruption.ts`，那边要靠原生发 DeviceEventEmitter 事件桥回 JS。
    @Published private(set) var interrupted = false
    /// 跟读高亮：当前正在朗读的节号
    @Published private(set) var activeVerse: Int?
    /// 睡眠定时：到期时刻；nil = 未设。到期只暂停不停止，与 RN 版 SleepTimerFired
    /// （wantPlaying=false, userPaused=true）一致。
    @Published private(set) var sleepDeadline: Date?
    private var sleepTimer: Timer?

    /// 当前装载的章，用于避免重复装载
    private(set) var loadedKey: String?

    private var player: AVPlayer?
    private var timeObserver: Any?
    private var endObserver: NSObjectProtocol?
    private var statusObserver: NSKeyValueObservation?

    /// 供锁屏 / 控制中心显示与下一章跳转
    var nowPlayingTitle: String = ""
    var onSkipNext: (() -> Void)?
    /// 不循环时一章播完：读经计划流靠它顺到下一章
    var onFinished: (() -> Void)?

    var progress: Double {
        duration > 0 ? min(1, max(0, currentTime / duration)) : 0
    }

    /// 用户点过播放：开章时预载会短暂 loading，没点播放前不该转圈（RN 开章不转）
    @Published private(set) var wantsPlayback = false
    /// 播放位置回调（累计听读时长：RN useFollowNativeProgress → noteScriptureListenProgress）
    var onProgress: ((Double, Bool) -> Void)?
    private let timingDB = VerseTimingDatabase()
    private var timings: [VerseTiming] = []

    /// 开播前先让别的播放器（音乐）停下：两个播放器不能同时出声
    var onWillPlay: (() -> Void)?

    init() {
        configureSession()
        observeInterruptions()
    }

    deinit {
        if let timeObserver { player?.removeTimeObserver(timeObserver) }
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
    }

    /// 后台播放靠这一句 —— .playback 类别允许锁屏与切后台后继续出声
    private func configureSession() {
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
        } catch {
            errorMessage = SiteCopy.f("native.audioSessionFailed", ["error": error.localizedDescription])
        }
    }

    /// 来电 / 闹钟 / 其他 App 抢占音频
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
                    // 只有系统说可以续播、且用户本来就想听，才自动恢复
                    if opts.contains(.shouldResume), self.wantsPlayback {
                        self.resume()
                    }
                @unknown default:
                    break
                }
            }
        }

        // 耳机拔出：系统建议暂停，别外放吵到人
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

    /// 装载一章。同一章重复调用不重新装载，只切换播放态。
    func load(url: URL, key: String, title: String,
              translationId: String = "", bookId: String = "", chapter: Int = 0) {
        guard loadedKey != key else { return }
        teardown()

        loadedKey = key
        nowPlayingTitle = title
        timings = bookId.isEmpty ? [] : (timingDB?.timings(
            translationId: translationId, bookId: bookId, chapter: chapter) ?? [])
        activeVerse = nil
        errorMessage = nil
        isLoading = true
        currentTime = 0
        duration = 0

        // fhl.net 需要这个 UA，与 RN 版 StreamPlayer 一致
        let asset = AVURLAsset(url: url, options: [
            "AVURLAssetHTTPHeaderFieldsKey": ["User-Agent": "AskBible.me/1.0 (iOS AVPlayer)"]
        ])
        let item = AVPlayerItem(asset: asset)
        let avPlayer = AVPlayer(playerItem: item)
        avPlayer.automaticallyWaitsToMinimizeStalling = true
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
                    self.errorMessage = item.error?.localizedDescription ?? SiteCopy.t("native.audioLoadFailed")
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
                let t = time.seconds.isFinite ? time.seconds : 0
                self.currentTime = t
                self.onProgress?(t, self.isPlaying)
                let next = VerseTimingLookup.activeVerse(at: t, in: self.timings)
                if next != self.activeVerse { self.activeVerse = next }
                if self.duration == 0, let d = self.player?.currentItem?.duration.seconds,
                   d.isFinite, d > 0 {
                    self.duration = d
                }
            }
        }

        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                switch self.loopMode {
                case .chapter:
                    // 单章循环：回到开头继续，不动章号
                    self.seek(to: 0)
                    self.resume()
                case .all:
                    self.currentTime = self.duration
                    self.onSkipNext?()
                case .off:
                    self.isPlaying = false
                    self.wantsPlayback = false
                    self.currentTime = self.duration
                    self.activeVerse = nil
                    self.updateNowPlaying()
                    self.onFinished?()
                }
            }
        }
    }

    func toggle() {
        isPlaying ? pause() : resume()
    }

    /// 用户点播放不看 `interrupted`（iOS 常不发「打断结束」，之前会把播放键点死；RN 只挡后台自动续播）
    func resume() {
        guard player != nil else { return }
        wantsPlayback = true
        interrupted = false
        onWillPlay?()
        try? AVAudioSession.sharedInstance().setActive(true)
        // 朗读是 spokenAudio；音乐播放器会把 mode 改成 default，回来时改回去
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
        RemoteControlHub.shared.claim(self)
        player?.rate = rate
        isPlaying = true
        updateNowPlaying()
    }

    /// 回到前台：被打断停掉但还想播的，续上（RN tryResumeScriptureAfterInterruption；iOS 常不发「打断结束」）
    func recoverAfterInterruption() {
        guard wantsPlayback, !isPlaying, player != nil else { return }
        resume()
    }

    func pause() {
        wantsPlayback = false
        player?.pause()
        isPlaying = false
        updateNowPlaying()
    }

    func cycleLoop() {
        loopMode = loopMode.next
    }

    /// 与 RN 版 musicCopy 的档位一致：30m / 60m
    static let sleepOptionsMinutes = [30, 60]

    func setSleepTimer(minutes: Int?) {
        sleepTimer?.invalidate()
        sleepTimer = nil
        guard let minutes, minutes > 0 else { sleepDeadline = nil; return }
        let deadline = Date().addingTimeInterval(TimeInterval(minutes * 60))
        sleepDeadline = deadline
        // iOS 上播放中 App 不会被冻结（后台音频会话），一个 Timer 就够准；
        // RN Android 侧要 Handler + AlarmManager 双路，这里不需要。
        sleepTimer = Timer.scheduledTimer(withTimeInterval: deadline.timeIntervalSinceNow, repeats: false) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                self.sleepDeadline = nil
                self.pause()
            }
        }
    }

    var sleepRemainingLabel: String? {
        guard let d = sleepDeadline else { return nil }
        let s = max(0, Int(d.timeIntervalSinceNow.rounded()))
        return String(format: "%d:%02d", s / 60, s % 60)
    }

    func seek(to seconds: Double) {
        let clamped = duration > 0 ? min(max(0, seconds), duration) : max(0, seconds)
        player?.seek(to: CMTime(seconds: clamped, preferredTimescale: 600))
        currentTime = clamped
        activeVerse = VerseTimingLookup.activeVerse(at: clamped, in: timings)
        updateNowPlaying()
    }

    /// 有没有这一章的跟读时间轴（没有就不显示高亮）
    var hasTimings: Bool { !timings.isEmpty }

    func cycleRate() {
        // 与 RN 版 scripture-speed 档位一致
        let steps: [Float] = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0]
        let i = steps.firstIndex(of: rate) ?? 1
        rate = steps[(i + 1) % steps.count]
    }

    private func updateNowPlaying() {
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: nowPlayingTitle,
            MPMediaItemPropertyArtist: "AskBible",
            MPNowPlayingInfoPropertyElapsedPlaybackTime: currentTime,
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? Double(rate) : 0,
        ]
        if duration > 0 { info[MPMediaItemPropertyPlaybackDuration] = duration }
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
        isPlaying = false
    }

    /// 秒 → m:ss，与播放坞的时间标签一致
    static func timeLabel(_ seconds: Double) -> String {
        guard seconds.isFinite, seconds >= 0 else { return "\u{2014}:\u{2014}" }
        let total = Int(seconds.rounded())
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}

extension ChapterAudioPlayer: RemotePlayable {
    func remotePlay() { resume() }
    func remotePause() { pause() }
    func remoteToggle() { toggle() }
    func remoteNext() { onSkipNext?() }
    /// 朗读没有「上一章」的远程语义，上一曲键回到本章开头
    func remotePrevious() { seek(to: 0) }
    func remoteSeek(to seconds: Double) { seek(to: seconds) }
}
