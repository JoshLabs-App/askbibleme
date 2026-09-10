import Foundation

// 读经计划对拍 harness。stdin 每行一个用例：kind\targ…；输出 JSON 字符串数组（逐行一个结果）。
let input = String(data: FileHandle.standardInput.readDataToEndOfFile(), encoding: .utf8) ?? ""
var lines = input.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
if lines.last == "" { lines.removeLast() }

func date(_ s: String) -> Date {
    let c = PlanDates.parseLocalDate(s)!
    return Calendar.current.date(from: DateComponents(year: c.y, month: c.m, day: c.d))!
}
func ptr(_ s: String) -> PlanPointer { let p = s.split(separator: ":"); return PlanPointer(bookId: String(p[0]), chapter: Int(p[1])!) }
func show(_ p: PlanPointer) -> String { "\(p.bookId):\(p.chapter)" }
func show(_ s: TripleLoopState) -> String { "\(show(s.ot))|\(show(s.nt))|\(show(s.wisdom))" }
func show(_ s: NtDeepRepeatState) -> String { "\(show(s.ot))|i\(s.curriculumIndex)|d\(s.dayInSegment)|t\(s.segmentDayTarget)|p\(s.pace)" }
func keys(_ raw: String) -> [String: [String]] {
    let parts = raw.split(separator: ";", omittingEmptySubsequences: false).map { $0.split(separator: ",").map(String.init) }
    return ["ot": parts.count > 0 ? parts[0] : [], "nt": parts.count > 1 ? parts[1] : [], "wisdom": parts.count > 2 ? parts[2] : []]
}

