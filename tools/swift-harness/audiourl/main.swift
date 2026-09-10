import Foundation
struct Case { let tid: String; let id: String; let num: Int; let name: String; let ch: Int }
let cases = [
    Case(tid: "cuv-simp", id: "GEN", num: 1, name: "Genesis", ch: 1),
    Case(tid: "cuv-trad", id: "MAT", num: 40, name: "Matthew", ch: 13),
    Case(tid: "web-en", id: "GEN", num: 1, name: "Genesis", ch: 1),
    Case(tid: "web-en", id: "MAT", num: 40, name: "Matthew", ch: 13),
    Case(tid: "web-en", id: "SNG", num: 22, name: "Song of Solomon", ch: 2),
    Case(tid: "web-en", id: "1CO", num: 46, name: "1 Corinthians", ch: 13),
    Case(tid: "ust-en", id: "GEN", num: 1, name: "Genesis", ch: 1),
    // YouVersion：先问网站代理，check 脚本会真去问一次再测 mp3
    Case(tid: "niv", id: "JHN", num: 43, name: "John", ch: 3),
    Case(tid: "ccb-zh-hans", id: "GEN", num: 1, name: "Genesis", ch: 1),
    Case(tid: "rcuvss-zh-hans", id: "PSA", num: 19, name: "Psalms", ch: 23),
]
// 输出 JSON 供 Node 侧逐条实测可达性
struct Row: Encodable { let translation: String; let book: String; let chapter: Int; let url: String? }
let rows = cases.map { c in
    Row(translation: c.tid, book: c.id, chapter: c.ch,
        url: ChapterAudioSource.resolve(translationId: c.tid, bookId: c.id,
                                        bookNumber: c.num, bookName: c.name, chapter: c.ch)?.absoluteString)
}
let enc = JSONEncoder()
enc.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
FileHandle.standardOutput.write(try enc.encode(rows))
