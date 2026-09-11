import Foundation

/// 会员读经进度同步的纯规则（check:member-sync 对拍）——照抄 RN src/member-sync：
/// schema（23 个 blob 键）、mergeReadingBlobs（逐键三方合并）、memberReadingSyncOwnerPolicy（归属判定）、
/// readingPlanSyncSidecar（appLocale 侧车带计划）、reading-plan-prefs-merge（计划偏好合并）、
/// merge-triple-loop / merge-nt-deep-repeat（指针取最远 + 已读章并集）、reading-habit-stats（连读）、
/// year-day-timeline（全年轴）、app-usage-time / scripture-listen-totals 的文案。
/// blob 的 value 是任意 JSON：这里用 JSONSerialization 的 Any（[String: Any] / [Any] / String / NSNumber / NSNull）。
enum MemberReadingSyncRules {
    static let schemaVersion = 1
    static let table = "member_reading_sync_documents"
    static let metaKey = "askbible.member-reading-sync-meta.v1"
    static let blobKeys: [String] = [
        "bookmarks", "highlights", "lastPosition", "chapterCompletion", "tripleLoopProgress", "ntDeepRepeatProgress",
        "readingPlanPrefs", "todayReadingDone", "todayReadingFraction", "habitStats", "scriptureListenTotals",
        "readTypography", "readTranslation", "recentSearches", "homeNatureUi", "homePrayerVerse", "homeVersePoolScope",
        "natureSceneUi", "musicVisualTheme", "scripturePlaybackRate", "cuvAudioVoice", "exploreYearDayProfile", "appLocale",
        // Josh 2026-09-11：使用时长与最近阅读也要上云（原本只存本机）
        "appUsageTime", "recentChapters",
    ]
    /// 同步驱动的节流：30 秒内不重复自动同步；本地改动 1.5 秒防抖；前台轮询 45 秒（RN runMemberReadingSync / requestMemberReadingSync / useMemberReadingSync）
    static let minSyncIntervalMs: Double = 30_000
    static let localChangeDebounceMs: Double = 1_500
    static let pollIntervalMs: Double = 45_000
    static let readingHabitMinFraction = 0.2
    static let todayReadingAutoDoneFraction = 0.88

    // MARK: JSON 小工具

    static func dict(_ v: Any?) -> [String: Any]? { v as? [String: Any] }
    static func str(_ v: Any?) -> String? { v as? String }
    /// JS typeof === "number"：布尔不算数（JSON 的 true 桥成 NSNumber 时是 CFBoolean）
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

    /// JS Date.parse：完整 ISO（含时区 / 毫秒）或 YYYY-MM-DD（按 UTC 零点）；解析失败 nil
    static func jsDateParseMs(_ raw: String?) -> Double? {
        guard let s = raw?.trimmingCharacters(in: .whitespaces), !s.isEmpty else { return nil }
        if let d = ISO8601DateFormatter.flexible(s) { return (d.timeIntervalSince1970 * 1000).rounded() }
        if let (y, m, dd) = PlanDates.parseLocalDate(s) {
            return Double(PlanDates.daysFromCivil(y, m, dd)) * 86_400_000
        }
        return nil
    }

    /// RN parseIsoMs：解析失败算 0
    static func parseIsoMs(_ iso: String?) -> Double { jsDateParseMs(iso) ?? 0 }

    /// JS Date.toISOString：UTC、带毫秒
    static func isoString(ms: Double) -> String {
        ISO8601DateFormatter.millis.string(from: Date(timeIntervalSince1970: ms / 1000))
    }

    static func stringArray(_ v: Any?) -> [String] {
        guard let arr = v as? [Any] else { return [] }
        return arr.compactMap { $0 as? String }
    }

    // MARK: 逐键合并（RN mergeReadingBlobs.ts）

    static func mergeBookmarks(_ a: Any?, _ b: Any?) -> Any? {
        guard let da = dict(a) else { return b }
        guard let db = dict(b) else { return a }
        var out = da
        for (key, item) in db {
            let nextSaved = num(dict(item)?["savedAt"])
            let prevSaved = num(dict(out[key])?["savedAt"])
            if out[key] == nil || (nextSaved != nil && nextSaved! >= (prevSaved ?? 0)) { out[key] = item }
        }
        return out
    }

