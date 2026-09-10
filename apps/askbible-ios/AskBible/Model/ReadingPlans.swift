import Foundation

// 读经计划的纯逻辑，逐行对应共享库 lib/bible/reading-plans/* 与 lib/read/*：
// 日期与历元、偏好、三循环指针、新约深读 52 阶。全部无 IO，可被对拍 harness 直接编译。

// MARK: - 日期

/// 对应 lib/read/reading-plan-epoch.ts + reading-plan-prefs 里的本地日期工具
enum PlanDates {
    static let easterEpoch = "2026-04-05"

    /// yyyy-MM-dd（本地时区）
    static func localDateString(_ d: Date = Date()) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: d)
        return String(format: "%04d-%02d-%02d", c.year ?? 1970, c.month ?? 1, c.day ?? 1)
    }

    /// 对应 parseLocalDate：只校验范围（月 1–12、日 1–31），31 日落在小月会像 JS Date 一样顺延
    static func parseLocalDate(_ s: String) -> (y: Int, m: Int, d: Int)? {
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        let parts = t.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 3, parts[0].count == 4, parts[1].count == 2, parts[2].count == 2,
              let y = Int(parts[0]), let m = Int(parts[1]), let d = Int(parts[2]),
              m >= 1, m <= 12, d >= 1, d <= 31 else { return nil }
        return (y, m, d)
    }

    /// 公历日序号（Howard Hinnant days_from_civil），d 溢出时线性顺延，与 Date.UTC 行为一致
    static func daysFromCivil(_ y0: Int, _ m: Int, _ d: Int) -> Int {
        let y = m <= 2 ? y0 - 1 : y0
        let era = (y >= 0 ? y : y - 399) / 400
        let yoe = y - era * 400
        let mp = (m + 9) % 12
        let doy = (153 * mp + 2) / 5 + d - 1
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
        return era * 146097 + doe - 719468
    }

    static func daysBetween(_ from: String, _ to: String) -> Int {
        guard let a = parseLocalDate(from), let b = parseLocalDate(to) else { return 0 }
        return daysFromCivil(b.y, b.m, b.d) - daysFromCivil(a.y, a.m, a.d)
    }

    static func jan1(_ year: Int) -> String { String(format: "%04d-01-01", year) }

    /// 自复活节历元起的第几天（≥ 1）
    static func daySinceEpoch(_ now: Date = Date()) -> Int {
        max(1, daysBetween(easterEpoch, localDateString(now)) + 1)
    }

    static func addDays(_ date: Date, _ days: Int) -> Date {
        Calendar.current.date(byAdding: .day, value: days, to: date) ?? date
    }
}

// MARK: - 偏好

enum PlanAnchor: String, Codable {
    case fromToday = "from-today"
    case calendarJan1 = "calendar-jan1"
    case calendarEaster = "calendar-easter"
}

/// 对应 ReadingPlanPrefs（askbible-reading-plan-prefs-v1）
struct ReadingPlanPrefs: Codable, Equatable {
    var version: Int = 1
    var planId: String
    var anchor: PlanAnchor
    var startedOn: String?
    var dayCount: Int?
    var aheadDays: Int?
    var ntDeepRepeatPace: Int?
    var chosen: Bool?
    var selectedAt: String?

    /// 隐式默认：三循环、复活节历元
    static func defaultPrefs() -> ReadingPlanPrefs {
        ReadingPlanPrefs(planId: ReadingPlanCatalog.tripleLoopId, anchor: .calendarEaster,
                         startedOn: PlanDates.easterEpoch, dayCount: 1)
    }

    var ahead: Int { max(0, aheadDays ?? 0) }
    var isTripleLoop: Bool { planId == ReadingPlanCatalog.tripleLoopId }
    var isNtDeepRepeat: Bool { planId == ReadingPlanCatalog.ntDeepRepeatId }
    var isPointerPlan: Bool { isTripleLoop || isNtDeepRepeat }

