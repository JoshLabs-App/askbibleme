import Foundation
import Combine

/// 今日读经（对应 TodayReadingPlanPayload + 目录页脚注要显示的那几样）
struct TodayPlan {
    let planId: String
    let title: String
    /// 「第 N 天」；三循环按复活节历元，深读按选定日，日课表按下标 + 超前
    let dayNumber: Int
    /// 「第 N 天 · 自 2026 年复活节起」那行
    let metaLine: String
    let readings: [PlanReading]
    /// 逐章队列（RN buildPlanChapterQueue）
    var queue: [PlanPointer] { readings.flatMap { $0.chapters } }
}

/// 读经计划的本机状态：偏好 + 三循环进度 + 深读进度 + 已读章。
/// 对应 RN 的 reading-plan-prefs / triple-loop-progress / nt-deep-repeat-progress / read-chapter-completion 四个 store，
/// 落 UserDefaults；纯逻辑全在 ReadingPlans.swift，这里只做 IO 与「读出来先对齐日历」。
@MainActor
final class ReadingPlanStore: ObservableObject {
    private static let prefsKey = "reading-plan-prefs-v1"
    private static let tripleKey = "triple-loop-progress-v1"
    private static let ntKey = "nt-deep-repeat-progress-v5"
    private static let completionKey = "read-chapter-completion-v1"

    /// 生效偏好（没存过就是隐式默认：三循环）
    @Published private(set) var prefs: ReadingPlanPrefs
    @Published private(set) var storedPrefs: ReadingPlanPrefs?
    @Published private(set) var triple: TripleLoopState
    @Published private(set) var nt: NtDeepRepeatState
    @Published private(set) var completed: Set<String> = []
    @Published private(set) var hasUserTriple = false
    @Published private(set) var hasUserNt = false
    /// 播放页点听过的日历日（YYYY-MM-DD），月历标黄；RN plan-play-listened-dates（并入习惯统计 completedDates）
    @Published private(set) var listenedDates: Set<String> = []

    private let defaults = UserDefaults.standard
    private var bundles: [String: [[PlanReading]]] = [:]
    /// 本机改动通知（会员同步用；应用云端数据期间由 suppressChangeNotify 压住，RN isApplyingRemoteMemberSync）
    var onLocalChange: ((String) -> Void)?
    var suppressChangeNotify = false
    private func changed(_ key: String) { if !suppressChangeNotify { onLocalChange?(key) } }

    init() {
        let stored = defaults.data(forKey: Self.prefsKey).flatMap(ReadingPlanPrefs.parse)
        storedPrefs = stored
        prefs = stored ?? .defaultPrefs()
        triple = TripleLoop.defaultState()
        nt = NtDeepRepeat.defaultState()
        completed = Set((try? JSONDecoder().decode([String].self, from: defaults.data(forKey: Self.completionKey) ?? Data())) ?? [])
        listenedDates = Self.parseListened(defaults.data(forKey: Self.listenedKey))
        reloadProgress()
    }

    // MARK: 读出来先对齐日历（readTripleLoopProgress / readNtDeepRepeatProgress）

    private func reloadProgress() {
        let tripleRaw = defaults.data(forKey: Self.tripleKey).flatMap { try? JSONDecoder().decode(TripleLoopState.self, from: $0) }
        hasUserTriple = tripleRaw != nil
        let tripleStored = tripleRaw.map(TripleLoop.normalize) ?? TripleLoop.defaultState()
        let tripleEff = TripleLoop.resolveEffective(stored: tripleStored, hasSaved: tripleRaw != nil, aheadDays: prefs.ahead)
        if tripleRaw != nil, !TripleLoop.pointersEqual(tripleStored, tripleEff) { persistTriple(tripleEff) }
        triple = tripleEff

        let ntRaw = defaults.data(forKey: Self.ntKey).flatMap { try? JSONDecoder().decode(NtDeepRepeatState.self, from: $0) }
        hasUserNt = ntRaw != nil
        let ntStored = ntRaw.map { NtDeepRepeat.normalize($0) } ?? NtDeepRepeat.defaultState()
        let aligned = NtDeepRepeat.alignToCalendar(ntStored, prefs: prefs)
        if ntRaw != nil, !NtDeepRepeat.pointersEqual(ntStored, aligned) { persistNt(aligned) }
        nt = aligned
    }

    private func persistTriple(_ s: TripleLoopState) {
        if let d = try? JSONEncoder().encode(s) { defaults.set(d, forKey: Self.tripleKey) }
        triple = s; hasUserTriple = true
        changed("tripleLoopProgress")
    }

