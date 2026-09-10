import Foundation
import Combine

/// 读经活动的本机记录（RN reading-habit-stats / scripture-listen-totals / app-usage-time / read-last-position / read-recent-chapters）：
/// 探索页的「今年已过 / 读经天 / 连续天 / 使用时长 / 累计听 / 最近阅读」全从这里来，键与 RN AsyncStorage 同名。
/// habitStats / scriptureListenTotals / lastPosition 参与会员同步；使用时长 / 最近阅读只在本机。
@MainActor
final class ReadingActivityStore: ObservableObject {
    static let habitKey = "askbible-reading-habit-stats-v1"
    static let listenKey = "askbible-scripture-listen-totals-v1"
    static let usageKey = "askbible-app-usage-time-v1"
    static let lastKey = "askbible-mobile-read-last-v1"
    static let recentKey = "askbible-mobile-read-recent-chapters-v1"
    static let maxRecent = 3

    struct RecentChapter: Equatable, Identifiable {
        let bookId: String
        let chapter: Int
        let bookName: String
        let at: Double
        var id: String { "\(bookId):\(chapter)" }
    }

    /// 习惯统计：有读经活动（或打开过 App）的日历日，排序去重
    @Published private(set) var completedDates: [String] = []
    /// 累计听读秒数（经文朗读）
    @Published private(set) var listenTotalSec: Double = 0
    /// 累计前台使用秒数（不含本次前台会话）
    @Published private(set) var usageStoredSec: Double = 0
    @Published private(set) var recent: [RecentChapter] = []
    @Published private(set) var lastPosition: RecentChapter?

    /// 本机改动通知（会员同步；应用云端期间压住）
    var onLocalChange: ((String) -> Void)?
    var suppressChangeNotify = false

    private let defaults = UserDefaults.standard
    private var sessionStartedAt: Date?
    private var lastListenPos: Double = -1
    private var listenPersistTimer: Timer?
    private var usagePersistTimer: Timer?

    init() {
        completedDates = Self.parseDates(defaults.string(forKey: Self.habitKey), field: "completedDates")
        listenTotalSec = Self.parseTotal(defaults.string(forKey: Self.listenKey))
        usageStoredSec = Self.parseTotal(defaults.string(forKey: Self.usageKey))
        recent = Self.parseRecent(defaults.string(forKey: Self.recentKey))
        lastPosition = Self.parseLast(defaults.string(forKey: Self.lastKey))
    }

    // MARK: 习惯统计（RN touchReadingHabitDay / replaceReadingHabitStatsRecord / computeReadingStreak）

    var completedDateSet: Set<String> { Set(completedDates) }
    var readDays: Int { completedDates.count }
    var streakDays: Int { MemberReadingSyncRules.computeReadingStreak(completedDates, today: PlanDates.localDateString()) }

    private static func parseDates(_ raw: String?, field: String) -> [String] {
        guard let raw, let data = raw.data(using: .utf8), let o = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              MemberReadingSyncRules.num(o["version"]) == 1 else { return [] }
        return MemberReadingSyncRules.normalizeDates(MemberReadingSyncRules.stringArray(o[field]))
    }

    private func writeHabit(_ dates: [String], notify: Bool) {
        completedDates = dates
        if let data = try? JSONSerialization.data(withJSONObject: ["version": 1, "completedDates": dates]) {
            defaults.set(String(decoding: data, as: UTF8.self), forKey: Self.habitKey)
        }
        if notify, !suppressChangeNotify { onLocalChange?("habitStats") }
    }

    /// 记某日已有读经（只增不减）：打开 App、读完 / 听完一章、计划页点听
    func touchHabitDay(_ date: String = PlanDates.localDateString()) {
        guard PlanDates.parseLocalDate(date) != nil, !completedDates.contains(date) else { return }
        writeHabit(MemberReadingSyncRules.normalizeDates(completedDates + [date]), notify: true)
    }

