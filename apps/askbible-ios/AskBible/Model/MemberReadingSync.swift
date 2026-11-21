import Foundation

/// 会员读经同步的本机轻量规则与展示辅助（DECISIONS D-44：服务端 `askbible-sync` 统一执行 26 个 blob 的三方合并，
/// 客户端不再重复维护 450 行合并器，仅保留归属判定、本机计划偏好合并、习惯连读统计、全年轴与时长格式化）。
enum MemberReadingSyncRules {
    static let schemaVersion = 1
    static let metaKey = "askbible.member-reading-sync-meta.v1"
    static let blobKeys: [String] = [
        "bookmarks", "highlights", "lastPosition", "chapterCompletion", "tripleLoopProgress", "ntDeepRepeatProgress",
        "readingPlanPrefs", "todayReadingDone", "todayReadingFraction", "habitStats", "scriptureListenTotals",
        "readTypography", "readTranslation", "recentSearches", "homeNatureUi", "homePrayerVerse", "homeVersePoolScope",
        "natureSceneUi", "musicVisualTheme", "scripturePlaybackRate", "cuvAudioVoice", "exploreYearDayProfile", "appLocale",
        "appUsageTime", "recentChapters", "achievements",
    ]
    static let minSyncIntervalMs: Double = 30_000
    static let localChangeDebounceMs: Double = 1_500
    static let pollIntervalMs: Double = 45_000
    static let readingHabitMinFraction = 0.2
    static let todayReadingAutoDoneFraction = 0.88

    // MARK: JSON 小工具

    static func dict(_ v: Any?) -> [String: Any]? { v as? [String: Any] }
    static func str(_ v: Any?) -> String? { v as? String }
    static func num(_ v: Any?) -> Double? {
        guard let n = v as? NSNumber else { return nil }
        if CFGetTypeID(n) == CFBooleanGetTypeID() { return nil }
        return n.doubleValue
    }
    static func bool(_ v: Any?) -> Bool? {
        guard let n = v as? NSNumber, CFGetTypeID(n) == CFBooleanGetTypeID() else { return nil }
        return n.boolValue
    }
    static func isObject(_ v: Any?) -> Bool { v is [String: Any] }
    static func isTruthyObject(_ v: Any?) -> Bool { v is [String: Any] || v is [Any] }

    static func jsDateParseMs(_ raw: String?) -> Double? {
        guard let s = raw?.trimmingCharacters(in: .whitespaces), !s.isEmpty else { return nil }
        if let d = ISO8601DateFormatter.flexible(s) { return (d.timeIntervalSince1970 * 1000).rounded() }
        if let (y, m, dd) = PlanDates.parseLocalDate(s) {
            return Double(PlanDates.daysFromCivil(y, m, dd)) * 86_400_000
        }
        return nil
    }

    static func parseIsoMs(_ iso: String?) -> Double { jsDateParseMs(iso) ?? 0 }

    static func isoString(ms: Double) -> String {
        ISO8601DateFormatter.millis.string(from: Date(timeIntervalSince1970: ms / 1000))
    }

    static func stringArray(_ v: Any?) -> [String] {
        guard let arr = v as? [Any] else { return [] }
        return arr.compactMap { $0 as? String }
    }

    static func parseListenTotals(_ v: Any?) -> [String: Any]? {
        guard let d = dict(v), num(d["version"]) == 1, let n = num(d["totalSec"]), n.isFinite, n >= 0 else { return nil }
        return ["version": 1, "totalSec": Int(n.rounded(.down))]
    }

    // MARK: 读经计划偏好（本机校验与云端回填）

    private static let defaultPlanId = "triple-loop"
    private static let defaultAnchor = "calendar-easter"
    private static let easterEpoch = "2026-04-05"
    private static let ntDeepRepeatPlanId = "nt-deep-repeat"
    private static let ntDefaultPace: Double = 7

    private static func readAheadDays(_ p: [String: Any]) -> Int {
        guard let n = num(p["aheadDays"]), n.isFinite else { return 0 }
        return max(0, Int(n.rounded(.down)))
    }