    private func persistNt(_ s: NtDeepRepeatState) {
        if let d = try? JSONEncoder().encode(s) { defaults.set(d, forKey: Self.ntKey) }
        nt = s; hasUserNt = true
        changed("ntDeepRepeatProgress")
    }

    private func writePrefs(_ p: ReadingPlanPrefs?) {
        if let p, let d = try? JSONEncoder().encode(p) { defaults.set(d, forKey: Self.prefsKey) } else { defaults.removeObject(forKey: Self.prefsKey) }
        storedPrefs = p
        prefs = p ?? .defaultPrefs()
        reloadProgress()
        changed("readingPlanPrefs")
    }

    // MARK: 会员同步：导出 / 应用（RN readingSyncLocalExport / readingSyncLocalApply）

    /// 存过的偏好（JSON，RN 同形）；隐式默认返回 nil
    var storedPrefsJSON: [String: Any]? {
        guard let p = storedPrefs, let d = try? JSONEncoder().encode(p) else { return nil }
        return (try? JSONSerialization.jsonObject(with: d)) as? [String: Any]
    }
    /// 用户动过的三循环 / 深读进度（没动过 = 没存过 → nil，RN hasUserTripleLoopProgress）
    var tripleJSON: [String: Any]? { hasUserTriple ? MemberReadingSyncRules.tripleJson(triple) : nil }
    var ntJSON: [String: Any]? { hasUserNt ? MemberReadingSyncRules.ntJson(nt) : nil }
    var completedSorted: [String] { completed.sorted(by: MemberReadingSyncRules.jsSort) }

    /// 云端计划偏好落本机（已按 mergeReadingPlanPrefsValue 合并过）
    func applyRemotePrefs(_ json: [String: Any]?) {
        guard let json else { writePrefs(nil); return }
        guard let data = try? JSONSerialization.data(withJSONObject: json), let p = ReadingPlanPrefs.parse(data) else { return }
        writePrefs(p)
    }
    func applyRemoteTriple(_ json: [String: Any]) {
        guard let s = MemberReadingSyncRules.tripleState(from: json) else { return }
        persistTriple(TripleLoop.normalize(s)); reloadProgress()
    }
    func applyRemoteNt(_ json: [String: Any]) {
        guard let s = MemberReadingSyncRules.ntState(from: json) else { return }
        persistNt(NtDeepRepeat.normalize(s)); reloadProgress()
    }
    /// RN replaceReadChapterCompletionRecord：整份替换
    func applyRemoteCompleted(_ keys: [String]) {
        completed = Set(keys.filter { !$0.isEmpty })
        if let d = try? JSONEncoder().encode(Array(completed).sorted()) { defaults.set(d, forKey: Self.completionKey) }
    }
    /// 换帐号 / 退出：清空计划相关本机数据（RN clearLocalMemberReadingSyncBlobs 的计划部分）
    func clearForAccountSwitch() {
        for k in [Self.prefsKey, Self.tripleKey, Self.ntKey, Self.completionKey, Self.listenedKey] { defaults.removeObject(forKey: k) }
        completed = []; listenedDates = []
        storedPrefs = nil; prefs = .defaultPrefs()
        reloadProgress()
    }

    // MARK: 计划切换（对应 setActiveReadingPlan / activateNtDeepRepeatPlan / ensureTripleLoopPlanPrefs）

    func isActive(_ planId: String) -> Bool { prefs.planId == planId }

    /// 详情页「今日为第 N 天」：深读按选定日；三循环不显示；日课表按下标 + 1
    func currentPlanDay(_ planId: String, dayCount: Int) -> Int? {
        guard isActive(planId) else { return nil }
        if prefs.isNtDeepRepeat { return ReadingPlanRules.effectiveEpochDay(prefs) }
        if prefs.isTripleLoop { return nil }
        return ReadingPlanRules.dayIndex(prefs, dayCount: dayCount) + 1
    }

    private func setActive(_ planId: String, anchor: PlanAnchor, dayCount: Int?, now: Date = Date(), pace: Int? = nil) {
        let iso = ISO8601DateFormatter().string(from: Date())
        let startedOn: String?
        switch anchor {
        case .fromToday: startedOn = PlanDates.localDateString(now)
        case .calendarEaster: startedOn = PlanDates.easterEpoch
        case .calendarJan1: startedOn = nil
        }
        writePrefs(ReadingPlanPrefs(planId: planId, anchor: anchor, startedOn: startedOn, dayCount: dayCount,
                                    ntDeepRepeatPace: pace, chosen: true, selectedAt: iso))
    }

