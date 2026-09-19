import Foundation
import Combine

/// 成就系统的数据层（DECISIONS「成就系统：复用 MY CLASS 勋章图」「XP 要一直在涨」）。
///
/// 只存一份 ledger：读过哪些章、读过多少节、每天的晨 / 夜标记、以及已获得的勋章档位。
/// 勋章、书卷印章、等级全部**现算**——云端同步进来新数据，下次评估就把漏发的补上，不会出现结果和记录对不上。
///
/// XP 分两半：
/// - **基础 XP** 由 ledger 现算，只会涨不会掉（章 / 节 / 听读 / 收藏 / 高亮 / 计划日 / 勋章 / 印章）；
/// - **加成 XP** 是连续天数乘区和连读 combo 在「动作发生的当下」算出来的，必须落盘累加——
///   否则历史 XP 会随倍率变化缩水，那是最伤的负反馈。倍率本身只升不降（见 streakMultiplier）。
@MainActor
final class AchievementStore: ObservableObject {
    static let ledgerKey = "askbible-achievements-ledger-v1"

    struct Earned: Codable, Equatable { var tier: Int; var at: Double }

    /// 一次评估产生的新事件，给飘字 / 弹层用
    enum Event: Equatable {
        case xp(Int, reason: String)          // +XP 飘字
        case chapterRead(String, Int)         // 卷 id、章
        case sealEarned(String)               // 卷 id
        case medal(key: String, tier: Int)
        case levelUp(Int)
    }

    // MARK: 落盘的 ledger

    private struct Snapshot: Codable {
        /// "GEN:1" → 首次读完的时间戳（秒）
        var chaptersRead: [String: Double] = [:]
        /// 打开过（没读完也算）的章，只用来发「初次翻开」
        var chaptersOpened: Int = 0
        /// 累计读过的经节次数（微反馈 XP 的来源，重读也算）
        var versesRead: Int = 0
        /// 累计听读的计时片数（每 listenTickSeconds 一片）
        var listenTicks: Int = 0
        /// 清晨 / 夜间读经的日期
        var morningDates: [String] = []
        var nightDates: [String] = []
        /// 已获得的勋章 → 最高档
        var earned: [String: Earned] = [:]
        /// 点亮的书卷印章 → 时间
        var seals: [String: Double] = [:]
        /// 连续天数乘区 / combo 在当下算出来的加成，累加落盘
        var bonusXP: Int = 0
        /// 连读同一卷的计数（用来算 combo 和「一路读下去」）
        var comboBookId: String = ""
        var comboCount: Int = 0
        /// 一天只发一次的「今天第一次打开」
        var lastOpenDay: String = ""
        /// 历史最长连续天数：倍率只升不降（Josh 2026-09-18 A 方案）
        var bestStreakDays: Int = 0
        /// 当前在听的那一章，以及这一章已经给过几片听读 XP（防挂机刷分）
        var listenChapterKey: String = ""
        var listenChapterTicks: Int = 0
    }

    @Published private(set) var totalXP: Int = 0
    @Published private(set) var level: Int = 1
    @Published private(set) var earned: [String: Earned] = [:]
    @Published private(set) var seals: [String: Double] = [:]
    @Published private(set) var chaptersReadCount: Int = 0
    /// 待展示的事件队列（飘字 / 弹层消费一条 consume 一条）
    @Published private(set) var pending: [Event] = []

    /// 本机改动通知（会员同步）
    var onLocalChange: ((String) -> Void)?
    var suppressChangeNotify = false

    private var s: Snapshot { didSet { persist() } }
    private let defaults = UserDefaults.standard
    private weak var activity: ReadingActivityStore?
    private weak var plans: ReadingPlanStore?
    private weak var bookmarks: VerseBookmarkStore?
    private weak var highlights: VerseHighlightStore?
    var now: () -> Date = Date.init
    /// App 是否在前台：听读 XP 只在前台给（后台播着不算，A 方案的防刷约束之一）
    var foreground = true

