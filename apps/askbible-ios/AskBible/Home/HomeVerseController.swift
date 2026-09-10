import Foundation
import Combine

/// 首页金句：轮播 + 朗读。
///
/// 对应 RN 的 HomeVerseOverlay / useHomeNatureVerseAudioPlayback 那一组：
/// · 不出声时每 10 秒换一句（DEFAULT_HOME_VERSE_ROTATION_SEC）
/// · 开了朗读后，一句播完停 5 秒（DEFAULT_HOME_VERSE_GAP_SEC）再换下一句接着播，锁屏也继续
/// · 选句走 HomeVersePool 的间隔记忆，记忆落 UserDefaults
/// 经文正文从内置 cuv-simp 库取（与 RN chunk 里的 zh-CN 行逐字相同，对拍脚本抽查过）。
@MainActor
final class HomeVerseController: ObservableObject {
    static let rotationSeconds: TimeInterval = 10
    static let gapSeconds: TimeInterval = 5
    private static let memoryKey = "home-verse-memory-v1"

    @Published private(set) var verse: GoldenVerse = .sample
    @Published private(set) var verseKey: String = ""
    @Published private(set) var voiceOn = false
    @Published private(set) var sleepDeadline: Date?

    let player = GoldenVersePlayer()
    private let entries: [HomeVerseEntry]
    private var memory: [String: PrayerMemoryRow]
    private let db = try? ScriptureDatabase(translationId: "cuv-simp")
    private var rotationTimer: Timer?
    private var gapTimer: Timer?
    private var sleepTimer: Timer?

    init() {
        entries = HomeVersePool.loadManifest()
        memory = Self.loadMemory()
        player.onEnded = { [weak self] in self?.scheduleAdvanceAfterGap() }
        advance(play: false)
        startRotation()
    }

    // MARK: 朗读开关（首页那排氛围图标里的喇叭）

    func toggleVoice() {
        voiceOn ? stopVoice() : startVoice()
    }

    func startVoice() {
        voiceOn = true
        stopRotation()
        playCurrent()
    }

    func stopVoice() {
        voiceOn = false
        gapTimer?.invalidate()
        gapTimer = nil
        player.stop()
        startRotation()
    }

    private func playCurrent() {
        guard let url = GoldenVerseAudioSource.remoteURL(verseKey: verseKey) else {
            scheduleAdvanceAfterGap()
            return
        }
        player.play(url: url, title: verse.reference)
    }

    private func scheduleAdvanceAfterGap() {
        guard voiceOn else { return }
        gapTimer?.invalidate()
        gapTimer = Timer.scheduledTimer(withTimeInterval: Self.gapSeconds, repeats: false) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.voiceOn else { return }
                self.advance(play: true)
            }
        }
    }

    // MARK: 轮播

    private func startRotation() {
        rotationTimer?.invalidate()
        rotationTimer = Timer.scheduledTimer(withTimeInterval: Self.rotationSeconds, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, !self.voiceOn else { return }
                self.advance(play: false)
            }
        }
    }

    private func stopRotation() {
        rotationTimer?.invalidate()
        rotationTimer = nil
    }

    /// 选下一句、更新记忆、换显示；`play` 为 true 时接着朗读
    func advance(play: Bool) {
        let now = Date().timeIntervalSince1970 * 1000
        let next = HomeVersePool.pickNext(entries, memory: memory, now: now) { Double.random(in: 0..<1) }
        guard !next.isEmpty else { return }
        HomeVersePool.advanceMemory(&memory, verseKey: next, now: now)
        Self.saveMemory(memory)
        verseKey = next
        verse = resolve(next) ?? .sample
        if play { playCurrent() }
    }

    private func resolve(_ key: String) -> GoldenVerse? {
        guard let loc = GoldenVerseAudioSource.parseVerseKey(key),
              let book = BibleCatalog.book(id: loc.bookId),
              let rows = try? db?.loadChapter(bookId: loc.bookId, chapter: loc.chapter),
              let row = rows.first(where: { $0.number == loc.verse }) else { return nil }
        // 首页短展示要去括注（诗前「（上行之诗）」等），与 RN chunk 里的 zh-CN 行一致
        return GoldenVerse(text: VerseDisplayNotes.strip(row.text), reference: "\(book.nameZh) \(loc.chapter):\(loc.verse)")
    }

    // MARK: 睡眠定时（到期关掉朗读，与其它两个播放器同一套档位）

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
                if self.voiceOn { self.stopVoice() }
            }
        }
    }

    // MARK: 记忆持久化

    private static func loadMemory() -> [String: PrayerMemoryRow] {
        guard let data = UserDefaults.standard.data(forKey: memoryKey),
              let m = try? JSONDecoder().decode([String: PrayerMemoryRow].self, from: data) else { return [:] }
        return m
    }

    private static func saveMemory(_ memory: [String: PrayerMemoryRow]) {
        if let data = try? JSONEncoder().encode(memory) {
            UserDefaults.standard.set(data, forKey: memoryKey)
        }
    }
}