    /// 对应 parseReadingPlanPrefs 的归一化：非法就整份作废
    static func parse(_ data: Data) -> ReadingPlanPrefs? {
        guard let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              raw["version"] as? Int == 1,
              let planId = (raw["planId"] as? String)?.trimmingCharacters(in: .whitespaces), !planId.isEmpty,
              let anchorRaw = raw["anchor"] as? String, let anchor = PlanAnchor(rawValue: anchorRaw) else { return nil }
        let startedOn = (raw["startedOn"] as? String)?.trimmingCharacters(in: .whitespaces)
        if anchor == .fromToday, startedOn == nil || startedOn == "" { return nil }
        let dayCount = (raw["dayCount"] as? Int).flatMap { $0 > 0 ? $0 : nil }
        let aheadDays = (raw["aheadDays"] as? Int).flatMap { $0 > 0 ? $0 : nil }
        let paceRaw = raw["ntDeepRepeatPace"] as? Int
        let pace = NtDeepRepeat.paces.contains(paceRaw ?? -1) ? paceRaw
            : (planId == ReadingPlanCatalog.ntDeepRepeatId ? NtDeepRepeat.defaultPace : nil)
        return ReadingPlanPrefs(planId: planId, anchor: anchor,
                                startedOn: anchor == .calendarEaster ? PlanDates.easterEpoch : (startedOn?.isEmpty == false ? startedOn : nil),
                                dayCount: dayCount, aheadDays: aheadDays, ntDeepRepeatPace: pace,
                                chosen: raw["chosen"] as? Bool == true ? true : nil,
                                selectedAt: raw["selectedAt"] as? String)
    }
}

enum ReadingPlanRules {
    /// 对应 resolveReadingPlanDayIndex：日历类计划今天对应第几天（0 起，封顶 dayCount-1）
    static func dayIndex(_ prefs: ReadingPlanPrefs, dayCount: Int, now: Date = Date()) -> Int {
        guard dayCount >= 1 else { return 0 }
        let today = PlanDates.localDateString(now)
        var offset: Int
        switch prefs.anchor {
        case .calendarJan1:
            let year = Calendar.current.component(.year, from: now)
            offset = PlanDates.daysBetween(PlanDates.jan1(year), today)
        case .calendarEaster:
            offset = PlanDates.daysBetween(PlanDates.easterEpoch, today)
        case .fromToday:
            offset = PlanDates.daysBetween(prefs.startedOn ?? today, today)
        }
        if offset < 0 { offset = 0 }
        return offset >= dayCount ? dayCount - 1 : offset
    }

    /// 加上超前天数后的日课下标
    static func effectiveDayIndex(_ prefs: ReadingPlanPrefs, dayCount: Int, now: Date = Date()) -> Int {
        guard dayCount >= 1 else { return 0 }
        let next = dayIndex(prefs, dayCount: dayCount, now: now) + prefs.ahead
        return min(max(0, next), dayCount - 1)
    }

    /// 对应 resolveNtDeepRepeatPlanDay：自选定日起第几天
    static func ntPlanDay(_ prefs: ReadingPlanPrefs, now: Date = Date()) -> Int {
        let today = PlanDates.localDateString(now)
        let start = (prefs.startedOn?.trimmingCharacters(in: .whitespaces)).flatMap { $0.isEmpty ? nil : $0 } ?? today
        return max(1, PlanDates.daysBetween(start, today) + 1)
    }

    /// 对应 resolveEffectiveEpochDay：指针类计划显示的「第 N 天」
    static func effectiveEpochDay(_ prefs: ReadingPlanPrefs, now: Date = Date()) -> Int {
        if prefs.isNtDeepRepeat { return ntPlanDay(prefs, now: now) + prefs.ahead }
        return PlanDates.daySinceEpoch(now) + prefs.ahead
    }
}

// MARK: - 读经项

struct PlanPointer: Codable, Equatable, Hashable {
    var bookId: String
    var chapter: Int
}

/// 对应 ReadingPlanRange（节号是提示，章链接只用 startChapter）
struct PlanReading: Hashable {
    let bookId: String
    let startChapter: Int
    let endChapter: Int
    var startVerse: Int? = nil
    var endVerse: Int? = nil
    var label: String = ""

    /// 对应 formatReadingPlanRange（不带 locale 的那条分支）：「创世记 1」「创世记 1–3」「创世记 1:1–5」
    var display: String {
        let name = BibleCatalog.book(id: bookId)?.name(AppLocale.current) ?? bookId
        if startChapter == endChapter {
            if let sv = startVerse, let ev = endVerse {
                return sv == ev ? "\(name) \(startChapter):\(sv)" : "\(name) \(startChapter):\(sv)–\(ev)"
            }
            return "\(name) \(startChapter)"
        }
        if let sv = startVerse, let ev = endVerse { return "\(name) \(startChapter):\(sv)–\(endChapter):\(ev)" }
        return "\(name) \(startChapter)–\(endChapter)"
    }

    /// 展开成逐章队列
    var chapters: [PlanPointer] {
        let s = max(1, startChapter), e = max(s, endChapter)
        return (s...e).map { PlanPointer(bookId: bookId, chapter: $0) }
    }
}

// MARK: - 三循环

enum TripleTrack: String, CaseIterable, Codable {
    case ot, nt, wisdom
}