    init() {
        if let raw = defaults.string(forKey: Self.ledgerKey), let data = raw.data(using: .utf8),
           let snap = try? JSONDecoder().decode(Snapshot.self, from: data) {
            s = snap
        } else {
            s = Snapshot()
        }
    }

    func attach(activity: ReadingActivityStore, plans: ReadingPlanStore,
                bookmarks: VerseBookmarkStore, highlights: VerseHighlightStore) {
        self.activity = activity
        self.plans = plans
        self.bookmarks = bookmarks
        self.highlights = highlights
        refresh()
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(s) {
            defaults.set(String(decoding: data, as: UTF8.self), forKey: Self.ledgerKey)
        }
        if !suppressChangeNotify { onLocalChange?("achievements") }
    }

    // MARK: 统计口径（勋章判定都走这里）

    var readingDays: Int { activity?.readDays ?? 0 }
    var streakDays: Int { activity?.streakDays ?? 0 }
    var listenSeconds: Double { activity?.listenTotalSec ?? 0 }
    var favoritesCount: Int { bookmarks?.store.count ?? 0 }
    var highlightsCount: Int { highlights?.store.values.reduce(0) { $0 + $1.count } ?? 0 }
    var planDays: Int { plans?.completed.count ?? 0 }

    /// 读完的章按卷归拢
    private var readByBook: [String: Set<Int>] {
        var out: [String: Set<Int>] = [:]
        for key in s.chaptersRead.keys {
            let parts = key.split(separator: ":")
            guard parts.count == 2, let ch = Int(parts[1]) else { continue }
            out[String(parts[0]), default: []].insert(ch)
        }
        return out
    }

    /// 整卷读完的卷 id
    var completedBookIds: Set<String> {
        var out: Set<String> = []
        let byBook = readByBook
        for book in BibleCatalog.all {
            if (byBook[book.id]?.count ?? 0) >= book.chapterCount { out.insert(book.id) }
        }
        return out
    }

    var otBooksCompleted: Int {
        completedBookIds.compactMap { id in BibleCatalog.all.first { $0.id == id }?.number }
            .filter { $0 <= BibleCatalog.oldTestamentMax }.count
    }
    var ntBooksCompleted: Int {
        completedBookIds.compactMap { id in BibleCatalog.all.first { $0.id == id }?.number }
            .filter { $0 > BibleCatalog.oldTestamentMax }.count
    }

    /// 完整的一周（周一起算）每天都读经的周数
    var fullWeeks: Int {
        guard let dates = activity?.completedDateSet, !dates.isEmpty else { return 0 }
        var cal = Calendar(identifier: .gregorian); cal.firstWeekday = 2
        var weeks: Set<Int> = []
        for d in dates {
            guard let p = PlanDates.parseLocalDate(d),
                  let day = cal.date(from: DateComponents(year: p.y, month: p.m, day: p.d)) else { continue }
            let comps = cal.dateComponents([.yearForWeekOfYear, .weekOfYear], from: day)
            guard let y = comps.yearForWeekOfYear, let w = comps.weekOfYear else { continue }
            let tag = y * 100 + w
            guard !weeks.contains(tag) else { continue }
            // 该周 7 天是否都在
            guard let start = cal.date(from: DateComponents(weekday: 2, weekOfYear: w, yearForWeekOfYear: y)) else { continue }
            let all = (0..<7).allSatisfy { i in
                guard let dd = cal.date(byAdding: .day, value: i, to: start) else { return false }
                return dates.contains(PlanDates.localDateString(dd))
            }
            if all { weeks.insert(tag) }
        }
        return weeks.count
    }

    /// 本月听读小时（按累计听读的月度切片——本机只有总数，所以用「本月新增」近似：见 monthAnchor）
    var listenHoursThisMonth: Int {
        let anchor = defaults.double(forKey: "askbible-achievements-month-anchor")
        let tag = defaults.string(forKey: "askbible-achievements-month-tag") ?? ""
        let nowTag = Self.monthTag(now())
        if tag != nowTag { return Int(listenSeconds - anchor) / 3600 }
        return Int(max(0, listenSeconds - anchor)) / 3600
    }

