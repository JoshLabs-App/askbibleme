import Foundation

// 会员读经同步纯规则对拍 harness。stdin 每行一个用例：kind\targ…（JSON 参数已是单行）；输出 JSON 字符串数组。
let input = String(data: FileHandle.standardInput.readDataToEndOfFile(), encoding: .utf8) ?? ""
var lines = input.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
if lines.last == "" { lines.removeLast() }

func json(_ s: String) -> Any? {
    let t = s.trimmingCharacters(in: .whitespaces)
    if t.isEmpty || t == "-" { return nil }
    return try? JSONSerialization.jsonObject(with: Data(t.utf8), options: [.fragmentsAllowed])
}
/// 键排序的规范 JSON。数值不用 JSONSerialization（它把 0.9 打成 0.90000000000000002），按 JS 习惯：整数不带小数点、小数最短往返
func jsonStr(_ s: String) -> String {
    let data = (try? JSONSerialization.data(withJSONObject: [s], options: [.withoutEscapingSlashes])) ?? Data("[\"\"]".utf8)
    let arr = String(decoding: data, as: UTF8.self)
    return String(arr.dropFirst().dropLast())
}
func canonical(_ v: Any?) -> String {
    guard let v, !(v is NSNull) else { return "null" }
    if let d = v as? [String: Any] { return "{" + d.keys.sorted(by: MemberReadingSyncRules.jsSort).map { jsonStr($0) + ":" + canonical(d[$0]) }.joined(separator: ",") + "}" }
    if let a = v as? [Any] { return "[" + a.map { canonical($0) }.joined(separator: ",") + "]" }
    if let s = v as? String { return jsonStr(s) }
    if let n = v as? NSNumber {
        if CFGetTypeID(n) == CFBooleanGetTypeID() { return n.boolValue ? "true" : "false" }
        let d = n.doubleValue
        if d == d.rounded(.down), !d.isInfinite, abs(d) < 1e15 { return String(Int64(d)) }
        return d.description
    }
    return "?"
}
func localDate(_ iso: String) -> Date {
    let p = PlanDates.parseLocalDate(iso)!
    var c = DateComponents(); c.year = p.y; c.month = p.m; c.day = p.d; c.hour = 12
    return Calendar.current.date(from: c)!
}
let R = MemberReadingSyncRules.self
var out: [String] = []
for line in lines {
    let f = line.split(separator: "\t", omittingEmptySubsequences: false).map(String.init)
    switch f[0] {
    case "merge": out.append(canonical(R.mergePush(base: R.dict(json(f[1])), incoming: R.dict(json(f[2])), now: localDate(f[3]))))
    case "mergeval": out.append(canonical(R.mergeBlobValue(key: f[1], json(f[2]), json(f[3]), now: localDate(f[4]))))
    case "path":
        out.append(R.decidePath(boundUserId: f[1].isEmpty ? nil : f[1], requirePullOnly: f[2] == "1", userId: f[3],
                                remoteHasProgress: f[4] == "1", localHasProgress: f[5] == "1", forcePush: f[6] == "1").rawValue)
    case "force": out.append(R.shouldForcePush(reason: f[1].isEmpty ? nil : f[1]) ? "1" : "0")
    case "progress": out.append(R.blobsHaveProgress(R.dict(json(f[1]))) ? "1" : "0")
    case "shouldsync": out.append(R.shouldSyncReadingPlanPrefs(R.dict(json(f[1]))) ? "1" : "0")
    case "sidecar": out.append(canonical(R.localeValueWithReadingPlan(locale: json(f[1]), plan: json(f[2]))))
    case "planid": out.append(R.planIdFromBlobs(R.dict(json(f[1]))) ?? "null")
    case "scope": out.append("\(R.isSameTodayReadingPlanScope(f[1].isEmpty ? nil : f[1], f[2].isEmpty ? nil : f[2]) ? 1 : 0)|\(R.planIdFromScopeKey(f[1]) ?? "null")")
    case "streak": out.append(String(R.computeReadingStreak(f[1].isEmpty ? [] : f[1].split(separator: ",").map(String.init), today: f[2])))
    case "dates": out.append(R.normalizeDates(f[1].isEmpty ? [] : f[1].split(separator: ",").map(String.init)).joined(separator: ","))
    case "yeartl":
        let p = PlanDates.parseLocalDate(f[1])!
        let t = R.yearTimeline(year: p.y, month: p.m, day: p.d)
        out.append("\(t.dayOfYear)|\(t.daysInYear)|\(String(format: "%.6f", t.progress))")
    case "ranges":
        let p = PlanDates.parseLocalDate(f[2])!
        let dates = f[1].isEmpty ? [] : f[1].split(separator: ",").map(String.init)
        let tl = R.yearTimeline(year: p.y, month: p.m, day: p.d)
        out.append(R.yearReadRanges(dates, year: p.y, month: p.m, day: p.d).map { r in
            let fr = R.rangeToTrackFraction(start: r.start, end: r.end, daysInYear: tl.daysInYear)
            return "\(r.start)-\(r.end)@\(String(format: "%.5f", fr.left))+\(String(format: "%.5f", fr.width))"
        }.joined(separator: ";"))
    case "fmtlisten": out.append(R.formatListenDuration(totalSec: Int(f[1]) ?? 0, en: f[2] == "en"))
    case "fmtusage": out.append(R.formatUsageDuration(totalSec: Int(f[1]) ?? 0, en: f[2] == "en"))
    case "parsems": out.append(R.jsDateParseMs(f[1]).map { String(Int64($0)) } ?? "null")
    case "iso": out.append(R.isoString(ms: Double(f[1])!))
    default: out.append("?")
    }
}
let enc = JSONEncoder(); enc.outputFormatting = [.withoutEscapingSlashes]
FileHandle.standardOutput.write(try enc.encode(out))