/// 对应 TripleLoopReadingState（归一化后的形态：chaptersRead 永远是列表长度）
struct TripleLoopState: Codable, Equatable {
    var ot: PlanPointer
    var nt: PlanPointer
    var wisdom: PlanPointer
    var chaptersReadKeys: [String: [String]] = ["ot": [], "nt": [], "wisdom": []]
    var chaptersRead: [String: Int] = ["ot": 0, "nt": 0, "wisdom": 0]
    var startedAt: String?

    subscript(track: TripleTrack) -> PlanPointer {
        get { switch track { case .ot: return ot; case .nt: return nt; case .wisdom: return wisdom } }
        set { switch track { case .ot: ot = newValue; case .nt: nt = newValue; case .wisdom: wisdom = newValue } }
    }
}

enum TripleLoop {
    static let wisdomIds = ["JOB", "PSA", "PRO", "ECC", "SNG"]
    private static let ntStart = BibleCatalog.all.firstIndex { $0.id == "MAT" } ?? BibleCatalog.all.count
    static let otOrder: [String] = BibleCatalog.all.prefix(ntStart).filter { !wisdomIds.contains($0.id) }.map { $0.id }
    static let ntOrder: [String] = BibleCatalog.all.dropFirst(ntStart).map { $0.id }
    static let wisdomOrder: [String] = wisdomIds
    /// 圣经首页今日读经展示顺序：新约 → 智慧诗 → 旧约
    static let displayTracks: [TripleTrack] = [.nt, .wisdom, .ot]

    static func order(_ track: TripleTrack) -> [String] {
        switch track { case .ot: return otOrder; case .nt: return ntOrder; case .wisdom: return wisdomOrder }
    }

    static func chapters(_ bookId: String) -> Int { BibleCatalog.book(id: bookId)?.chapterCount ?? 0 }

    static func defaultState() -> TripleLoopState {
        TripleLoopState(ot: PlanPointer(bookId: "GEN", chapter: 1), nt: PlanPointer(bookId: "MAT", chapter: 1),
                        wisdom: PlanPointer(bookId: "JOB", chapter: 1))
    }

    private static func normalizePointer(_ bookId: String, _ chapter: Int, in order: [String]) -> PlanPointer {
        guard let first = order.first else { return PlanPointer(bookId: "GEN", chapter: 1) }
        let bid = order.contains(bookId) ? bookId : first
        let max = chapters(bid)
        guard max >= 1 else { return PlanPointer(bookId: first, chapter: 1) }
        return PlanPointer(bookId: bid, chapter: min(Swift.max(1, chapter), max))
    }

    /// 对应 normalizeTripleLoopChaptersReadKeys：只留含冒号的字符串，去重保序
    static func normalizeKeys(_ raw: [String: [String]]?) -> [String: [String]] {
        var out: [String: [String]] = [:]
        for t in TripleTrack.allCases {
            var seen = Set<String>()
            out[t.rawValue] = (raw?[t.rawValue] ?? []).filter { $0.contains(":") && seen.insert($0).inserted }
        }
        return out
    }

    /// 对应 normalizeTripleLoopReadingState
    static func normalize(_ raw: TripleLoopState?) -> TripleLoopState {
        let d = defaultState()
        guard let raw else { return d }
        let keys = normalizeKeys(raw.chaptersReadKeys)
        var s = TripleLoopState(
            ot: normalizePointer(raw.ot.bookId.isEmpty ? d.ot.bookId : raw.ot.bookId, raw.ot.chapter == 0 ? 1 : raw.ot.chapter, in: otOrder),
            nt: normalizePointer(raw.nt.bookId.isEmpty ? d.nt.bookId : raw.nt.bookId, raw.nt.chapter == 0 ? 1 : raw.nt.chapter, in: ntOrder),
            wisdom: normalizePointer(raw.wisdom.bookId.isEmpty ? d.wisdom.bookId : raw.wisdom.bookId, raw.wisdom.chapter == 0 ? 1 : raw.wisdom.chapter, in: wisdomOrder),
            chaptersReadKeys: keys)
        s.chaptersRead = ["ot": keys["ot"]!.count, "nt": keys["nt"]!.count, "wisdom": keys["wisdom"]!.count]
        let started = raw.startedAt?.trimmingCharacters(in: .whitespaces)
        s.startedAt = (started?.isEmpty == false) ? started : nil
        return s
    }