    static func mergeHighlightStore(_ a: Any?, _ b: Any?) -> Any? {
        guard let da = dict(a) else { return b }
        guard let db = dict(b) else { return a }
        var out = da
        for (key, entries) in db {
            guard let rows = entries as? [Any] else { continue }
            var byIndex: [Int: String] = [:]
            var order: [Int] = []
            func put(_ row: Any) {
                guard let r = dict(row), let iRaw = num(r["i"]), iRaw == iRaw.rounded(), iRaw >= 0 else { return }
                let i = Int(iRaw)
                if byIndex[i] == nil { order.append(i) }
                byIndex[i] = (r["c"] as? String) ?? ""
            }
            for row in (out[key] as? [Any]) ?? [] { put(row) }
            for row in rows { put(row) }
            let merged = byIndex.keys.sorted().map { ["i": $0, "c": byIndex[$0]!] as [String: Any] }
            if merged.isEmpty { out.removeValue(forKey: key) } else { out[key] = merged }
        }
        return out
    }

    /// chapterCompletion.completed / todayReadingDone.doneKeys / habitStats.completedDates：并集排序，scopeKey 取右边
    static func mergeStringSetRecords(_ a: Any?, _ b: Any?, field: String) -> Any? {
        func read(_ v: Any?) -> [String] { stringArray(dict(v)?[field]) }
        func scopeKey(_ v: Any?) -> String? { str(dict(v)?["scopeKey"]) }
        let merged = Array(Set(read(a) + read(b))).sorted(by: jsSort)
        var out: [String: Any] = dict(a) ?? dict(b) ?? [:]
        out["version"] = 1
        out[field] = merged
        let sa = scopeKey(a), sb = scopeKey(b)
        if let sa, let sb, sa == sb { out["scopeKey"] = sa }
        else if let sb { out["scopeKey"] = sb }
        else if let sa { out["scopeKey"] = sa }
        return out
    }

    static func mergeFractions(_ a: Any?, _ b: Any?) -> Any? {
        guard let da = dict(a) else { return b }
        guard let db = dict(b) else { return a }
        let scopeA = str(da["scopeKey"]), scopeB = str(db["scopeKey"])
        if let sa = scopeA, let sb = scopeB, !sa.isEmpty, !sb.isEmpty, sa != sb, !isSameTodayReadingPlanScope(sa, sb) {
            return parseIsoMs(str(db["updatedAt"])) >= parseIsoMs(str(da["updatedAt"])) ? b : a
        }
        var merged: [String: Any] = [:]
        for (k, v) in dict(da["fractions"]) ?? [:] { if let n = num(v) { merged[k] = n } else { merged[k] = v } }
        for (k, v) in dict(db["fractions"]) ?? [:] {
            guard let n = num(v) else { continue }
            merged[k] = max(num(merged[k]) ?? 0, n)
        }
        // JS `scopeB || scopeA`：空串算假；两边都没有就不写这个键
        let scope = (scopeB?.isEmpty == false) ? scopeB : scopeA
        var out: [String: Any] = ["version": 1, "fractions": merged]
        if let scope { out["scopeKey"] = scope }
        return out
    }

    static func mergeRecentSearches(_ a: Any?, _ b: Any?) -> Any? {
        func read(_ v: Any?) -> [String] { stringArray(dict(v)?["terms"]) }
        var seen = Set<String>(), merged: [String] = []
        for term in read(b) + read(a) {
            let trimmed = term.trimmingCharacters(in: .whitespacesAndNewlines)
                .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            if trimmed.isEmpty { continue }
            let key = trimmed.lowercased()
            if seen.contains(key) { continue }
            seen.insert(key); merged.append(trimmed)
            if merged.count >= 8 { break }
        }
        return ["version": 1, "terms": merged] as [String: Any]
    }

    /// RN planIdFromTodayReadingScopeKey：`planId:epoch:N` / `planId:day:N` / `planId` 取冒号前
    static func planIdFromScopeKey(_ scopeKey: String?) -> String? {
        guard let s = scopeKey?.trimmingCharacters(in: .whitespaces), !s.isEmpty else { return nil }
        let head = s.split(separator: ":", omittingEmptySubsequences: false).first.map(String.init)?.trimmingCharacters(in: .whitespaces) ?? ""
        return head.isEmpty ? nil : head
    }