    func activate(planId: String, dayCount: Int, anchor: PlanAnchor, pace: Int, startDay: Int) {
        let safeStart = max(1, startDay)
        let backDated = PlanDates.addDays(Date(), -(safeStart - 1))
        if planId == ReadingPlanCatalog.ntDeepRepeatId {
            let prev = storedPrefs
            let switching = prev?.planId != planId
            let paceChanged = prev?.planId == planId && prev?.ntDeepRepeatPace != pace
            setActive(planId, anchor: .fromToday, dayCount: dayCount, now: backDated, pace: pace)
            if switching || paceChanged || safeStart > 1 {
                let fresh: NtDeepRepeatState
                if safeStart > 1 {
                    var s = NtDeepRepeat.stateForPlanDay(safeStart, pace: pace, startedAt: PlanDates.localDateString(backDated), now: backDated)
                    s.startedAt = PlanDates.localDateString(backDated)
                    fresh = s
                } else {
                    fresh = NtDeepRepeat.defaultState(pace: pace, now: backDated)
                }
                persistNt(fresh)
                reloadProgress()
            }
        } else if planId == ReadingPlanCatalog.tripleLoopId {
            setActive(planId, anchor: .calendarEaster, dayCount: 1)
        } else if anchor == .fromToday {
            setActive(planId, anchor: anchor, dayCount: dayCount, now: backDated)
        } else {
            setActive(planId, anchor: anchor, dayCount: dayCount)
        }
    }

    func clearPlan() { writePrefs(nil) }

    /// 三循环「恢复为默认进度」：回到复活节历元的今日位置，已读章记录保留
    func resetTripleToDefault() {
        setActive(ReadingPlanCatalog.tripleLoopId, anchor: .calendarEaster, dayCount: 1)
        var s = TripleLoop.stateForPlanDay(PlanDates.daySinceEpoch())
        s.startedAt = PlanDates.easterEpoch
        s.chaptersReadKeys = triple.chaptersReadKeys
        persistTriple(TripleLoop.normalize(s))
        hasUserTriple = false
        defaults.removeObject(forKey: Self.tripleKey)
        reloadProgress()
    }

    /// 深读「恢复为默认进度」：从今天第 1 阶第 1 天重来
    func resetNt() {
        defaults.removeObject(forKey: Self.ntKey)
        persistNt(NtDeepRepeat.defaultState(pace: prefs.ntDeepRepeatPace ?? NtDeepRepeat.defaultPace))
        reloadProgress()
    }

    /// 「本节已读，推进 X」：只推进那一轨
    func advanceTriple(_ track: TripleTrack) {
        var next = TripleLoop.advanceTrack(triple, track)
        if next.startedAt == nil { next.startedAt = PlanDates.easterEpoch }
        persistTriple(next)
    }

    /// 深读推进新约一天（读满换段）
    func advanceNtDay() { persistNt(NtDeepRepeat.advanceNtDay(nt)) }
    /// 深读旧约读完一章
    func advanceNtOt() { persistNt(NtDeepRepeat.advanceOtTrack(nt)) }

    // MARK: 已读章

    static func chapterKey(_ bookId: String, _ chapter: Int) -> String { "\(bookId.uppercased()):\(chapter)" }

    func isCompleted(_ bookId: String, _ chapter: Int) -> Bool { completed.contains(Self.chapterKey(bookId, chapter)) }

    func markChapterRead(_ bookId: String, _ chapter: Int) {
        completed.insert(Self.chapterKey(bookId, chapter))
        // RN 习惯统计 completedDates：读完 / 听完一章的日子也算「读过」，月历标黄
        markListened(PlanDates.localDateString())
        if let d = try? JSONEncoder().encode(Array(completed).sorted()) { defaults.set(d, forKey: Self.completionKey) }
        changed("chapterCompletion")
        if prefs.isTripleLoop { persistTriple(TripleLoop.addChapterRead(triple, bookId: bookId, chapter: chapter)) }
        if prefs.isNtDeepRepeat { persistNt(NtDeepRepeat.addChapterRead(nt, bookId: bookId, chapter: chapter)) }
    }

    // MARK: 播放页（RN plan-play-listened-dates / loadReadingPlanPayloadAtAhead / setReadingPlanAheadDays）

    private static let listenedKey = "askbible-plan-play-listened-dates-v1"
    private struct ListenedRecord: Codable { var version: Int; var dates: [String] }