    static func advancePointer(_ p: PlanPointer, order: [String]) -> PlanPointer {
        let maxCh = chapters(p.bookId)
        let idx = order.firstIndex(of: p.bookId) ?? 0
        if maxCh >= 1, p.chapter < maxCh { return PlanPointer(bookId: p.bookId, chapter: p.chapter + 1) }
        return PlanPointer(bookId: order[(idx + 1) % order.count], chapter: 1)
    }

    static func advanceTrack(_ state: TripleLoopState, _ track: TripleTrack) -> TripleLoopState {
        var s = state
        s[track] = advancePointer(state[track], order: order(track))
        return s
    }

    static func advanceOneDay(_ state: TripleLoopState) -> TripleLoopState {
        var s = state
        for t in TripleTrack.allCases { s[t] = advancePointer(state[t], order: order(t)) }
        return s
    }

    static func stateForPlanDay(_ planDay: Int) -> TripleLoopState {
        var s = defaultState()
        for _ in 0..<max(0, planDay - 1) { s = advanceOneDay(s) }
        return s
    }

    static func pointerProgress(_ p: PlanPointer, order: [String]) -> Int {
        (order.firstIndex(of: p.bookId) ?? 0) * 10_000 + p.chapter
    }

    static func pointersEqual(_ a: TripleLoopState, _ b: TripleLoopState) -> Bool {
        TripleTrack.allCases.allSatisfy { a[$0] == b[$0] }
    }

    /// 对应 snapTripleLoopStateToPlanDay：任一轨落后于日历位置就抬到日历位置
    static func snapToPlanDay(_ state: TripleLoopState, _ planDay: Int) -> TripleLoopState {
        let floor = stateForPlanDay(planDay)
        var next = state
        for t in TripleTrack.allCases {
            let o = order(t)
            next[t] = pointerProgress(state[t], order: o) >= pointerProgress(floor[t], order: o) ? state[t] : floor[t]
        }
        next.chaptersReadKeys = state.chaptersReadKeys
        next.startedAt = state.startedAt
        return normalize(next)
    }

    /// 对应 clipCoordinatedTripleLoopAheadToPlanDay：三轨齐齐超前（多半是超前天数回退了）才整体拉回
    static func clipCoordinatedAhead(_ state: TripleLoopState, _ planDay: Int) -> TripleLoopState {
        let floor = stateForPlanDay(planDay)
        let allAhead = TripleTrack.allCases.allSatisfy {
            pointerProgress(state[$0], order: order($0)) > pointerProgress(floor[$0], order: order($0))
        }
        guard allAhead else { return state }
        var next = floor
        next.chaptersReadKeys = state.chaptersReadKeys
        next.startedAt = state.startedAt
        return normalize(next)
    }

    /// 自己选了「从今天开始第 1 天」时的计划天数：按 startedAt 算，而不是复活节历元。
    /// 没自选起点（startedAt 空或就是历元）就还是历元那套。
    static func planDay(for state: TripleLoopState, hasSaved: Bool, now: Date = Date()) -> Int {
        guard hasSaved, let started = state.startedAt, started != PlanDates.easterEpoch,
              PlanDates.parseLocalDate(started) != nil else { return PlanDates.daySinceEpoch(now) }
        return max(1, PlanDates.daysBetween(started, PlanDates.localDateString(now)) + 1)
    }

    /// 对应 resolveEffectiveTripleLoopProgress。三轨永远不落后于「第几天」的地板位置；
    /// 地板按 planDay(for:) 算，用户自选起点时那条线就从他的起点走（原生新增，RN 只有历元一种）
    static func resolveEffective(stored: TripleLoopState, hasSaved: Bool, now: Date = Date(), aheadDays: Int = 0) -> TripleLoopState {
        let planDay = max(1, planDay(for: stored, hasSaved: hasSaved, now: now) + max(0, aheadDays))
        var base = hasSaved ? stored : stateForPlanDay(PlanDates.daySinceEpoch(now))
        if !hasSaved { base.startedAt = PlanDates.easterEpoch }
        return clipCoordinatedAhead(snapToPlanDay(base, planDay), planDay)
    }

    static func trackFor(bookId: String) -> TripleTrack? {
        if otOrder.contains(bookId) { return .ot }
        if ntOrder.contains(bookId) { return .nt }
        if wisdomOrder.contains(bookId) { return .wisdom }
        return nil
    }

    static func chapterKey(_ bookId: String, _ chapter: Int) -> String {
        "\(bookId.trimmingCharacters(in: .whitespaces).uppercased()):\(chapter)"
    }