    /// 云端习惯日并入本机（并集，不触发再上传）
    func mergeRemoteHabit(_ dates: [String]) {
        let merged = MemberReadingSyncRules.normalizeDates(completedDates + dates)
        if merged != completedDates { writeHabit(merged, notify: false) }
    }

    var habitJSON: [String: Any] { ["version": 1, "completedDates": completedDates] }

    // MARK: 累计听读（RN noteScriptureListenProgress：按播放位置差累加，单次最多 1.5 秒）

    private static func parseTotal(_ raw: String?) -> Double {
        guard let raw, let data = raw.data(using: .utf8), let o = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              MemberReadingSyncRules.num(o["version"]) == 1, let n = MemberReadingSyncRules.num(o["totalSec"]), n.isFinite, n >= 0 else { return 0 }
        return n.rounded(.down)
    }

    func noteListenProgress(positionSec: Double, isPlaying: Bool) {
        guard isPlaying, positionSec.isFinite, positionSec >= 0 else { lastListenPos = -1; return }
        if lastListenPos >= 0, positionSec > lastListenPos {
            let delta = min(positionSec - lastListenPos, 1.5)
            if delta > 0 {
                listenTotalSec += delta
                scheduleListenPersist()
            }
        }
        lastListenPos = positionSec
    }

    private func scheduleListenPersist() {
        guard listenPersistTimer == nil else { return }
        listenPersistTimer = Timer.scheduledTimer(withTimeInterval: 2, repeats: false) { [weak self] _ in
            Task { @MainActor in self?.persistListen(notify: true) }
        }
    }

    private func persistListen(notify: Bool) {
        listenPersistTimer?.invalidate(); listenPersistTimer = nil
        if let data = try? JSONSerialization.data(withJSONObject: ["version": 1, "totalSec": Int(listenTotalSec.rounded(.down))]) {
            defaults.set(String(decoding: data, as: UTF8.self), forKey: Self.listenKey)
        }
        if notify, !suppressChangeNotify { onLocalChange?("scriptureListenTotals") }
    }

    /// 云端累计听并入：取较大值
    func mergeRemoteListen(totalSec: Double) {
        let next = max(listenTotalSec, totalSec.rounded(.down))
        guard next != listenTotalSec else { return }
        listenTotalSec = next
        persistListen(notify: false)
    }

    var listenJSON: [String: Any] { ["version": 1, "totalSec": Int(listenTotalSec.rounded(.down))] }

    // MARK: 使用时长（RN app-usage-time：前台时段累加，15 秒打点，2.5 秒落盘）

    var usageTotalSec: Double { usageStoredSec + (sessionStartedAt.map { max(0, Date().timeIntervalSince($0)) } ?? 0) }

    func noteForeground() {
        if sessionStartedAt == nil { sessionStartedAt = Date() }
    }

    func noteBackground() {
        flushUsageTick()
        sessionStartedAt = nil
        persistUsage()
    }

    /// 把本次前台已过的秒数记入累计，重新起算
    func flushUsageTick() {
        guard let started = sessionStartedAt else { return }
        let elapsed = max(0, Date().timeIntervalSince(started))
        if elapsed > 0 {
            usageStoredSec += elapsed
            sessionStartedAt = Date()
            scheduleUsagePersist()
        }
    }

    private func scheduleUsagePersist() {
        guard usagePersistTimer == nil else { return }
        usagePersistTimer = Timer.scheduledTimer(withTimeInterval: 2.5, repeats: false) { [weak self] _ in
            Task { @MainActor in self?.persistUsage() }
        }
    }

    private func persistUsage() {
        usagePersistTimer?.invalidate(); usagePersistTimer = nil
        if let data = try? JSONSerialization.data(withJSONObject: ["version": 1, "totalSec": Int(usageStoredSec.rounded(.down))]) {
            defaults.set(String(decoding: data, as: UTF8.self), forKey: Self.usageKey)
        }
    }

    // MARK: 最近阅读 / 最后位置（RN writeLastReadPosition + pushReadRecentChapter）