    private static func monthTag(_ d: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM"; f.locale = Locale(identifier: "en_US_POSIX")
        return f.string(from: d)
    }

    private func rollMonthAnchorIfNeeded() {
        let nowTag = Self.monthTag(now())
        if defaults.string(forKey: "askbible-achievements-month-tag") != nowTag {
            defaults.set(nowTag, forKey: "askbible-achievements-month-tag")
            defaults.set(listenSeconds, forKey: "askbible-achievements-month-anchor")
        }
    }

    func value(for metric: MedalMetric) -> Int {
        switch metric {
        case .chaptersOpened: return s.chaptersOpened
        case .chaptersRead: return s.chaptersRead.count
        case .readingDays: return readingDays
        case .streakDays: return streakDays
        case .favorites: return favoritesCount
        case .sameBookStreak: return s.comboCount
        case .listenHours: return Int(listenSeconds) / 3600
        case .listenHoursThisMonth: return listenHoursThisMonth
        case .morningDays: return s.morningDates.count
        case .nightDays: return s.nightDates.count
        case .booksCompleted: return completedBookIds.count
        case .otBooksCompleted: return otBooksCompleted
        case .ntBooksCompleted: return ntBooksCompleted
        case .bothTestaments: return min(otBooksCompleted, ntBooksCompleted)
        case .fullWeeks: return fullWeeks
        case .planDays: return planDays
        }
    }

    // MARK: XP

    /// 连续天数带来的倍率。取「当前连续天数」与「历史最长」的较大者——断签后倍率不掉回去
    /// （Josh 2026-09-18 拍板 A 方案：爽感保留，「一天没读就全毁了」的负反馈去掉）
    var streakMultiplier: Double {
        let days = max(streakDays, s.bestStreakDays)
        return min(1 + Double(days) * MedalXP.streakPerDay, MedalXP.streakCap)
    }

    /// 基础 XP：完全由 ledger 推出来，只增不减
    var baseXP: Int {
        var xp = 0
        xp += s.versesRead * MedalXP.perVerseRead
        xp += s.listenTicks * MedalXP.perListenTick
        xp += s.chaptersRead.count * MedalXP.perChapterRead
        xp += completedBookIds.count * MedalXP.perBookCompleted
        xp += readingDays * MedalXP.perReadingDay
        xp += favoritesCount * MedalXP.perFavorite
        xp += highlightsCount * MedalXP.perHighlight
        xp += planDays * MedalXP.perPlanDay
        xp += s.earned.values.reduce(0) { $0 + $1.tier } * MedalXP.perMedalTier
        xp += s.seals.count * MedalXP.perSeal
        return xp
    }

    var xpInLevel: Int { totalXP - MedalLevels.floor(level) }
    var xpForLevel: Int { max(1, MedalLevels.ceiling(level) - MedalLevels.floor(level)) }
    var levelProgress: Double { min(1, max(0, Double(xpInLevel) / Double(xpForLevel))) }

    /// 把「当下」的加成记进去（倍率高于 1 的那部分才算加成，基础部分已在 baseXP 里）
    private func addBonus(base: Int) -> Int {
        let bonus = Int((Double(base) * (streakMultiplier - 1)).rounded())
        if bonus > 0 { s.bonusXP += bonus }
        return bonus
    }

    // MARK: 上报

    /// 打开了某一章
    func noteChapterOpened(bookId: String, chapter: Int) {
        rollMonthAnchorIfNeeded()
        s.chaptersOpened += 1
        let today = PlanDates.localDateString(now())
        if s.lastOpenDay != today {
            s.lastOpenDay = today
            emit(.xp(MedalXP.firstOpenOfDay + addBonus(base: MedalXP.firstOpenOfDay), reason: "firstOpenOfDay"))
        }
        refresh()
    }