    /// 对应 addUserChapterReadToState
    static func addChapterRead(_ state: TripleLoopState, bookId: String, chapter: Int) -> TripleLoopState {
        guard let track = trackFor(bookId: bookId) else { return state }
        let key = chapterKey(bookId, chapter)
        var keys = normalizeKeys(state.chaptersReadKeys)
        if keys[track.rawValue]!.contains(key) { return state }
        keys[track.rawValue]!.append(key)
        var s = state
        s.chaptersReadKeys = keys
        s.chaptersRead = ["ot": keys["ot"]!.count, "nt": keys["nt"]!.count, "wisdom": keys["wisdom"]!.count]
        return s
    }

    static func trackTitle(_ track: TripleTrack) -> String {
        switch track { case .ot: return PlanCopy.t("pages.read.tripleLoopTrackOt"); case .nt: return PlanCopy.t("pages.read.tripleLoopTrackNt"); case .wisdom: return PlanCopy.t("pages.read.tripleLoopTrackWisdom") }
    }

    /// 「创世记 第 1 章」「诗篇 第 23 篇」
    static func formatVerbose(_ bookId: String, _ chapter: Int) -> String {
        let name = BibleCatalog.book(id: bookId)?.name(AppLocale.current) ?? bookId
        return PlanCopy.f("pages.read.tripleLoopReadingLine", ["name": name, "chapter": "\(chapter)", "unit": PlanCopy.t(bookId == "PSA" ? "pages.read.tripleLoopPsalmUnit" : "pages.read.tripleLoopChapterUnit")])
    }

    static func trackChapterTotal(_ track: TripleTrack) -> Int { order(track).reduce(0) { $0 + chapters($1) } }

    static func chaptersBefore(_ track: TripleTrack, _ p: PlanPointer) -> Int {
        let o = order(track)
        guard let idx = o.firstIndex(of: p.bookId) else { return 0 }
        let before = o.prefix(idx).reduce(0) { $0 + chapters($1) }
        let maxCh = max(1, chapters(p.bookId))
        return before + min(max(1, p.chapter), maxCh) - 1
    }

    /// 对应 computeTripleLoopTrackBarProgress
    static func barProgress(_ state: TripleLoopState, _ track: TripleTrack, currentChapterFraction: Double = 0) -> Double {
        let total = trackChapterTotal(track)
        guard total > 0 else { return 0 }
        let frac = min(1, max(0, currentChapterFraction))
        return min(1, max(0, (Double(chaptersBefore(track, state[track])) + frac) / Double(total)))
    }

    /// 对应 buildTripleLoopReadingPlanDay：新约 → 智慧诗 → 旧约
    static func readings(_ state: TripleLoopState) -> [PlanReading] {
        displayTracks.map { t in
            let p = state[t]
            return PlanReading(bookId: p.bookId, startChapter: p.chapter, endChapter: p.chapter,
                               label: "\(trackTitle(t))：\(formatVerbose(p.bookId, p.chapter))")
        }
    }
}

// MARK: - 新约深读 · 旧约通读

struct NtSegment: Hashable {
    let ranges: [PlanReading]
    var key: String { ranges.map { "\($0.bookId):\($0.startChapter)-\($0.endChapter)" }.joined(separator: "|") }
    var primary: PlanReading { ranges[0] }
    func includes(bookId: String, chapter: Int) -> Bool {
        let id = bookId.trimmingCharacters(in: .whitespaces).uppercased()
        return ranges.contains { $0.bookId == id && chapter >= $0.startChapter && chapter <= $0.endChapter }
    }
}

/// 对应 NtDeepRepeatReadingState
struct NtDeepRepeatState: Codable, Equatable {
    var ot: PlanPointer
    var curriculumIndex: Int
    var dayInSegment: Int
    var pace: Int
    var segmentDayTarget: Int
    var chaptersReadKeys: [String: [String]] = ["ot": [], "nt": []]
    var chaptersRead: [String: Int] = ["ot": 0, "nt": 0]
    var startedAt: String?
}

enum NtTrack: String { case ot, nt }