    private static func isUnchosenProductDefault(_ p: [String: Any]) -> Bool {
        if bool(p["chosen"]) == true { return false }
        if readAheadDays(p) > 0 { return false }
        let planId = str(p["planId"]) ?? "", anchor = str(p["anchor"]) ?? ""
        if planId == ntDeepRepeatPlanId, anchor == "from-today" {
            let pace = num(p["ntDeepRepeatPace"])
            return pace == nil || pace == ntDefaultPace
        }
        if planId != defaultPlanId { return false }
        if anchor != defaultAnchor { return false }
        if p["ntDeepRepeatPace"] != nil, !(p["ntDeepRepeatPace"] is NSNull) { return false }
        if anchor == "calendar-easter" {
            let started = str(p["startedOn"])?.trimmingCharacters(in: .whitespaces) ?? ""
            if !started.isEmpty, started != easterEpoch { return false }
        }
        return true
    }

    static func shouldSyncReadingPlanPrefs(_ prefs: [String: Any]?) -> Bool {
        guard let p = prefs, num(p["version"]) == 1, let id = str(p["planId"])?.trimmingCharacters(in: .whitespaces), !id.isEmpty else { return false }
        if bool(p["chosen"]) == true { return true }
        return !isUnchosenProductDefault(p)
    }

    private static func selectedAtMs(_ p: [String: Any]) -> Double {
        guard let raw = str(p["selectedAt"])?.trimmingCharacters(in: .whitespaces), !raw.isEmpty else { return 0 }
        return jsDateParseMs(raw) ?? 0
    }

    private static func prefsWithAhead(_ prefs: [String: Any], _ other: [String: Any]?) -> [String: Any] {
        let samePlan = other != nil && num(other!["version"]) == 1 && str(other!["planId"]) == str(prefs["planId"])
        let ahead = samePlan ? max(readAheadDays(prefs), readAheadDays(other!)) : readAheadDays(prefs)
        var out = prefs
        if ahead > 0 { out["aheadDays"] = ahead } else { out.removeValue(forKey: "aheadDays") }
        return out
    }

    private static func earlierFromTodayStartedOn(_ left: [String: Any], _ right: [String: Any], planId: String?) -> String? {
        var candidates: [(String, Double)] = []
        for p in [left, right] {
            guard str(p["anchor"]) == "from-today", str(p["planId"]) == planId else { continue }
            guard let s = str(p["startedOn"])?.trimmingCharacters(in: .whitespaces), !s.isEmpty, let ms = jsDateParseMs(s) else { continue }
            candidates.append((s, ms))
        }
        guard !candidates.isEmpty else { return nil }
        return candidates.min { $0.1 < $1.1 }!.0
    }

    static func mergeReadingPlanPrefsValue(_ a: Any?, _ b: Any?) -> Any? {
        guard let left = dict(a) else { return b }
        guard let right = dict(b) else { return a }
        if isUnchosenProductDefault(right), str(left["planId"]) != str(right["planId"]), num(left["version"]) == 1 {
            return prefsWithAhead(left, right)
        }
        let leftChosen = bool(left["chosen"]) == true, rightChosen = bool(right["chosen"]) == true
        if leftChosen != rightChosen {
            return prefsWithAhead(leftChosen ? left : right, leftChosen ? right : left)
        }
        let lms = selectedAtMs(left), rms = selectedAtMs(right)
        if str(left["planId"]) != str(right["planId"]) {
            if lms != rms { return prefsWithAhead(lms > rms ? left : right, nil) }
            return prefsWithAhead(left, right)
        }
        let newerIsRight = num(right["version"]) == 1 || num(left["version"]) != 1
        var merged = prefsWithAhead(newerIsRight ? right : left, newerIsRight ? left : right)
        if str(merged["anchor"]) == "from-today", str(left["planId"]) == str(right["planId"]) {
            if let earliest = earlierFromTodayStartedOn(left, right, planId: str(merged["planId"])) { merged["startedOn"] = earliest }
        }
        return merged
    }

    // MARK: 三循环 / 深读状态 JSON 编解码

    private static func pointer(_ v: Any?) -> PlanPointer {
        let d = dict(v)
        return PlanPointer(bookId: str(d?["bookId"]) ?? "", chapter: Int(num(d?["chapter"]) ?? 0))
    }
    private static func keysMap(_ v: Any?, tracks: [String]) -> [String: [String]] {
        var out: [String: [String]] = [:]
        for t in tracks { out[t] = stringArray(dict(v)?[t]) }
        return out
    }
    private static func pointerJson(_ p: PlanPointer) -> [String: Any] { ["bookId": p.bookId, "chapter": p.chapter] }