    /// 读过 n 节经文（滚动经过即算，微反馈）
    func noteVersesRead(_ n: Int) {
        guard n > 0 else { return }
        s.versesRead += n
        let base = n * MedalXP.perVerseRead
        emit(.xp(base + addBonus(base: base), reason: "verses"))
        refresh()
    }

    /// 听读又过了一片（由播放器每 listenTickSeconds 调一次）。
    /// 三重约束（A 方案）：App 在前台、确实在播、且同一章最多给 listenTicksPerChapterCap 片——挂机放整夜刷不出 XP。
    func noteListenTick(bookId: String, chapter: Int) {
        guard foreground else { return }
        let key = "\(bookId.uppercased()):\(chapter)"
        if s.listenChapterKey != key { s.listenChapterKey = key; s.listenChapterTicks = 0 }
        guard s.listenChapterTicks < MedalXP.listenTicksPerChapterCap else { return }
        s.listenChapterTicks += 1
        s.listenTicks += 1
        let base = MedalXP.perListenTick
        emit(.xp(base + addBonus(base: base), reason: "listen"))
        refresh()
    }

    /// 读完一章：唯一会点亮书卷印章的入口
    func noteChapterRead(bookId: String, chapter: Int) {
        let id = bookId.uppercased()
        let key = "\(id):\(chapter)"
        guard s.chaptersRead[key] == nil else { return }   // 重读不重复给
        s.chaptersRead[key] = now().timeIntervalSince1970

        // combo：连着读同一卷
        if s.comboBookId == id { s.comboCount += 1 } else { s.comboBookId = id; s.comboCount = 1 }
        let combo = s.comboCount >= 2 ? min((s.comboCount - 1) * MedalXP.comboStep, MedalXP.comboCap) : 0
        if combo > 0 { s.bonusXP += combo }

        let base = MedalXP.perChapterRead
        emit(.xp(base + addBonus(base: base) + combo, reason: "chapter"))
        emit(.chapterRead(id, chapter))

        // 晨 / 夜标记
        let hour = Calendar.current.component(.hour, from: now())
        let today = PlanDates.localDateString(now())
        if (5...8).contains(hour), !s.morningDates.contains(today) { s.morningDates.append(today) }
        if hour >= 21 || hour < 2, !s.nightDates.contains(today) { s.nightDates.append(today) }

        // 整卷读完 → 点亮印章
        if let book = BibleCatalog.all.first(where: { $0.id == id }),
           (readByBook[id]?.count ?? 0) >= book.chapterCount, s.seals[id] == nil {
            s.seals[id] = now().timeIntervalSince1970
            emit(.sealEarned(id))
            emit(.xp(MedalXP.perSeal + MedalXP.perBookCompleted, reason: "book"))
        }
        refresh()
    }

    // MARK: 评估 + 刷新

    /// 重算勋章 / XP / 等级；新达成的档位入队。云端同步进来也调一次，漏发的在这里补上。
    @discardableResult
    func refresh() -> [Event] {
        let beforeLevel = level
        var events: [Event] = []
        for def in MedalCatalog.all {
            let v = value(for: def.metric)
            var top = 0
            for (i, t) in def.tiers.enumerated() where v >= t { top = i + 1 }
            guard top > 0 else { continue }
            let had = s.earned[def.key]?.tier ?? 0
            if top > had {
                s.earned[def.key] = Earned(tier: top, at: now().timeIntervalSince1970)
                events.append(.medal(key: def.key, tier: top))
            }
        }
        // 连续天数的历史峰值：只升不降
        if streakDays > s.bestStreakDays { s.bestStreakDays = streakDays }
        earned = s.earned
        seals = s.seals
        chaptersReadCount = s.chaptersRead.count
        totalXP = baseXP + s.bonusXP
        level = MedalLevels.level(xp: totalXP)
        if level > beforeLevel { events.append(.levelUp(level)) }
        for e in events { emit(e) }
        return events
    }