enum NtDeepRepeat {
    static let paces = [7, 14, 28]
    static let defaultPace = 7
    /// 与 nt-deep-repeat-curriculum.ts 的 CURRICULUM_UNITS 同：单元内按章累计切分
    static let units: [(bookIds: [String], sizes: [Int])] = [
        (["1JN"], [5]), (["JHN"], [5, 5, 5, 6]), (["PHP", "COL"], [4, 4]),
        (["MAT"], [4, 4, 4, 4, 4, 4, 4]), (["ACT"], [4, 4, 4, 4, 4, 4, 4]), (["MRK"], [5, 5, 6]),
        (["ROM"], [5, 5, 6]), (["GAL"], [6]), (["EPH"], [6]), (["1TH", "2TH"], [5, 3]),
        (["1CO"], [5, 5, 6]), (["2CO"], [5, 5, 3]), (["1TI"], [6]), (["2TI", "TIT", "PHM"], [4, 4]),
        (["HEB"], [5, 5, 3]), (["1PE", "2PE"], [5, 3]), (["JAS", "2JN", "3JN", "JUD"], [5, 3]),
        (["REV"], [5, 5, 5, 4, 3]),
    ]
    static let ntBookIds: [String] = {
        var seen = Set<String>(); var out: [String] = []
        for u in units { for b in u.bookIds where seen.insert(b).inserted { out.append(b) } }
        return out
    }()
    private static let ntStart = BibleCatalog.all.firstIndex { $0.id == "MAT" } ?? BibleCatalog.all.count
    static let otOrder: [String] = BibleCatalog.all.prefix(ntStart).map { $0.id }

    static let curriculum: [NtSegment] = {
        var out: [NtSegment] = []
        for u in units {
            let total = u.bookIds.reduce(0) { $0 + TripleLoop.chapters($1) }
            precondition(u.sizes.reduce(0, +) == total, "nt-deep-repeat curriculum: \(u.bookIds) sizes != chapters")
            var absStart = 1
            for size in u.sizes {
                let absEnd = absStart + size - 1
                var ranges: [PlanReading] = []
                var offset = 0
                for b in u.bookIds {
                    let ch = TripleLoop.chapters(b)
                    let bookStart = offset + 1, bookEnd = offset + ch
                    let s = max(absStart, bookStart), e = min(absEnd, bookEnd)
                    if s <= e { ranges.append(PlanReading(bookId: b, startChapter: s - offset, endChapter: e - offset)) }
                    offset += ch
                }
                out.append(NtSegment(ranges: ranges))
                absStart = absEnd + 1
            }
        }
        precondition(out.count == 52, "nt-deep-repeat curriculum: expected 52 stages")
        return out
    }()
    static var stageCount: Int { curriculum.count }

    static func segment(_ index: Int) -> NtSegment? {
        guard !curriculum.isEmpty else { return nil }
        let n = curriculum.count
        return curriculum[((index % n) + n) % n]
    }

    static func isPace(_ v: Int?) -> Bool { v.map { paces.contains($0) } ?? false }
    static func oneCycleDays(_ pace: Int) -> Int { stageCount * pace }

    static func formatApproxDurationZh(_ days: Int) -> String {
        if days < 60 { return SiteCopy.f("native.durationDays", ["n": "\(days)"]) }
        let months = Double(days) / 30.44
        if months < 18 { return SiteCopy.f("native.durationMonths", ["n": "\(Int(months.rounded()))"]) }
        return SiteCopy.f("native.durationYears", ["n": String(format: "%.1f", Double(days) / 365.25)])
    }

    static func defaultState(pace: Int = defaultPace, now: Date = Date()) -> NtDeepRepeatState {
        NtDeepRepeatState(ot: PlanPointer(bookId: "GEN", chapter: 1), curriculumIndex: 0, dayInSegment: 1,
                          pace: pace, segmentDayTarget: pace, startedAt: PlanDates.localDateString(now))
    }

    private static func normalizePointer(_ bookId: String, _ chapter: Int) -> PlanPointer {
        guard let first = otOrder.first else { return PlanPointer(bookId: "GEN", chapter: 1) }
        let bid = otOrder.contains(bookId) ? bookId : first
        let max = TripleLoop.chapters(bid)
        guard max >= 1 else { return PlanPointer(bookId: bid, chapter: 1) }
        return PlanPointer(bookId: bid, chapter: min(Swift.max(1, chapter), max))
    }

    static func normalizeKeys(_ raw: [String: [String]]?) -> [String: [String]] {
        ["ot": (raw?["ot"] ?? []).filter { !$0.isEmpty }, "nt": (raw?["nt"] ?? []).filter { !$0.isEmpty }]
    }

    static func segmentDayTarget(_ state: NtDeepRepeatState) -> Int {
        state.segmentDayTarget > 0 ? state.segmentDayTarget : state.pace
    }