var out: [String] = []
for line in lines {
    let f = line.split(separator: "\t", omittingEmptySubsequences: false).map(String.init)
    switch f[0] {
    case "epoch": out.append("\(PlanDates.daySinceEpoch(date(f[1])))")
    case "dayindex":
        let prefs = ReadingPlanPrefs(planId: "x", anchor: PlanAnchor(rawValue: f[1])!, startedOn: f[2].isEmpty ? nil : f[2])
        out.append("\(ReadingPlanRules.dayIndex(prefs, dayCount: Int(f[3])!, now: date(f[4])))")
    case "ntday":
        let prefs = ReadingPlanPrefs(planId: ReadingPlanCatalog.ntDeepRepeatId, anchor: .fromToday, startedOn: f[1].isEmpty ? nil : f[1])
        out.append("\(ReadingPlanRules.ntPlanDay(prefs, now: date(f[2])))")
    case "triple": out.append(show(TripleLoop.stateForPlanDay(Int(f[1])!)))
    case "triplefix":
        let s = TripleLoopState(ot: ptr(f[2]), nt: ptr(f[3]), wisdom: ptr(f[4]))
        let day = Int(f[1])!
        out.append(show(TripleLoop.clipCoordinatedAhead(TripleLoop.snapToPlanDay(s, day), day)))
    case "tripleadv":
        let s = TripleLoopState(ot: ptr(f[2]), nt: ptr(f[3]), wisdom: ptr(f[4]))
        out.append(show(TripleLoop.advanceTrack(s, TripleTrack(rawValue: f[1])!)))
    case "tripleread":
        var s = TripleLoop.defaultState(); s.chaptersReadKeys = keys(f[3])
        let r = TripleLoop.addChapterRead(TripleLoop.normalize(s), bookId: f[1], chapter: Int(f[2])!)
        out.append("\(r.chaptersRead["ot"]!),\(r.chaptersRead["nt"]!),\(r.chaptersRead["wisdom"]!)|\(r.chaptersReadKeys["ot"]!.joined(separator: ","));\(r.chaptersReadKeys["nt"]!.joined(separator: ","));\(r.chaptersReadKeys["wisdom"]!.joined(separator: ","))")
    case "ntseg": out.append(NtDeepRepeat.segment(Int(f[1])!)?.key ?? "null")
    case "ntstate": out.append(show(NtDeepRepeat.stateForPlanDay(Int(f[1])!, pace: Int(f[2])!, startedAt: f[3])))
    case "ntinfer":
        var s = NtDeepRepeat.defaultState(pace: Int(f[3])!); s.curriculumIndex = Int(f[1])!; s.dayInSegment = Int(f[2])!; s.segmentDayTarget = Int(f[3])!; s.startedAt = f[4]
        out.append("\(NtDeepRepeat.inferPlanDay(s, startedOn: f[4]))")
    case "ntadvnt":
        var s = NtDeepRepeat.defaultState(pace: Int(f[3])!); s.curriculumIndex = Int(f[1])!; s.dayInSegment = Int(f[2])!; s.segmentDayTarget = Int(f[4])!
        let r = NtDeepRepeat.advanceNtDay(s)
        out.append("\(show(r))|nt\(r.chaptersRead["nt"]!)")
    case "fmt":
        let r = PlanReading(bookId: f[1], startChapter: Int(f[2])!, endChapter: Int(f[3])!)
        out.append("\(r.display)|\(TripleLoop.formatVerbose(f[1], Int(f[2])!))")
    case "ntfmt":
        let r = PlanReading(bookId: f[1], startChapter: Int(f[2])!, endChapter: Int(f[3])!)
        out.append("\(NtDeepRepeat.rangeLine(r))|\(NtDeepRepeat.otLine(f[1], Int(f[2])!))")
    case "dur": out.append(NtDeepRepeat.formatApproxDurationZh(Int(f[1])!))
    case "catalog": out.append(ReadingPlanCatalog.plans.map { $0.planId }.joined(separator: ",") + "|" + ReadingPlanCatalog.featured.map { $0.planId }.joined(separator: ","))
    case "curriculum": out.append(NtDeepRepeat.curriculum.map { $0.key }.joined(separator: ";"))
    case "orders": out.append(TripleLoop.otOrder.joined(separator: ",") + "|" + TripleLoop.ntOrder.joined(separator: ",") + "|" + NtDeepRepeat.otOrder.joined(separator: ","))
    // 播放页
    case "ahead": out.append("\(PlanPlay.contentAhead(view: Int(f[1])!, committed: Int(f[2])!))")
    case "aheadsel":
        let p = ReadingPlanPrefs(planId: f[1], anchor: PlanAnchor(rawValue: f[2])!, startedOn: f[3].isEmpty ? nil : f[3], dayCount: Int(f[4]))
        out.append(PlanPlay.isAheadSelectable(p, dayCount: Int(f[4]), ahead: Int(f[5])!, now: date(f[6])) ? "1" : "0")
    case "planday":
        let p = ReadingPlanPrefs(planId: f[1], anchor: PlanAnchor(rawValue: f[2])!, startedOn: f[3].isEmpty ? nil : f[3], dayCount: Int(f[4]))
        out.append("\(PlanPlay.planDayNumber(p, dayCount: Int(f[4]), contentAhead: Int(f[5])!, now: date(f[6])))")
    case "regidx":
        let p = ReadingPlanPrefs(planId: "x", anchor: PlanAnchor(rawValue: f[1])!, startedOn: f[2].isEmpty ? nil : f[2], dayCount: Int(f[3]))
        out.append("\(PlanPlay.registryDayIndex(p, dayCount: Int(f[3])!, contentAhead: Int(f[4])!, now: date(f[5])))")
    case "calgrid":
        let listened = Set(f[5].split(separator: ",").map(String.init).filter { !$0.isEmpty })
        let spec = f[6].split(separator: ":").map(String.init)
        let sel: (Int) -> Bool = spec[0] == "all" ? { _ in true } : { a in a >= Int(spec[1])! && a <= Int(spec[2])! }
        out.append(PlanPlay.describe(PlanPlay.monthGrid(year: Int(f[1])!, month: Int(f[2])!, today: date(f[3]), viewAhead: Int(f[4])!, listened: listened, selectable: sel)))
    default: out.append("?")
    }
}
let enc = JSONEncoder(); enc.outputFormatting = [.withoutEscapingSlashes]
FileHandle.standardOutput.write(try enc.encode(out))