    private static func parseLast(_ raw: String?) -> RecentChapter? {
        guard let raw, let data = raw.data(using: .utf8), let o = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let bookId = (o["bookId"] as? String)?.trimmingCharacters(in: .whitespaces), !bookId.isEmpty,
              let ch = MemberReadingSyncRules.num(o["chapter"]), ch == ch.rounded(), ch >= 1 else { return nil }
        let name = (o["bookName"] as? String)?.trimmingCharacters(in: .whitespaces) ?? ""
        return RecentChapter(bookId: bookId, chapter: Int(ch), bookName: name.isEmpty ? bookId : name, at: 0)
    }

    private static func parseRecent(_ raw: String?) -> [RecentChapter] {
        guard let raw, let data = raw.data(using: .utf8), let arr = (try? JSONSerialization.jsonObject(with: data)) as? [Any] else { return [] }
        var out: [RecentChapter] = []
        for item in arr {
            guard let o = item as? [String: Any], let bookId = (o["bookId"] as? String)?.trimmingCharacters(in: .whitespaces), !bookId.isEmpty,
                  let ch = MemberReadingSyncRules.num(o["chapter"]), ch == ch.rounded(), ch >= 1 else { continue }
            let name = (o["bookName"] as? String)?.trimmingCharacters(in: .whitespaces) ?? ""
            let at = MemberReadingSyncRules.num(o["at"]) ?? 0
            out.append(RecentChapter(bookId: bookId, chapter: Int(ch), bookName: name.isEmpty ? bookId : name, at: at > 0 ? at : Date().timeIntervalSince1970 * 1000))
            if out.count >= maxRecent { break }
        }
        return out
    }

    private func persistRecent() {
        let arr = recent.map { ["bookId": $0.bookId, "chapter": $0.chapter, "bookName": $0.bookName, "at": Int64($0.at)] as [String: Any] }
        if let data = try? JSONSerialization.data(withJSONObject: arr) { defaults.set(String(decoding: data, as: UTF8.self), forKey: Self.recentKey) }
    }

    private func persistLast(_ p: RecentChapter) {
        if let data = try? JSONSerialization.data(withJSONObject: ["bookId": p.bookId, "chapter": p.chapter, "bookName": p.bookName] as [String: Any]) {
            defaults.set(String(decoding: data, as: UTF8.self), forKey: Self.lastKey)
        }
    }

    private func pushRecent(_ p: RecentChapter) {
        var next = recent.filter { $0.id != p.id }
        next.insert(p, at: 0)
        if next.count > Self.maxRecent { next = Array(next.prefix(Self.maxRecent)) }
        recent = next
        persistRecent()
    }

    /// 打开了某章：记最后位置 + 最近阅读
    func recordOpened(bookId: String, chapter: Int, bookName: String) {
        let p = RecentChapter(bookId: bookId.uppercased(), chapter: chapter, bookName: bookName, at: Date().timeIntervalSince1970 * 1000)
        lastPosition = p
        persistLast(p)
        pushRecent(p)
        if !suppressChangeNotify { onLocalChange?("lastPosition") }
    }

    /// 云端最后位置落本机（RN writeLastReadPosition 也会顶进最近阅读）
    func applyRemoteLastPosition(bookId: String, chapter: Int, bookName: String) {
        let p = RecentChapter(bookId: bookId, chapter: chapter, bookName: bookName.isEmpty ? bookId : bookName, at: Date().timeIntervalSince1970 * 1000)
        lastPosition = p
        persistLast(p)
        pushRecent(p)
    }

    var lastPositionJSON: [String: Any]? {
        guard let p = lastPosition else { return nil }
        return ["bookId": p.bookId, "chapter": p.chapter, "bookName": p.bookName]
    }

    // MARK: 换帐号 / 退出（RN clearLocalMemberReadingSyncBlobs：习惯 / 听读 / 最后位置清空；使用时长与最近阅读留着）

    func clearForAccountSwitch() {
        writeHabit([], notify: false)
        listenTotalSec = 0; lastListenPos = -1
        defaults.removeObject(forKey: Self.listenKey)
        lastPosition = nil
        defaults.removeObject(forKey: Self.lastKey)
    }
}