    private static func parseListened(_ data: Data?) -> Set<String> {
        guard let data, let r = try? JSONDecoder().decode(ListenedRecord.self, from: data), r.version == 1 else { return [] }
        return Set(r.dates.filter { PlanDates.parseLocalDate($0) != nil })
    }

    /// 某个日历日在播放页点听过 → 月历那天标黄（换计划后也保留）
    func markListened(_ iso: String) {
        guard PlanDates.parseLocalDate(iso) != nil, !listenedDates.contains(iso) else { return }
        listenedDates.insert(iso)
        if let d = try? JSONEncoder().encode(ListenedRecord(version: 1, dates: listenedDates.sorted())) { defaults.set(d, forKey: Self.listenedKey) }
        changed("habitStats")
    }

    /// 浏览「相对系统今天偏移 ahead 天」那一天该读什么（不写 prefs）。
    /// 三循环永远按日历天算指针；深读 / 日课表在偏移等于已确认的 aheadDays 时就是今日内容。
    func readings(atContentAhead ahead: Int, now: Date = Date()) -> [PlanReading] {
        if prefs.isTripleLoop {
            return TripleLoop.readings(TripleLoop.stateForPlanDay(max(1, PlanDates.daySinceEpoch(now) + ahead)))
        }
        if ahead == prefs.ahead { return today.readings }
        if prefs.isNtDeepRepeat {
            let planDay = max(1, ReadingPlanRules.ntPlanDay(prefs, now: now) + ahead)
            let pace = prefs.ntDeepRepeatPace ?? NtDeepRepeat.defaultPace
            return NtDeepRepeat.readings(NtDeepRepeat.stateForPlanDay(planDay, pace: pace, startedAt: prefs.startedOn, now: now))
        }
        let dayCount = ReadingPlanCatalog.plan(id: prefs.planId)?.dayCount ?? prefs.dayCount ?? 365
        return registryDay(prefs.planId, PlanPlay.registryDayIndex(prefs, dayCount: dayCount, contentAhead: ahead, now: now)) ?? []
    }

    /// 「进度设置为今日」：把日历上选的那天定为今天该读的内容（setReadingPlanAheadDays）。
    /// 写 prefs.aheadDays，指针型计划再把指针跳到对应的计划天（保留已读章记录）。
    func setAheadDays(_ targetAhead: Int, now: Date = Date()) {
        let target = max(0, targetAhead)
        guard target != prefs.ahead else { return }
        var next = prefs
        next.aheadDays = target > 0 ? target : nil
        next.chosen = true
        writePrefs(next)
        if prefs.isNtDeepRepeat {
            jumpNt(toPlanDay: ReadingPlanRules.ntPlanDay(prefs, now: now) + target, now: now)
        } else if prefs.isTripleLoop {
            jumpTriple(toPlanDay: PlanDates.daySinceEpoch(now) + target)
        }
    }

    private func jumpTriple(toPlanDay planDay: Int) {
        var s = TripleLoop.stateForPlanDay(max(1, planDay))
        s.startedAt = PlanDates.easterEpoch
        s.chaptersReadKeys = triple.chaptersReadKeys
        persistTriple(TripleLoop.normalize(s))
    }

    private func jumpNt(toPlanDay planDay: Int, now: Date) {
        let pace = prefs.ntDeepRepeatPace ?? NtDeepRepeat.defaultPace
        let startedAt = Self.nonEmpty(prefs.startedOn) ?? PlanDates.localDateString(now)
        var s = NtDeepRepeat.stateForPlanDay(max(1, planDay), pace: pace, startedAt: startedAt, now: now)
        s.pace = pace; s.startedAt = startedAt; s.chaptersReadKeys = nt.chaptersReadKeys
        persistNt(NtDeepRepeat.normalize(s, now: now))
    }

    private static func nonEmpty(_ s: String?) -> String? {
        let t = s?.trimmingCharacters(in: .whitespaces) ?? ""
        return t.isEmpty ? nil : t
    }