    static func isSameTodayReadingPlanScope(_ a: String?, _ b: String?) -> Bool {
        guard let a, let b, !a.isEmpty, !b.isEmpty else { return false }
        if a == b { return true }
        guard let pa = planIdFromScopeKey(a), let pb = planIdFromScopeKey(b) else { return false }
        return pa == pb
    }

    static func mergeTodayReadingDone(_ a: Any?, _ b: Any?) -> Any? {
        let scopeA = str(dict(a)?["scopeKey"]), scopeB = str(dict(b)?["scopeKey"])
        if let sa = scopeA, let sb = scopeB, !sa.isEmpty, !sb.isEmpty, sa == sb { return mergeStringSetRecords(a, b, field: "doneKeys") }
        func keys(_ v: Any?) -> [String] { stringArray(dict(v)?["doneKeys"]).filter { !$0.isEmpty } }
        let planA = planIdFromScopeKey(scopeA), planB = planIdFromScopeKey(scopeB)
        if let pa = planA, let pb = planB, pa == pb {
            return ["version": 1, "scopeKey": scopeB ?? scopeA ?? "", "doneKeys": Array(Set(keys(a) + keys(b))).sorted(by: jsSort)] as [String: Any]
        }
        let ka = keys(a), kb = keys(b)
        if kb.count > ka.count { return b }
        if ka.count > kb.count { return a }
        return b
    }

    /// RN parseScriptureListenTotalsRecord：version 1、totalSec 有限且 ≥ 0 → 取整
    static func parseListenTotals(_ v: Any?) -> [String: Any]? {
        guard let d = dict(v), num(d["version"]) == 1, let n = num(d["totalSec"]), n.isFinite, n >= 0 else { return nil }
        return ["version": 1, "totalSec": Int(n.rounded(.down))]
    }

    static func mergeListenTotals(_ a: Any?, _ b: Any?) -> Any? {
        let left = parseListenTotals(a), right = parseListenTotals(b)
        guard let left else { return right ?? b }
        guard let right else { return left }
        return ["version": 1, "totalSec": Int(max(num(left["totalSec"]) ?? 0, num(right["totalSec"]) ?? 0))] as [String: Any]
    }

    // MARK: 读经计划偏好合并（lib/read/reading-plan-prefs-merge.ts）

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

    /// RN shouldSyncReadingPlanPrefs：用户选过的才上传；产品隐式默认不上传
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

    // MARK: 三循环 / 深读进度合并（merge-triple-loop / merge-nt-deep-repeat）

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

    private static func pointerProgress(_ p: PlanPointer, order: [String]) -> Int {
        ((order.firstIndex(of: p.bookId) ?? 0)) * 10_000 + p.chapter
    }
    private static func mergePointer(_ a: PlanPointer, _ b: PlanPointer, order: [String]) -> PlanPointer {
        pointerProgress(a, order: order) >= pointerProgress(b, order: order) ? a : b
    }
    private static func earlierStarted(_ a: String?, _ b: String?) -> String? {
        if let a, let b { return a <= b ? a : b }
        return a ?? b
    }

    /// RN mergeTripleLoopReadingState：各轨取读得最远的位置，已读章取并集
    static func mergeTripleLoopState(_ a: Any?, _ b: Any?) -> Any? {
        let left = TripleLoop.normalize(tripleState(from: a)), right = TripleLoop.normalize(tripleState(from: b))
        var keys: [String: [String]] = [:]
        for t in ["ot", "nt", "wisdom"] {
            keys[t] = Array(Set((left.chaptersReadKeys[t] ?? []) + (right.chaptersReadKeys[t] ?? []))).sorted(by: jsSort)
        }
        var s = TripleLoopState(ot: mergePointer(left.ot, right.ot, order: TripleLoop.otOrder),
                                nt: mergePointer(left.nt, right.nt, order: TripleLoop.ntOrder),
                                wisdom: mergePointer(left.wisdom, right.wisdom, order: TripleLoop.wisdomOrder),
                                chaptersReadKeys: keys)
        s.startedAt = earlierStarted(left.startedAt, right.startedAt)
        return tripleJson(TripleLoop.normalize(s))
    }