    static func tripleState(from v: Any?) -> TripleLoopState? {
        guard let d = dict(v) else { return nil }
        return TripleLoopState(ot: pointer(d["ot"]), nt: pointer(d["nt"]), wisdom: pointer(d["wisdom"]),
                               chaptersReadKeys: keysMap(d["chaptersReadKeys"], tracks: ["ot", "nt", "wisdom"]),
                               startedAt: str(d["startedAt"]))
    }
    static func tripleJson(_ s: TripleLoopState) -> [String: Any] {
        var out: [String: Any] = ["ot": pointerJson(s.ot), "nt": pointerJson(s.nt), "wisdom": pointerJson(s.wisdom),
                                  "chaptersReadKeys": s.chaptersReadKeys, "chaptersRead": s.chaptersRead]
        if let st = s.startedAt { out["startedAt"] = st }
        return out
    }
    static func ntState(from v: Any?) -> NtDeepRepeatState? {
        guard let d = dict(v) else { return nil }
        return NtDeepRepeatState(ot: pointer(d["ot"]), curriculumIndex: Int(num(d["curriculumIndex"]) ?? 0),
                                 dayInSegment: Int(num(d["dayInSegment"]) ?? 1), pace: Int(num(d["pace"]) ?? 0),
                                 segmentDayTarget: Int(num(d["segmentDayTarget"]) ?? 0),
                                 chaptersReadKeys: keysMap(d["chaptersReadKeys"], tracks: ["ot", "nt"]), startedAt: str(d["startedAt"]))
    }
    static func ntJson(_ s: NtDeepRepeatState) -> [String: Any] {
        var out: [String: Any] = ["ot": pointerJson(s.ot), "curriculumIndex": s.curriculumIndex, "dayInSegment": s.dayInSegment,
                                  "pace": s.pace, "segmentDayTarget": s.segmentDayTarget,
                                  "chaptersReadKeys": s.chaptersReadKeys, "chaptersRead": s.chaptersRead]
        if let st = s.startedAt { out["startedAt"] = st }
        return out
    }

    // MARK: 归属判定（账号隔离与游客升级）

    enum SyncPath: String { case replace, pullOnlyReinstall = "pull-only-reinstall", pullOnlyEmpty = "pull-only-empty", guestPush = "guest-push", continue_ = "continue" }

    static func shouldForcePush(reason: String?) -> Bool {
        reason == "sign-out" || reason == "manual-debug" || reason == "local-change" || reason == "readingPlanPrefs"
    }

    static func decidePath(boundUserId: String?, requirePullOnly: Bool, userId: String, remoteHasProgress: Bool, localHasProgress: Bool, forcePush: Bool) -> SyncPath {
        if let b = boundUserId, b != userId { return .replace }
        if forcePush, localHasProgress { return .continue_ }
        if requirePullOnly { return .replace }
        if boundUserId == nil {
            if remoteHasProgress { return .pullOnlyReinstall }
            if !localHasProgress { return .pullOnlyEmpty }
            return .guestPush
        }
        if !localHasProgress { return .pullOnlyEmpty }
        return .continue_
    }

    private static func blobValue(_ blobs: [String: Any]?, _ key: String) -> Any? { dict(blobs?[key])?["value"] }

    static func blobsHaveProgress(_ blobs: [String: Any]?) -> Bool {
        guard let blobs else { return false }
        if let bm = dict(blobValue(blobs, "bookmarks")), !bm.isEmpty { return true }
        if let hl = dict(blobValue(blobs, "highlights")), !hl.isEmpty { return true }
        if isObject(blobValue(blobs, "lastPosition")) { return true }
        if let c = dict(blobValue(blobs, "chapterCompletion"))?["completed"] as? [Any], !c.isEmpty { return true }
        if let d = dict(blobValue(blobs, "todayReadingDone"))?["doneKeys"] as? [Any], !d.isEmpty { return true }
        if let f = dict(dict(blobValue(blobs, "todayReadingFraction"))?["fractions"]), !f.isEmpty { return true }
        if let dates = dict(blobValue(blobs, "habitStats"))?["completedDates"] as? [Any], !dates.isEmpty { return true }
        if let sec = num(dict(blobValue(blobs, "scriptureListenTotals"))?["totalSec"]), sec.isFinite, sec > 0 { return true }
        if let v = blobValue(blobs, "tripleLoopProgress"), !(v is NSNull) { return true }
        if let v = blobValue(blobs, "ntDeepRepeatProgress"), !(v is NSNull) { return true }
        return bool(dict(blobValue(blobs, "readingPlanPrefs"))?["chosen"]) == true
    }

