import SwiftUI

/// 一节经文。`isDivineSpeech` 对应 RN 版 divineSpeechHighlightSplit 的红字判定。
struct Verse: Identifiable, Hashable {
    let number: Int
    let text: String
    /// 有交叉引用的节号用 accent 色（verseNum），否则用 verseNumMuted
    var hasCrossRef: Bool = false
    var isDivineSpeech: Bool = false
    /// 用户划的重点 / 双击收藏，整块 verseBookmarkMarker 黄底
    var isBookmarked: Bool = false

    var id: Int { number }
}

struct ChapterContent: Identifiable, Hashable {
    let bookId: String
    let bookName: String
    let chapter: Int
    /// 段落小标题，例如「创造」「撒种比喻」
    let sectionTitle: String?
    let verses: [Verse]

    var id: String { "\(bookId).\(chapter)" }
    var displayTitle: String { "\(bookName) \(chapter)" }
}

/// 示例章节内容。Phase 1 会换成原生 SQLite 数据层，这里先让界面跑起来。
enum SampleContent {
    static let genesis1 = ChapterContent(
        bookId: "GEN",
        bookName: "Genesis",
        chapter: 1,
        sectionTitle: "Creation",
        verses: [
            Verse(number: 1, text: "In the beginning, God created the heavens and the earth.", hasCrossRef: true),
            Verse(number: 2, text: "The earth was without form and void, and darkness was over the face of the deep. And the Spirit of God was hovering over the face of the waters."),
            Verse(number: 3, text: "And God said, \u{201C}Let there be light,\u{201D} and there was light.", hasCrossRef: true, isDivineSpeech: true),
            Verse(number: 4, text: "And God saw that the light was good. And God separated the light from the darkness."),
            Verse(number: 5, text: "God called the light Day, and the darkness he called Night. And there was evening and there was morning, the first day."),
            Verse(number: 6, text: "And God said, \u{201C}Let there be an expanse in the midst of the waters, and let it separate the waters from the waters.\u{201D}", isDivineSpeech: true),
        ]
    )
}

/// 首页金句
struct GoldenVerse: Hashable {
    let text: String
    let reference: String

    static let sample = GoldenVerse(
        text: "凡自高的，必降为卑；自卑的，必升为高。",
        reference: "马太福音 23:12"
    )
}