    /// RN mergeNtDeepRepeatReadingState：取读得最远的一阶 / 段内天，已读章取并集
    static func mergeNtDeepRepeatState(_ a: Any?, _ b: Any?, now: Date = Date()) -> Any? {
        let left = NtDeepRepeat.normalize(ntState(from: a), now: now), right = NtDeepRepeat.normalize(ntState(from: b), now: now)
        var keys: [String: [String]] = [:]
        for t in ["ot", "nt"] {
            keys[t] = Array(Set((left.chaptersReadKeys[t] ?? []) + (right.chaptersReadKeys[t] ?? []))).sorted(by: jsSort)
        }
        func progress(_ s: NtDeepRepeatState) -> Int { s.curriculumIndex * 1000 + s.dayInSegment }
        let lead = progress(left) >= progress(right) ? left : right
        let dayInSegment = left.curriculumIndex == right.curriculumIndex ? max(left.dayInSegment, right.dayInSegment) : lead.dayInSegment
        let s = NtDeepRepeatState(ot: mergePointer(left.ot, right.ot, order: NtDeepRepeat.otOrder), curriculumIndex: lead.curriculumIndex,
                                  dayInSegment: dayInSegment, pace: lead.pace, segmentDayTarget: 0,
                                  chaptersReadKeys: keys, startedAt: earlierStarted(left.startedAt, right.startedAt))
        return ntJson(NtDeepRepeat.normalize(s, now: now))
    }

    /// 最近阅读：按「卷:章」并集，同一章取更晚的时间，按时间倒序，最多 12 条（与 TS mergeRecentChapters 同）
    static func mergeRecentChapters(_ a: Any?, _ b: Any?) -> Any? {
        func read(_ v: Any?) -> [[String: Any]] {
            guard let items = dict(v)?["items"] as? [Any] else { return [] }
            return items.compactMap { raw in
                guard let o = raw as? [String: Any] else { return nil }
                let bookId = str(o["bookId"])?.trimmingCharacters(in: .whitespaces).uppercased() ?? ""
                let chapter = Int(num(o["chapter"]) ?? 0)
                guard !bookId.isEmpty, chapter > 0 else { return nil }
                return ["bookId": bookId, "chapter": chapter,
                        "bookName": str(o["bookName"]) ?? bookId,
                        "at": Int(num(o["at"]) ?? 0)]
            }
        }
        var byKey: [String: [String: Any]] = [:]
        for item in read(a) + read(b) {
            let key = "\(item["bookId"] as? String ?? ""):\(item["chapter"] as? Int ?? 0)"
            let at = item["at"] as? Int ?? 0
            if let prev = byKey[key], (prev["at"] as? Int ?? 0) >= at { continue }
            byKey[key] = item
        }
        let items = byKey.values.sorted { l, r in
            let la = l["at"] as? Int ?? 0, ra = r["at"] as? Int ?? 0
            if la != ra { return la > ra }
            return (l["bookId"] as? String ?? "") < (r["bookId"] as? String ?? "")
        }.prefix(12)
        return ["version": 1, "items": Array(items)]
    }

    // MARK: 一条 blob 的合并 + 整份推送合并

    static func mergeBlobValue(key: String, _ a: Any?, _ b: Any?, now: Date) -> Any? {
        switch key {
        case "bookmarks": return mergeBookmarks(a, b)
        case "highlights": return mergeHighlightStore(a, b)
        case "chapterCompletion": return mergeStringSetRecords(a, b, field: "completed")
        case "todayReadingDone": return mergeTodayReadingDone(a, b)
        case "habitStats": return mergeStringSetRecords(a, b, field: "completedDates")
        case "scriptureListenTotals": return mergeListenTotals(a, b)
        case "todayReadingFraction": return mergeFractions(a, b)
        case "recentSearches": return mergeRecentSearches(a, b)
        case "appUsageTime": return mergeListenTotals(a, b)
        case "recentChapters": return mergeRecentChapters(a, b)
        case "readingPlanPrefs": return mergeReadingPlanPrefsValue(a, b)
        case "tripleLoopProgress": return mergeTripleLoopState(a, b)
        case "ntDeepRepeatProgress": return mergeNtDeepRepeatState(a, b, now: now)
        default: return b
        }
    }

