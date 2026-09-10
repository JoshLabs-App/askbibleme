import Foundation

// 时间轴自检：查询 + 由播放位置定位当前节
let dir = URL(fileURLWithPath: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : ".")
guard let db = VerseTimingDatabase(directory: dir) else {
    FileHandle.standardError.write("时间轴库打不开\n".data(using: .utf8)!)
    exit(1)
}

struct ChapterReport: Encodable {
    let label: String
    let count: Int
    let firstVerse: Int?
    let firstStart: Double?
    let lastVerse: Int?
    let lastEnd: Double?
    let monotonic: Bool
    let lookups: [String]
}
var reports: [ChapterReport] = []

// web-en 的时间轴源数据只覆盖 28 卷（无 GEN / JHN），这是数据现状不是缺陷；
// 所以只对它覆盖到的书卷断言，同时明确记下未覆盖的应当查不到。
let cases: [(String, String, String, Int)] = [
    ("cuv-simp 创1", "cuv-simp", "GEN", 1),
    ("cuv-trad 太13", "cuv-trad", "MAT", 13),
    ("cuv-simp 诗23", "cuv-simp", "PSA", 23),
    ("web-en 太13", "web-en", "MAT", 13),
    ("web-en 创1（源数据未覆盖）", "web-en", "GEN", 1),
]

for (label, tid, book, ch) in cases {
    let t = db.timings(translationId: tid, bookId: book, chapter: ch)
    // start 必须严格递增，否则二分查找的前提不成立
    var monotonic = true
    for i in 1..<max(1, t.count) where t[i].start < t[i-1].start { monotonic = false }

    var lookups: [String] = []
    if let f = t.first, let l = t.last {
        let probes: [(String, Double)] = [
            ("开播前", max(0, f.start - 1)),
            ("首节中", (f.start + f.end) / 2),
            ("首节末", f.end - 0.01),
            ("末节中", (l.start + l.end) / 2),
            ("播完后", l.end + 5),
        ]
        for (name, time) in probes {
            let v = VerseTimingLookup.activeVerse(at: time, in: t)
            lookups.append("\(name)@\(String(format: "%.2f", time))→\(v.map(String.init) ?? "nil")")
        }
    }
    reports.append(ChapterReport(
        label: label, count: t.count,
        firstVerse: t.first?.verse, firstStart: t.first?.start,
        lastVerse: t.last?.verse, lastEnd: t.last?.end,
        monotonic: monotonic, lookups: lookups))
}

let enc = JSONEncoder()
enc.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
FileHandle.standardOutput.write(try enc.encode(reports))