    /// 对应 normalizeNtDeepRepeatReadingState
    static func normalize(_ raw: NtDeepRepeatState?, now: Date = Date()) -> NtDeepRepeatState {
        let pace = isPace(raw?.pace) ? raw!.pace : defaultPace
        let startedTrim = raw?.startedAt?.trimmingCharacters(in: .whitespaces)
        let startedAt = (startedTrim?.isEmpty == false) ? startedTrim! : PlanDates.localDateString(now)
        var d = defaultState(pace: pace, now: now)
        d.startedAt = startedAt
        guard let raw else { return d }
        let idx = max(0, raw.curriculumIndex)
        let target = raw.segmentDayTarget > 0 ? raw.segmentDayTarget : pace
        let day = min(target, max(1, raw.dayInSegment))
        let keys = normalizeKeys(raw.chaptersReadKeys)
        return NtDeepRepeatState(
            ot: normalizePointer(raw.ot.bookId.isEmpty ? "GEN" : raw.ot.bookId, raw.ot.chapter == 0 ? 1 : raw.ot.chapter),
            curriculumIndex: idx, dayInSegment: day, pace: pace, segmentDayTarget: target,
            chaptersReadKeys: keys, chaptersRead: ["ot": keys["ot"]!.count, "nt": keys["nt"]!.count],
            startedAt: startedAt)
    }

    static func currentSegment(_ state: NtDeepRepeatState) -> NtSegment? { segment(state.curriculumIndex) }

    static func trackFor(bookId: String) -> NtTrack? {
        let id = bookId.trimmingCharacters(in: .whitespaces).uppercased()
        if otOrder.contains(id) { return .ot }
        if ntBookIds.contains(id) { return .nt }
        return nil
    }

    static func chapterKey(_ bookId: String, _ chapter: Int) -> String {
        "\(bookId.trimmingCharacters(in: .whitespaces).uppercased()):\(max(1, chapter))"
    }

    static func addChapterRead(_ state: NtDeepRepeatState, bookId: String, chapter: Int, track: NtTrack? = nil) -> NtDeepRepeatState {
        guard let t = track ?? trackFor(bookId: bookId) else { return state }
        let key = chapterKey(bookId, chapter)
        var keys = normalizeKeys(state.chaptersReadKeys)
        if keys[t.rawValue]!.contains(key) { return state }
        keys[t.rawValue]!.append(key)
        var s = state
        s.chaptersReadKeys = keys
        s.chaptersRead = ["ot": keys["ot"]!.count, "nt": keys["nt"]!.count]
        return s
    }

    static func advanceOtPointer(_ p: PlanPointer) -> PlanPointer {
        let maxCh = TripleLoop.chapters(p.bookId)
        let idx = otOrder.firstIndex(of: p.bookId) ?? 0
        if maxCh >= 1, p.chapter < maxCh { return PlanPointer(bookId: p.bookId, chapter: p.chapter + 1) }
        return PlanPointer(bookId: otOrder[(idx + 1) % otOrder.count], chapter: 1)
    }

    static func advanceOtTrack(_ state: NtDeepRepeatState) -> NtDeepRepeatState {
        var s = addChapterRead(state, bookId: state.ot.bookId, chapter: state.ot.chapter, track: .ot)
        s.ot = advanceOtPointer(s.ot)
        return s
    }

    private static func stepSegment(_ state: NtDeepRepeatState) -> (index: Int, day: Int, target: Int) {
        let target = segmentDayTarget(state)
        var day = state.dayInSegment + 1, idx = state.curriculumIndex, next = target
        if day > target { day = 1; idx = (state.curriculumIndex + 1) % max(1, curriculum.count); next = state.pace }
        return (idx, day, next)
    }

    /// 只推进新约：本阶读满就换段，并把本阶各章记为已读；旧约不动
    static func advanceNtDay(_ state: NtDeepRepeatState) -> NtDeepRepeatState {
        let seg = currentSegment(state)
        let (idx, day, target) = stepSegment(state)
        var s = state
        s.curriculumIndex = idx; s.dayInSegment = day; s.segmentDayTarget = target
        if let seg { for r in seg.ranges { for ch in r.startChapter...max(r.startChapter, r.endChapter) { s = addChapterRead(s, bookId: r.bookId, chapter: ch, track: .nt) } } }
        return s
    }

    static func advanceOneDay(_ state: NtDeepRepeatState) -> NtDeepRepeatState {
        let (idx, day, target) = stepSegment(state)
        var s = state
        s.ot = advanceOtPointer(state.ot); s.curriculumIndex = idx; s.dayInSegment = day; s.segmentDayTarget = target
        return s
    }

    /// 对应 ntDeepRepeatStateForPlanDay
    static func stateForPlanDay(_ planDay: Int, pace: Int = defaultPace, startedAt: String? = nil, now: Date = Date()) -> NtDeepRepeatState {
        var start = now
        if let sa = startedAt, let c = PlanDates.parseLocalDate(sa) {
            start = Calendar.current.date(from: DateComponents(year: c.y, month: c.m, day: c.d)) ?? now
        }
        var s = defaultState(pace: pace, now: start)
        if let sa = startedAt { s.startedAt = sa }
        for _ in 1..<max(1, planDay) { s = advanceOneDay(s) }
        return s
    }