    /// RN mergeBlobPair：时间戳新的一侧为准（相等取右），updatedAt 取大
    static func mergeBlobPair(key: String, left: [String: Any]?, right: [String: Any]?, now: Date) -> [String: Any]? {
        guard let left else { return right }
        guard let right else { return left }
        let lms = parseIsoMs(str(left["updatedAt"])), rms = parseIsoMs(str(right["updatedAt"]))
        let newer = rms >= lms ? right : left
        let older = rms >= lms ? left : right
        var out: [String: Any] = ["updatedAt": isoString(ms: max(lms, rms))]
        if let v = mergeBlobValue(key: key, older["value"], newer["value"], now: now) { out["value"] = v } else { out["value"] = NSNull() }
        return out
    }

    /// RN mergeMemberReadingSyncPush：只认 23 个键、updatedAt 非空字符串的 blob
    static func mergePush(base: [String: Any]?, incoming: [String: Any]?, now: Date = Date()) -> [String: Any] {
        var blobs = base ?? [:]
        for (rawKey, blob) in incoming ?? [:] {
            guard blobKeys.contains(rawKey), let b = dict(blob) else { continue }
            guard let u = str(b["updatedAt"]), !u.trimmingCharacters(in: .whitespaces).isEmpty else { continue }
            blobs[rawKey] = mergeBlobPair(key: rawKey, left: dict(blobs[rawKey]), right: b, now: now)
        }
        return blobs
    }

    /// RN mergeMemberReadingSyncDocuments 的 revision：`${now}-${8 位随机 36 进制}`
    static func newRevision(now: Date = Date(), random: String = randomBase36(8)) -> String {
        "\(Int64(now.timeIntervalSince1970 * 1000))-\(random)"
    }
    static func randomBase36(_ n: Int) -> String {
        let chars = Array("0123456789abcdefghijklmnopqrstuvwxyz")
        return String((0..<n).map { _ in chars[Int.random(in: 0..<chars.count)] })
    }

    // MARK: 归属判定（memberReadingSyncOwnerPolicy.ts）

    enum SyncPath: String { case replace, pullOnlyReinstall = "pull-only-reinstall", pullOnlyEmpty = "pull-only-empty", guestPush = "guest-push", continue_ = "continue" }

    /// 退出 / 手动同步 / 本地改计划：本机已有进度时必须上传
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

    /// 云端是否已有会覆盖「空默认本机」的读经进度（设置类 last-wins 不算）
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

    // MARK: appLocale 侧车（readingPlanSyncSidecar.ts）

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
    /// 以正式 readingPlanPrefs 为准；侧车只作旧数据回退
    static func planIdFromBlobs(_ blobs: [String: Any]?) -> String? {
        planIdFromValue(blobValue(blobs, "readingPlanPrefs")) ?? planIdFromValue(readingPlanFromAppLocale(blobValue(blobs, "appLocale")))
    }

    // MARK: 习惯统计 / 全年轴（reading-habit-stats.ts / year-day-timeline.ts）

    /// Howard Hinnant civil_from_days（与 PlanDates.daysFromCivil 互逆）
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

    /// 连读：从最近完成日往前数连续天数（今日未完成则从昨日算起）
    static func computeReadingStreak(_ completedDates: [String], today: String) -> Int {
        let set = Set(completedDates)
        if set.isEmpty { return 0 }
        var cursor = set.contains(today) ? today : shiftLocalDate(today, -1)
        var streak = 0
        while set.contains(cursor) { streak += 1; cursor = shiftLocalDate(cursor, -1) }
        return streak
    }

    /// RN parseRecord：只留 YYYY-MM-DD，去重排序
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

    /// 全年轴上今天之前的已读区段（连续日合并），单位「第几天」
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

    // MARK: 文案（app-usage-time.ts / scripture-listen-totals.ts）

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

    // MARK: 本机 meta（memberReadingSyncApi.readMemberReadingSyncMeta）

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

    /// JS 默认 sort：按 UTF-16 code unit 比较
    static func jsSort(_ a: String, _ b: String) -> Bool {
        let ua = Array(a.utf16), ub = Array(b.utf16)
        for i in 0..<min(ua.count, ub.count) where ua[i] != ub[i] { return ua[i] < ub[i] }
        return ua.count < ub.count
    }
}