    // MARK: appLocale 侧车

    static func localeValueWithReadingPlan(locale: Any?, plan: Any?) -> [String: Any] {
        var base: [String: Any] = dict(locale) ?? ["version": 1, "locale": "zh-CN"]
        if let plan { base["readingPlanPrefs"] = plan } else { base.removeValue(forKey: "readingPlanPrefs") }
        return base
    }
    static func readingPlanFromAppLocale(_ value: Any?) -> Any? {
        guard let d = dict(value) else { return nil }
        let p = d["readingPlanPrefs"]
        return p is NSNull ? nil : p
    }
    private static func planIdFromValue(_ v: Any?) -> String? {
        guard let id = str(dict(v)?["planId"])?.trimmingCharacters(in: .whitespaces), !id.isEmpty else { return nil }
        return id
    }
    static func planIdFromBlobs(_ blobs: [String: Any]?) -> String? {
        planIdFromValue(blobValue(blobs, "readingPlanPrefs")) ?? planIdFromValue(readingPlanFromAppLocale(blobValue(blobs, "appLocale")))
    }

    // MARK: 习惯统计 / 全年轴 / 时长文案

    static func civilFromDays(_ z0: Int) -> (y: Int, m: Int, d: Int) {
        let z = z0 + 719468
        let era = (z >= 0 ? z : z - 146096) / 146097
        let doe = z - era * 146097
        let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365
        let y = yoe + era * 400
        let doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
        let mp = (5 * doy + 2) / 153
        let d = doy - (153 * mp + 2) / 5 + 1
        let m = mp < 10 ? mp + 3 : mp - 9
        return (m <= 2 ? y + 1 : y, m, d)
    }

    static func shiftLocalDate(_ iso: String, _ delta: Int) -> String {
        guard let (y, m, d) = PlanDates.parseLocalDate(iso) else { return iso }
        let c = civilFromDays(PlanDates.daysFromCivil(y, m, d) + delta)
        return String(format: "%04d-%02d-%02d", c.y, c.m, c.d)
    }

    static func computeReadingStreak(_ completedDates: [String], today: String) -> Int {
        let set = Set(completedDates)
        if set.isEmpty { return 0 }
        var cursor = set.contains(today) ? today : shiftLocalDate(today, -1)
        var streak = 0
        while set.contains(cursor) { streak += 1; cursor = shiftLocalDate(cursor, -1) }
        return streak
    }

    static func normalizeDates(_ raw: [String]) -> [String] {
        Array(Set(raw.filter { $0.range(of: "^\\d{4}-\\d{2}-\\d{2}$", options: .regularExpression) != nil })).sorted(by: jsSort)
    }

    struct YearTimeline: Equatable { let dayOfYear: Int; let daysInYear: Int; let progress: Double }

