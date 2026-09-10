import Foundation

// 数据层自检：四个内置译本 + xref 库能否打开、内容是否确实不同、章数是否正确。
// 直接跑 App 里那份 ScriptureDatabase.swift。
struct Report: Encodable {
    var translations: [TranslationReport] = []
    var xrefGen1: [Int] = []
    var errors: [String] = []
}
struct TranslationReport: Encodable {
    let id: String
    let gen1_1: String
    let gen1VerseCount: Int
    let genChapterCount: Int
    let markChapterCount: Int
    let firstDivineVerse: String?
}

// 库目录由参数传入（命令行 Bundle.main 指向可执行文件，不是 cwd）
let dir = URL(fileURLWithPath: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : ".")
var report = Report()

for id in ["cuv-simp", "cuv-trad", "web-en", "ust-en"] {
    do {
        let db = try ScriptureDatabase(translationId: id, directory: dir)
        let gen1 = try db.loadChapter(bookId: "GEN", chapter: 1)
        let firstDivine = gen1.first { v in
            (v.speechParts ?? []).contains { $0.kind == .divine }
        }
        report.translations.append(TranslationReport(
            id: id,
            gen1_1: gen1.first?.text ?? "<空>",
            gen1VerseCount: gen1.count,
            genChapterCount: db.chapterCount(bookId: "GEN"),
            markChapterCount: db.chapterCount(bookId: "MRK"),
            firstDivineVerse: firstDivine.map { "v\($0.number): " + ((($0.speechParts ?? []).first { $0.kind == .divine })?.text ?? "") }
        ))
    } catch {
        report.errors.append("\(id): \(error.localizedDescription)")
    }
}

if let xref = XrefDatabase(directory: dir) {
    report.xrefGen1 = Array(xref.versesWithXrefs(bookId: "GEN", chapter: 1)).sorted()
} else {
    report.errors.append("xref 库打不开")
}

let enc = JSONEncoder()
enc.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
FileHandle.standardOutput.write(try enc.encode(report))
