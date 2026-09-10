import AVFoundation
import Combine

/// 首页环境音播放器：一个槽位无缝循环（AVPlayerLooper），音量按槽位增益压平。
/// R2 点播 + 首次播放后缓存到 Caches/ambient-scenes，下次直接吃本地（对应 RN remoteMediaCache）。
/// 不接锁屏控制（RN 也没有）；整章朗读时不停、只压半（「读经混播时继续播并压音量」）。
@MainActor
final class AmbientPlayer: ObservableObject {
    @Published private(set) var slotId: String?
    @Published private(set) var sleepDeadline: Date?
    var isOn: Bool { slotId != nil }

    /// 开环境音前的互斥（人声 + 音乐都在时要停音乐），由 RootView 接线
    var onWillPlay: (() -> Void)?

    private var queue: AVQueuePlayer?
    private var looper: AVPlayerLooper?
    private var ducked = false
    private var sleepTimer: Timer?
    static let duckGain: Float = 0.5

    private static var cacheDir: URL {
        let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("ambient-scenes", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    func toggle() {
        isOn ? stop() : start(slotId: AmbientScenes.defaultSlotId)
    }

    func start(slotId id: String) {
        guard let slot = AmbientScenes.slot(id: id) else { return }
        onWillPlay?()
        teardown()
        slotId = id
        let local = Self.cacheDir.appendingPathComponent(slot.file)
        let cached = FileManager.default.fileExists(atPath: local.path)
        guard let url = cached ? local : AmbientScenes.remoteURL(id: id) else { return }
        let item = AVPlayerItem(url: url)
        let q = AVQueuePlayer()
        looper = AVPlayerLooper(player: q, templateItem: item)
        q.volume = slot.gain * (ducked ? Self.duckGain : 1)
        queue = q
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
        try? AVAudioSession.sharedInstance().setActive(true)
        q.play()
        if !cached { cache(slot: slot, to: local) }
    }

    func stop() {
        teardown()
        slotId = nil
    }

    /// 整章朗读时压半，停了恢复
    func setDucked(_ on: Bool) {
        ducked = on
        if let id = slotId, let slot = AmbientScenes.slot(id: id) {
            queue?.volume = slot.gain * (on ? Self.duckGain : 1)
        }
    }

    func setSleepTimer(minutes: Int?) {
        sleepTimer?.invalidate()
        sleepTimer = nil
        guard let minutes, minutes > 0 else { sleepDeadline = nil; return }
        let deadline = Date().addingTimeInterval(TimeInterval(minutes * 60))
        sleepDeadline = deadline
        sleepTimer = Timer.scheduledTimer(withTimeInterval: deadline.timeIntervalSinceNow, repeats: false) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                self.sleepDeadline = nil
                self.stop()
            }
        }
    }

    /// 后台把文件下到本机；下次选它不用再等网络
    private func cache(slot: AmbientSlot, to local: URL) {
        guard let remote = AmbientScenes.remoteURL(id: slot.id) else { return }
        let task = URLSession.shared.downloadTask(with: remote) { tmp, response, _ in
            guard let tmp, let http = response as? HTTPURLResponse, http.statusCode == 200 else { return }
            try? FileManager.default.removeItem(at: local)
            try? FileManager.default.moveItem(at: tmp, to: local)
        }
        task.resume()
    }

    private func teardown() {
        queue?.pause()
        looper?.disableLooping()
        looper = nil
        queue = nil
    }
}