    static func yearTimeline(year: Int, month: Int, day: Int) -> YearTimeline {
        let jan1 = PlanDates.daysFromCivil(year, 1, 1)
        let dayOfYear = PlanDates.daysFromCivil(year, month, day) - jan1 + 1
        let daysInYear = PlanDates.daysFromCivil(year + 1, 1, 1) - jan1
        let progress = daysInYear <= 1 ? 0 : min(1, max(0, Double(dayOfYear - 1) / Double(daysInYear - 1)))
        return YearTimeline(dayOfYear: dayOfYear, daysInYear: daysInYear, progress: progress)
    }
    static func yearTimeline(now: Date = Date()) -> YearTimeline {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: now)
        return yearTimeline(year: c.year!, month: c.month!, day: c.day!)
    }

    static func yearReadRanges(_ completedDates: [String], year: Int, month: Int, day: Int) -> [(start: Int, end: Int)] {
        let tl = yearTimeline(year: year, month: month, day: day)
        let jan1 = PlanDates.daysFromCivil(year, 1, 1)
        var days: [Int] = []
        for iso in completedDates {
            guard let (y, m, d) = PlanDates.parseLocalDate(iso), y == year else { continue }
            let dd = PlanDates.daysFromCivil(y, m, d) - jan1 + 1
            if dd < 1 || dd >= tl.dayOfYear || dd > tl.daysInYear { continue }
            days.append(dd)
        }
        if days.isEmpty { return [] }
        days.sort()
        var ranges: [(Int, Int)] = []
        var start = days[0], end = start
        for d in days.dropFirst() {
            if d == end || d == end + 1 { end = d; continue }
            ranges.append((start, end)); start = d; end = d
        }
        ranges.append((start, end))
        return ranges.map { (start: $0.0, end: $0.1) }
    }

    static func rangeToTrackFraction(start: Int, end: Int, daysInYear: Int) -> (left: Double, width: Double) {
        if daysInYear <= 0 { return (0, 0) }
        let s = max(1, start), e = min(daysInYear, max(s, end))
        return (Double(s - 1) / Double(daysInYear), Double(e - s + 1) / Double(daysInYear))
    }

    static func formatListenDuration(totalSec: Int, en: Bool) -> String {
        let sec = max(0, totalSec), hours = sec / 3600, minutes = (sec % 3600) / 60
        if en {
            if hours <= 0 { return "\(minutes) min" }
            if minutes <= 0 { return "\(hours) hr" }
            return "\(hours) hr \(minutes) min"
        }
        if hours <= 0 { return "\(minutes) 分钟" }
        if minutes <= 0 { return "\(hours) 小时" }
        return "\(hours) 小时 \(minutes) 分钟"
    }

    static func formatUsageDuration(totalSec: Int, en: Bool) -> String {
        let sec = max(0, totalSec), hours = sec / 3600, minutes = (sec % 3600) / 60, seconds = sec % 60
        if en {
            if hours <= 0, minutes <= 0 { return "\(seconds) sec" }
            if hours <= 0 { return minutes > 0 && seconds == 0 ? "\(minutes) min" : "\(minutes) min \(seconds) sec" }
            if minutes <= 0 { return "\(hours) hr" }
            return "\(hours) hr \(minutes) min"
        }
        if hours <= 0, minutes <= 0 { return "\(seconds) 秒" }
        if hours <= 0 { return seconds == 0 ? "\(minutes) 分钟" : "\(minutes) 分 \(seconds) 秒" }
        if minutes <= 0 { return "\(hours) 小时" }
        return "\(hours) 小时 \(minutes) 分钟"
    }

    // MARK: 本机 meta

    struct Meta: Equatable {
        var revision: String?
        var lastSyncedAt: String?
        var boundUserId: String?
        var requirePullOnly = false
        var lastError: String?

        static func parse(_ raw: String?) -> Meta {
            guard let raw, let data = raw.data(using: .utf8), let o = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return Meta() }
            let bound = (o["boundUserId"] as? String)?.trimmingCharacters(in: .whitespaces)
            let err = (o["lastError"] as? String)?.trimmingCharacters(in: .whitespaces)
            return Meta(revision: o["revision"] as? String, lastSyncedAt: o["lastSyncedAt"] as? String,
                        boundUserId: (bound?.isEmpty ?? true) ? nil : bound, requirePullOnly: MemberReadingSyncRules.bool(o["requirePullOnly"]) == true,
                        lastError: (err?.isEmpty ?? true) ? nil : err)
        }
        func serialize() -> String {
            let o: [String: Any] = ["revision": revision ?? NSNull(), "lastSyncedAt": lastSyncedAt ?? NSNull(),
                                    "boundUserId": boundUserId ?? NSNull(), "requirePullOnly": requirePullOnly, "lastError": lastError ?? NSNull()]
            let data = (try? JSONSerialization.data(withJSONObject: o, options: [.sortedKeys])) ?? Data("{}".utf8)
            return String(decoding: data, as: UTF8.self)
        }
    }

    static func jsSort(_ a: String, _ b: String) -> Bool {
        let ua = Array(a.utf16), ub = Array(b.utf16)
        for i in 0..<min(ua.count, ub.count) where ua[i] != ub[i] { return ua[i] < ub[i] }
        return ua.count < ub.count
    }
}
