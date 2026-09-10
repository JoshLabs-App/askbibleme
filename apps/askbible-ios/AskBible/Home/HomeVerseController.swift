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
    /// 首页金句跟当前读经版本走（Josh 2026-09-10）：内置译本直接读本机库；在线译本（含法语等）取该版本的正文，
    /// 没取到之前先用同语系的内置库顶着。切语言时读经译本本来就会跟着换，所以联动仍然成立。
    private(set) var translationId = AppLocale.primaryTranslationId(for: AppLocale.current)
    private(set) var audioTranslationId = AppLocale.goldenVerseAudioTranslationId(for: AppLocale.current)
    private var db = try? ScriptureDatabase(translationId: AppLocale.primaryTranslationId(for: AppLocale.current))
    /// 在线版本（正文要联网取）；nil = 直接读本机库
    private(set) var remoteSource: ScriptureTranslation?
    /// 金句朗读只有和合本 / WEBP 两套：显示的是别的版本时就没有对得上的朗读，喇叭不出
    @Published private(set) var voiceAvailable = true
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

    /// 切语言：换经文译本与朗读译本，当前这句立刻按新译本重取
    func setTranslation(_ id: String, audioTranslationId: String) {
        if id != translationId {
            translationId = id
            db = try? ScriptureDatabase(translationId: id)
        }
        self.audioTranslationId = audioTranslationId
        if !verseKey.isEmpty, let v = resolve(verseKey) { verse = v }
    }

    private func playCurrent() {
        guard let url = GoldenVerseAudioSource.remoteURL(verseKey: verseKey, translationId: audioTranslationId) else {
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
        fetchRemoteIfNeeded(next)
        if play { playCurrent() }
    }

    private func resolve(_ key: String) -> GoldenVerse? {
        guard let loc = GoldenVerseAudioSource.parseVerseKey(key),
              let book = BibleCatalog.book(id: loc.bookId) else { return nil }
        let name = remoteSource.flatMap { RemoteBookNames.name($0, bookId: loc.bookId) } ?? book.name(AppLocale.current)
        let reference = "\(name) \(loc.chapter):\(loc.verse)"
        // 在线版本：缓存里有这一章就用它的正文（换句时顺带把这一章拉回来缓存，见 fetchRemoteIfNeeded）
        if let t = remoteSource,
           let cached = RemoteChapterStore.cached(t.id, bookId: loc.bookId, chapter: loc.chapter),
           let row = cached.first(where: { $0.verse == loc.verse }) {
            return GoldenVerse(text: VerseDisplayNotes.strip(row.text), reference: reference)
        }
        guard let rows = try? db?.loadChapter(bookId: loc.bookId, chapter: loc.chapter),
              let row = rows.first(where: { $0.number == loc.verse }) else { return nil }
        // 首页短展示要去括注（诗前「（上行之诗）」等），与 RN chunk 里的 zh-CN 行一致
        return GoldenVerse(text: VerseDisplayNotes.strip(row.text), reference: reference)
    }

    /// 在线版本：把这一句所在的章拉回来（RemoteChapterStore 自带内存 + 落盘缓存），拿到就把当前这句换成该版本的正文
    private func fetchRemoteIfNeeded(_ key: String) {
        guard let t = remoteSource, let loc = GoldenVerseAudioSource.parseVerseKey(key),
              RemoteChapterStore.cached(t.id, bookId: loc.bookId, chapter: loc.chapter) == nil else { return }
        Task { [weak self] in
            _ = await RemoteChapterStore.shared.load(t, bookId: loc.bookId, chapter: loc.chapter)
            await MainActor.run {
                guard let self, self.verseKey == key else { return }
                if let v = self.resolve(key) { self.verse = v }
            }
        }
    }

    /// 首页金句的来源版本 = 当前读经版本。内置的直接读库；在线的联网取正文，先用同语系内置库顶着
    func setSource(_ t: ScriptureTranslation) {
        let fallbackId: String = t.isZh ? (AppLocale.current == .zhTW ? "cuv-trad" : "cuv-simp")
            : (t.language.lowercased().hasPrefix("en") ? "web-en" : "web-en")
        let localId = t.delivery == .bundled ? t.id : fallbackId
        if localId != translationId {
            translationId = localId
            db = try? ScriptureDatabase(translationId: localId)
        }
        remoteSource = t.delivery == .bundled ? nil : t
        audioTranslationId = AppLocale.goldenVerseAudioTranslationId(for: t.isZh ? .zhCN : .en)
        // 显示的正文不是和合本 / WEBP 时没有对得上的朗读
        voiceAvailable = remoteSource == nil
        if !voiceAvailable, voiceOn { stopVoice() }
        if !verseKey.isEmpty {
            if let v = resolve(verseKey) { verse = v }
            fetchRemoteIfNeeded(verseKey)
        }
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
