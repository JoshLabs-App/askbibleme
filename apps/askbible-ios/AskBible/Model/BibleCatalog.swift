import SwiftUI

/// 圣经目录。书卷号 / id / 中文名 / 章数逐条来自 RN 的 `lib/bible/scripture-books.ts`，
/// 与 Android 的 `BibleCatalog.kt` 对等双写，一致性由 check:book-catalog 对拍保证。
/// 分组名与配色是本 App 目录页的设计，按 bookNumber 划分归属。
struct BookRef: Identifiable, Hashable {
    let number: Int
    let id: String
    let nameZh: String
    let nameEn: String
    let chapterCount: Int

    var displayNumber: String { String(format: "%02d", number) }
    /// 旧代码的默认名（英文）；页面上请用 `name(_ locale:)` 按展示语言取
    var name: String { nameEn }
}

struct BookGroup: Identifiable, Hashable {
    /// RN scripture_canon_catalog.json 的 sectionId，三语标题按它查 LocaleTables
    let id: String
    let name: String
    let colorHex: UInt32
    let books: [BookRef]

    var color: Color { Color(rgb: colorHex) }
}

enum BibleCatalog {
    /// OLD_TESTAMENT_MAX_BOOK_NUMBER
    static let oldTestamentMax = 39

    static let groups: [BookGroup] = [
        BookGroup(id: "canon-torah", name: "Torah", colorHex: 0x2F6291, books: [
            BookRef(number: 1, id: "GEN", nameZh: "创世记", nameEn: "Genesis", chapterCount: 50),
            BookRef(number: 2, id: "EXO", nameZh: "出埃及记", nameEn: "Exodus", chapterCount: 40),
            BookRef(number: 3, id: "LEV", nameZh: "利未记", nameEn: "Leviticus", chapterCount: 27),
            BookRef(number: 4, id: "NUM", nameZh: "民数记", nameEn: "Numbers", chapterCount: 36),
            BookRef(number: 5, id: "DEU", nameZh: "申命记", nameEn: "Deuteronomy", chapterCount: 34),
        ]),
        BookGroup(id: "canon-history", name: "Historical books", colorHex: 0xB4560E, books: [
            BookRef(number: 6, id: "JOS", nameZh: "约书亚记", nameEn: "Joshua", chapterCount: 24),
            BookRef(number: 7, id: "JDG", nameZh: "士师记", nameEn: "Judges", chapterCount: 21),
            BookRef(number: 8, id: "RUT", nameZh: "路得记", nameEn: "Ruth", chapterCount: 4),
            BookRef(number: 9, id: "1SA", nameZh: "撒母耳记上", nameEn: "1 Samuel", chapterCount: 31),
            BookRef(number: 10, id: "2SA", nameZh: "撒母耳记下", nameEn: "2 Samuel", chapterCount: 24),
            BookRef(number: 11, id: "1KI", nameZh: "列王纪上", nameEn: "1 Kings", chapterCount: 22),
            BookRef(number: 12, id: "2KI", nameZh: "列王纪下", nameEn: "2 Kings", chapterCount: 25),
            BookRef(number: 13, id: "1CH", nameZh: "历代志上", nameEn: "1 Chronicles", chapterCount: 29),
            BookRef(number: 14, id: "2CH", nameZh: "历代志下", nameEn: "2 Chronicles", chapterCount: 36),
            BookRef(number: 15, id: "EZR", nameZh: "以斯拉记", nameEn: "Ezra", chapterCount: 10),
            BookRef(number: 16, id: "NEH", nameZh: "尼希米记", nameEn: "Nehemiah", chapterCount: 13),
            BookRef(number: 17, id: "EST", nameZh: "以斯帖记", nameEn: "Esther", chapterCount: 10),
        ]),
        BookGroup(id: "canon-wisdom", name: "Wisdom & poetry", colorHex: 0x4F7A3F, books: [
            BookRef(number: 18, id: "JOB", nameZh: "约伯记", nameEn: "Job", chapterCount: 42),
            BookRef(number: 19, id: "PSA", nameZh: "诗篇", nameEn: "Psalms", chapterCount: 150),
            BookRef(number: 20, id: "PRO", nameZh: "箴言", nameEn: "Proverbs", chapterCount: 31),
            BookRef(number: 21, id: "ECC", nameZh: "传道书", nameEn: "Ecclesiastes", chapterCount: 12),
            BookRef(number: 22, id: "SNG", nameZh: "雅歌", nameEn: "Song of Solomon", chapterCount: 8),
        ]),
        BookGroup(id: "canon-major-prophets", name: "Major prophets", colorHex: 0x8A4A12, books: [
            BookRef(number: 23, id: "ISA", nameZh: "以赛亚书", nameEn: "Isaiah", chapterCount: 66),
            BookRef(number: 24, id: "JER", nameZh: "耶利米书", nameEn: "Jeremiah", chapterCount: 52),
            BookRef(number: 25, id: "LAM", nameZh: "耶利米哀歌", nameEn: "Lamentations", chapterCount: 5),
            BookRef(number: 26, id: "EZK", nameZh: "以西结书", nameEn: "Ezekiel", chapterCount: 48),
            BookRef(number: 27, id: "DAN", nameZh: "但以理书", nameEn: "Daniel", chapterCount: 12),
        ]),
        BookGroup(id: "canon-minor-prophets", name: "Minor prophets", colorHex: 0x6B7A3F, books: [
            BookRef(number: 28, id: "HOS", nameZh: "何西阿书", nameEn: "Hosea", chapterCount: 14),
            BookRef(number: 29, id: "JOL", nameZh: "约珥书", nameEn: "Joel", chapterCount: 3),
            BookRef(number: 30, id: "AMO", nameZh: "阿摩司书", nameEn: "Amos", chapterCount: 9),
            BookRef(number: 31, id: "OBA", nameZh: "俄巴底亚书", nameEn: "Obadiah", chapterCount: 1),
            BookRef(number: 32, id: "JON", nameZh: "约拿书", nameEn: "Jonah", chapterCount: 4),
            BookRef(number: 33, id: "MIC", nameZh: "弥迦书", nameEn: "Micah", chapterCount: 7),
            BookRef(number: 34, id: "NAM", nameZh: "那鸿书", nameEn: "Nahum", chapterCount: 3),
            BookRef(number: 35, id: "HAB", nameZh: "哈巴谷书", nameEn: "Habakkuk", chapterCount: 3),
            BookRef(number: 36, id: "ZEP", nameZh: "西番雅书", nameEn: "Zephaniah", chapterCount: 3),
            BookRef(number: 37, id: "HAG", nameZh: "哈该书", nameEn: "Haggai", chapterCount: 2),
            BookRef(number: 38, id: "ZEC", nameZh: "撒迦利亚书", nameEn: "Zechariah", chapterCount: 14),
            BookRef(number: 39, id: "MAL", nameZh: "玛拉基书", nameEn: "Malachi", chapterCount: 4),
        ]),
        BookGroup(id: "canon-gospels", name: "Gospels", colorHex: 0xC1660B, books: [
            BookRef(number: 40, id: "MAT", nameZh: "马太福音", nameEn: "Matthew", chapterCount: 28),
            BookRef(number: 41, id: "MRK", nameZh: "马可福音", nameEn: "Mark", chapterCount: 16),
            BookRef(number: 42, id: "LUK", nameZh: "路加福音", nameEn: "Luke", chapterCount: 24),
            BookRef(number: 43, id: "JHN", nameZh: "约翰福音", nameEn: "John", chapterCount: 21),
        ]),
        BookGroup(id: "canon-church-history", name: "Church history", colorHex: 0x12786F, books: [
            BookRef(number: 44, id: "ACT", nameZh: "使徒行传", nameEn: "Acts", chapterCount: 28),
        ]),
        BookGroup(id: "canon-pauline", name: "Pauline epistles", colorHex: 0x6D4FC4, books: [
            BookRef(number: 45, id: "ROM", nameZh: "罗马书", nameEn: "Romans", chapterCount: 16),
            BookRef(number: 46, id: "1CO", nameZh: "哥林多前书", nameEn: "1 Corinthians", chapterCount: 16),
            BookRef(number: 47, id: "2CO", nameZh: "哥林多后书", nameEn: "2 Corinthians", chapterCount: 13),
            BookRef(number: 48, id: "GAL", nameZh: "加拉太书", nameEn: "Galatians", chapterCount: 6),
            BookRef(number: 49, id: "EPH", nameZh: "以弗所书", nameEn: "Ephesians", chapterCount: 6),
            BookRef(number: 50, id: "PHP", nameZh: "腓立比书", nameEn: "Philippians", chapterCount: 4),
            BookRef(number: 51, id: "COL", nameZh: "歌罗西书", nameEn: "Colossians", chapterCount: 4),
            BookRef(number: 52, id: "1TH", nameZh: "帖撒罗尼迦前书", nameEn: "1 Thessalonians", chapterCount: 5),
            BookRef(number: 53, id: "2TH", nameZh: "帖撒罗尼迦后书", nameEn: "2 Thessalonians", chapterCount: 3),
            BookRef(number: 54, id: "1TI", nameZh: "提摩太前书", nameEn: "1 Timothy", chapterCount: 6),
            BookRef(number: 55, id: "2TI", nameZh: "提摩太后书", nameEn: "2 Timothy", chapterCount: 4),
            BookRef(number: 56, id: "TIT", nameZh: "提多书", nameEn: "Titus", chapterCount: 3),
            BookRef(number: 57, id: "PHM", nameZh: "腓利门书", nameEn: "Philemon", chapterCount: 1),
        ]),
        BookGroup(id: "canon-general-epistles", name: "General epistles", colorHex: 0x9B4B8F, books: [
            BookRef(number: 58, id: "HEB", nameZh: "希伯来书", nameEn: "Hebrews", chapterCount: 13),
            BookRef(number: 59, id: "JAS", nameZh: "雅各书", nameEn: "James", chapterCount: 5),
            BookRef(number: 60, id: "1PE", nameZh: "彼得前书", nameEn: "1 Peter", chapterCount: 5),
            BookRef(number: 61, id: "2PE", nameZh: "彼得后书", nameEn: "2 Peter", chapterCount: 3),
            BookRef(number: 62, id: "1JN", nameZh: "约翰一书", nameEn: "1 John", chapterCount: 5),
            BookRef(number: 63, id: "2JN", nameZh: "约翰二书", nameEn: "2 John", chapterCount: 1),
            BookRef(number: 64, id: "3JN", nameZh: "约翰三书", nameEn: "3 John", chapterCount: 1),
            BookRef(number: 65, id: "JUD", nameZh: "犹大书", nameEn: "Jude", chapterCount: 1),
        ]),
        BookGroup(id: "canon-apocalyptic", name: "Apocalypse", colorHex: 0xA8324A, books: [
            BookRef(number: 66, id: "REV", nameZh: "启示录", nameEn: "Revelation", chapterCount: 22),
        ]),
    ]

    static let all: [BookRef] = groups.flatMap(\.books)

    static var oldTestament: [BookGroup] { groups.filter { ($0.books.first?.number ?? 0) <= oldTestamentMax } }
    static var newTestament: [BookGroup] { groups.filter { ($0.books.first?.number ?? 0) > oldTestamentMax } }

    static func book(id: String) -> BookRef? { all.first { $0.id == id } }
}