    private func emit(_ e: Event) {
        // 飘字合并：连着来的 +XP 合成一条，免得刷屏
        if case .xp(let n, let r) = e, case .xp(let prev, let pr)? = pending.last, pr == r {
            pending[pending.count - 1] = .xp(prev + n, reason: r)
            return
        }
        pending.append(e)
        if pending.count > 24 { pending.removeFirst(pending.count - 24) }
    }

    func consume() { if !pending.isEmpty { pending.removeFirst() } }

    // MARK: 会员同步

    /// 账本里有没有值得上云的东西（空账本不推，免得覆盖别的设备）
    var hasProgress: Bool {
        !s.chaptersRead.isEmpty || !s.earned.isEmpty || !s.seals.isEmpty
            || s.versesRead > 0 || s.listenTicks > 0 || s.chaptersOpened > 0 || s.bonusXP > 0
            || !s.morningDates.isEmpty || !s.nightDates.isEmpty
    }

    var syncJSON: [String: Any] {
        ["version": 1,
         "chaptersRead": s.chaptersRead.mapValues { Int($0) },
         "versesRead": s.versesRead,
         "listenTicks": s.listenTicks,
         "chaptersOpened": s.chaptersOpened,
         "morningDates": s.morningDates,
         "nightDates": s.nightDates,
         "bonusXP": s.bonusXP,
         "bestStreakDays": s.bestStreakDays,
         "earned": s.earned.mapValues { ["tier": $0.tier, "at": Int($0.at)] },
         "seals": s.seals.mapValues { Int($0) }]
    }

    /// 云端并入本机：所有计数取较大值，集合取并集，勋章取更高档——合并后绝不回退
    func mergeRemote(_ json: [String: Any]) {
        suppressChangeNotify = true
        defer { suppressChangeNotify = false }
        var n = s
        if let m = json["chaptersRead"] as? [String: Any] {
            for (k, v) in m {
                let at = MemberReadingSyncRules.num(v) ?? 0
                if let cur = n.chaptersRead[k] { n.chaptersRead[k] = min(cur, at > 0 ? at : cur) } else { n.chaptersRead[k] = at }
            }
        }
        n.versesRead = max(n.versesRead, Int(MemberReadingSyncRules.num(json["versesRead"]) ?? 0))
        n.listenTicks = max(n.listenTicks, Int(MemberReadingSyncRules.num(json["listenTicks"]) ?? 0))
        n.chaptersOpened = max(n.chaptersOpened, Int(MemberReadingSyncRules.num(json["chaptersOpened"]) ?? 0))
        n.bonusXP = max(n.bonusXP, Int(MemberReadingSyncRules.num(json["bonusXP"]) ?? 0))
        n.bestStreakDays = max(n.bestStreakDays, Int(MemberReadingSyncRules.num(json["bestStreakDays"]) ?? 0))
        n.morningDates = MemberReadingSyncRules.normalizeDates(n.morningDates + MemberReadingSyncRules.stringArray(json["morningDates"]))
        n.nightDates = MemberReadingSyncRules.normalizeDates(n.nightDates + MemberReadingSyncRules.stringArray(json["nightDates"]))
        if let m = json["earned"] as? [String: Any] {
            for (k, v) in m {
                guard let o = v as? [String: Any], let tier = MemberReadingSyncRules.num(o["tier"]), tier >= 1 else { continue }
                let at = MemberReadingSyncRules.num(o["at"]) ?? 0
                if let cur = n.earned[k], cur.tier >= Int(tier) { continue }
                n.earned[k] = Earned(tier: Int(tier), at: at)
            }
        }
        if let m = json["seals"] as? [String: Any] {
            for (k, v) in m where n.seals[k] == nil { n.seals[k] = MemberReadingSyncRules.num(v) ?? 0 }
        }
        s = n
        refresh()
    }

    /// 换帐号 / 退出：成就跟着帐号走，清空本机
    func clearForAccountSwitch() {
        suppressChangeNotify = true
        s = Snapshot()
        suppressChangeNotify = false
        pending = []
        refresh()
    }
}