    static func score(_ s: NtDeepRepeatState) -> Int { s.curriculumIndex * 1000 + s.dayInSegment }

    /// 对应 inferNtDeepRepeatPlanDayFromProgress
    static func inferPlanDay(_ raw: NtDeepRepeatState?, startedOn: String) -> Int {
        let target = normalize(raw)
        let targetScore = score(target)
        var best = 1
        for d in 1...4000 {
            let implied = stateForPlanDay(d, pace: target.pace, startedAt: startedOn)
            if score(implied) <= targetScore { best = d } else { break }
        }
        return best
    }

    static func pointersEqual(_ a: NtDeepRepeatState, _ b: NtDeepRepeatState) -> Bool {
        a.ot == b.ot && a.curriculumIndex == b.curriculumIndex && a.dayInSegment == b.dayInSegment && a.segmentDayTarget == b.segmentDayTarget
    }

    /// 对应 alignNtDeepRepeatProgressToCalendar
    static func alignToCalendar(_ stored: NtDeepRepeatState, prefs: ReadingPlanPrefs, now: Date = Date()) -> NtDeepRepeatState {
        guard prefs.isNtDeepRepeat else { return stored }
        let startedAt = [prefs.startedOn, stored.startedAt].compactMap { $0?.trimmingCharacters(in: .whitespaces) }.first { !$0.isEmpty } ?? PlanDates.localDateString(now)
        let pace = prefs.ntDeepRepeatPace ?? stored.pace
        let calendarPlanDay = ReadingPlanRules.ntPlanDay(prefs, now: now) + prefs.ahead
        let calendarState = stateForPlanDay(calendarPlanDay, pace: pace, startedAt: startedAt, now: now)
        let storedPlanDay = inferPlanDay(stored, startedOn: startedAt)
        let keys = normalizeKeys(stored.chaptersReadKeys)
        var base = storedPlanDay > calendarPlanDay ? stored : calendarState
        if storedPlanDay > calendarPlanDay { base.ot = calendarState.ot }
        base.pace = pace; base.startedAt = startedAt; base.chaptersReadKeys = keys
        return normalize(base, now: now)
    }

    /// 对应 buildNtDeepRepeatReadingPlanDay：本阶各段，再加旧约一章
    static func readings(_ state: NtDeepRepeatState) -> [PlanReading] {
        var out = currentSegment(state)?.ranges ?? []
        out.append(PlanReading(bookId: state.ot.bookId, startChapter: state.ot.chapter, endChapter: state.ot.chapter))
        return out
    }

    static func trackTitle(_ track: NtTrack) -> String {
        track == .ot ? PlanCopy.t("pages.read.ntDeepRepeatTrackOt") : PlanCopy.t("pages.read.ntDeepRepeatTrackNt")
    }

    /// 「约翰福音 第 1–5 章」/「约翰一书 第 5 章」
    static func rangeLine(_ r: PlanReading) -> String {
        let name = BibleCatalog.book(id: r.bookId)?.name(AppLocale.current) ?? r.bookId
        if r.startChapter == r.endChapter {
            return PlanCopy.f("pages.read.ntDeepRepeatStageBookSingle", ["name": name, "chapter": "\(r.startChapter)"])
        }
        return PlanCopy.f("pages.read.ntDeepRepeatStageBookRange", ["name": name, "start": "\(r.startChapter)", "end": "\(r.endChapter)"])
    }

    static func stageRange(_ seg: NtSegment) -> String {
        seg.ranges.map(rangeLine).joined(separator: PlanCopy.t("pages.read.ntDeepRepeatLabelSep"))
    }

    static func segmentLabel(_ seg: NtSegment, day: Int, total: Int) -> String {
        PlanCopy.f("pages.read.ntDeepRepeatSegmentLabel", ["day": "\(day)", "total": "\(total)", "segment": stageRange(seg)])
    }

    /// 「创世记 第 1 章」/「诗篇 第 23 篇」（formatNtDeepRepeatOtLine）
    static func otLine(_ bookId: String, _ chapter: Int) -> String {
        let name = BibleCatalog.book(id: bookId)?.name(AppLocale.current) ?? bookId
        let unit = bookId == "PSA" ? PlanCopy.t("pages.read.tripleLoopPsalmUnit") : PlanCopy.t("pages.read.tripleLoopChapterUnit")
        return PlanCopy.f("pages.read.tripleLoopReadingLine", ["name": name, "chapter": "\(chapter)", "unit": unit])
    }
}