    /// 深读：把第 index 阶设为今日新约读经（setNtDeepRepeatCurriculumStageAsToday）。
    /// 该阶第一天早于日历天 → 把 startedOn 往前挪；晚于 → 记成 aheadDays。
    func setNtStageAsToday(_ index: Int, now: Date = Date()) {
        let pace = prefs.ntDeepRepeatPace ?? NtDeepRepeat.defaultPace
        let safeIndex = min(max(1, NtDeepRepeat.stageCount) - 1, max(0, index))
        let planDay = safeIndex * pace + 1
        var startedAt = Self.nonEmpty(prefs.startedOn) ?? PlanDates.localDateString(now)
        var probe = prefs; probe.startedOn = startedAt
        let calendarDay = ReadingPlanRules.ntPlanDay(probe, now: now)
        var next = prefs
        next.chosen = true
        if planDay < calendarDay {
            startedAt = PlanDates.localDateString(PlanDates.addDays(now, -(planDay - 1)))
            next.startedOn = startedAt
            next.aheadDays = nil
        } else {
            let ahead = planDay - calendarDay
            next.startedOn = startedAt
            next.aheadDays = ahead > 0 ? ahead : nil
        }
        var s = NtDeepRepeat.stateForPlanDay(planDay, pace: pace, startedAt: startedAt, now: now)
        s.pace = pace; s.startedAt = startedAt; s.chaptersReadKeys = nt.chaptersReadKeys
        // RN 先写进度再写 prefs；writePrefs 会按新 prefs 重新对齐进度
        persistNt(NtDeepRepeat.normalize(s, now: now))
        writePrefs(next)
    }

    // MARK: 今日读经

    /// 日课表某一天（Resources/reading-plans/{planId}.json）
    func registryDay(_ planId: String, _ dayIndex: Int) -> [PlanReading]? {
        if bundles[planId] == nil {
            struct Range: Decodable { let bookId: String; let startChapter: Int; let endChapter: Int; let startVerse: Int?; let endVerse: Int?; let label: String? }
            struct Day: Decodable { let readings: [Range] }
            struct PlanFile: Decodable { let days: [Day] }  // 别叫 Bundle，会盖掉 Foundation.Bundle
            guard let url = Bundle.main.url(forResource: planId, withExtension: "json", subdirectory: "reading-plans")
                    ?? Bundle.main.url(forResource: planId, withExtension: "json"),
                  let data = try? Data(contentsOf: url),
                  let b = try? JSONDecoder().decode(PlanFile.self, from: data) else { return nil }
            bundles[planId] = b.days.map { $0.readings.map { PlanReading(bookId: $0.bookId, startChapter: $0.startChapter, endChapter: $0.endChapter, startVerse: $0.startVerse, endVerse: $0.endVerse, label: $0.label ?? "") } }
        }
        guard let days = bundles[planId], dayIndex >= 0, dayIndex < days.count else { return nil }
        return days[dayIndex]
    }

    var today: TodayPlan {
        let entry = ReadingPlanCatalog.plan(id: prefs.planId)
        let title = entry?.title ?? prefs.planId
        let aheadLabel = PlanCopy.t("pages.read.todayPlanAheadLabel")
        if prefs.isTripleLoop {
            let day = ReadingPlanRules.effectiveEpochDay(prefs)
            let anchor = prefs.ahead > 0 ? aheadLabel : PlanCopy.t("pages.read.todayPlanAnchorEaster")
            return TodayPlan(planId: prefs.planId, title: title, dayNumber: day,
                             metaLine: PlanCopy.f("pages.read.todayPlanDayMeta", ["n": "\(day)"]) + " · " + anchor,
                             readings: TripleLoop.readings(triple))
        }
        if prefs.isNtDeepRepeat {
            let day = ReadingPlanRules.effectiveEpochDay(prefs)
            let anchor = prefs.ahead > 0 ? aheadLabel : PlanCopy.t("pages.read.todayPlanAnchorToday")
            return TodayPlan(planId: prefs.planId, title: title, dayNumber: day,
                             metaLine: PlanCopy.f("pages.read.todayPlanDayMeta", ["n": "\(day)"]) + " · " + anchor,
                             readings: NtDeepRepeat.readings(nt))
        }
        let dayCount = entry?.dayCount ?? prefs.dayCount ?? 365
        let idx = ReadingPlanRules.effectiveDayIndex(prefs, dayCount: dayCount)
        let calendarIdx = ReadingPlanRules.dayIndex(prefs, dayCount: dayCount)
        let anchor = prefs.ahead > 0 ? aheadLabel
            : (prefs.anchor == .calendarJan1 ? PlanCopy.t("pages.read.todayPlanAnchorJan1") : PlanCopy.t("pages.read.todayPlanAnchorToday"))
        return TodayPlan(planId: prefs.planId, title: title, dayNumber: calendarIdx + 1 + prefs.ahead,
                         metaLine: PlanCopy.f("pages.read.todayPlanDayMeta", ["n": "\(calendarIdx + 1 + prefs.ahead)"]) + " · " + anchor,
                         readings: registryDay(prefs.planId, idx) ?? [])
    }
}
