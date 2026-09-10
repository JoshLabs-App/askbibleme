package me.askbible.native_.data

/**
 * 圣经目录。书卷号 / id / 中文名 / 章数逐条来自 RN 的 `lib/bible/scripture-books.ts`，
 * 与 iOS 的 `BibleCatalog.swift` 对等双写，一致性由 check:book-catalog 对拍保证。
 * 分组名与配色是本 App 目录页的设计（RN 版同款），按 bookNumber 划分归属。
 */
data class BookRef(
    val number: Int,
    val id: String,
    val nameZh: String,
    val nameEn: String,
    val chapterCount: Int,
) {
    val displayNumber: String get() = number.toString().padStart(2, '0')
}

data class BookGroup(
    /** RN scripture_canon_catalog.json 的 sectionId，三语标题按它查 LocaleTables */
    val id: String,
    val name: String,
    val colorHex: Int,
    val books: List<BookRef>,
)

object BibleCatalog {
    /** OLD_TESTAMENT_MAX_BOOK_NUMBER */
    const val OLD_TESTAMENT_MAX = 39

    val groups: List<BookGroup> = listOf(
    BookGroup(
        id = "canon-torah",
        name = "Torah",
        colorHex = 0x2F6291,
        books = listOf(
        BookRef(1, "GEN", "创世记", "Genesis", 50),
        BookRef(2, "EXO", "出埃及记", "Exodus", 40),
        BookRef(3, "LEV", "利未记", "Leviticus", 27),
        BookRef(4, "NUM", "民数记", "Numbers", 36),
        BookRef(5, "DEU", "申命记", "Deuteronomy", 34),
        ),
    ),
    BookGroup(
        id = "canon-history",
        name = "Historical books",
        colorHex = 0xB4560E,
        books = listOf(
        BookRef(6, "JOS", "约书亚记", "Joshua", 24),
        BookRef(7, "JDG", "士师记", "Judges", 21),
        BookRef(8, "RUT", "路得记", "Ruth", 4),
        BookRef(9, "1SA", "撒母耳记上", "1 Samuel", 31),
        BookRef(10, "2SA", "撒母耳记下", "2 Samuel", 24),
        BookRef(11, "1KI", "列王纪上", "1 Kings", 22),
        BookRef(12, "2KI", "列王纪下", "2 Kings", 25),
        BookRef(13, "1CH", "历代志上", "1 Chronicles", 29),
        BookRef(14, "2CH", "历代志下", "2 Chronicles", 36),
        BookRef(15, "EZR", "以斯拉记", "Ezra", 10),
        BookRef(16, "NEH", "尼希米记", "Nehemiah", 13),
        BookRef(17, "EST", "以斯帖记", "Esther", 10),
        ),
    ),
    BookGroup(
        id = "canon-wisdom",
        name = "Wisdom & poetry",
        colorHex = 0x4F7A3F,
        books = listOf(
        BookRef(18, "JOB", "约伯记", "Job", 42),
        BookRef(19, "PSA", "诗篇", "Psalms", 150),
        BookRef(20, "PRO", "箴言", "Proverbs", 31),
        BookRef(21, "ECC", "传道书", "Ecclesiastes", 12),
        BookRef(22, "SNG", "雅歌", "Song of Solomon", 8),
        ),
    ),
    BookGroup(
        id = "canon-major-prophets",
        name = "Major prophets",
        colorHex = 0x8A4A12,
        books = listOf(
        BookRef(23, "ISA", "以赛亚书", "Isaiah", 66),
        BookRef(24, "JER", "耶利米书", "Jeremiah", 52),
        BookRef(25, "LAM", "耶利米哀歌", "Lamentations", 5),
        BookRef(26, "EZK", "以西结书", "Ezekiel", 48),
        BookRef(27, "DAN", "但以理书", "Daniel", 12),
        ),
    ),
    BookGroup(
        id = "canon-minor-prophets",
        name = "Minor prophets",
        colorHex = 0x6B7A3F,
        books = listOf(
        BookRef(28, "HOS", "何西阿书", "Hosea", 14),
        BookRef(29, "JOL", "约珥书", "Joel", 3),
        BookRef(30, "AMO", "阿摩司书", "Amos", 9),
        BookRef(31, "OBA", "俄巴底亚书", "Obadiah", 1),
        BookRef(32, "JON", "约拿书", "Jonah", 4),
        BookRef(33, "MIC", "弥迦书", "Micah", 7),
        BookRef(34, "NAM", "那鸿书", "Nahum", 3),
        BookRef(35, "HAB", "哈巴谷书", "Habakkuk", 3),
        BookRef(36, "ZEP", "西番雅书", "Zephaniah", 3),
        BookRef(37, "HAG", "哈该书", "Haggai", 2),
        BookRef(38, "ZEC", "撒迦利亚书", "Zechariah", 14),
        BookRef(39, "MAL", "玛拉基书", "Malachi", 4),
        ),
    ),
    BookGroup(
        id = "canon-gospels",
        name = "Gospels",
        colorHex = 0xC1660B,
        books = listOf(
        BookRef(40, "MAT", "马太福音", "Matthew", 28),
        BookRef(41, "MRK", "马可福音", "Mark", 16),
        BookRef(42, "LUK", "路加福音", "Luke", 24),
        BookRef(43, "JHN", "约翰福音", "John", 21),
        ),
    ),
    BookGroup(
        id = "canon-church-history",
        name = "Church history",
        colorHex = 0x12786F,
        books = listOf(
        BookRef(44, "ACT", "使徒行传", "Acts", 28),
        ),
    ),
    BookGroup(
        id = "canon-pauline",
        name = "Pauline epistles",
        colorHex = 0x6D4FC4,
        books = listOf(
        BookRef(45, "ROM", "罗马书", "Romans", 16),
        BookRef(46, "1CO", "哥林多前书", "1 Corinthians", 16),
        BookRef(47, "2CO", "哥林多后书", "2 Corinthians", 13),
        BookRef(48, "GAL", "加拉太书", "Galatians", 6),
        BookRef(49, "EPH", "以弗所书", "Ephesians", 6),
        BookRef(50, "PHP", "腓立比书", "Philippians", 4),
        BookRef(51, "COL", "歌罗西书", "Colossians", 4),
        BookRef(52, "1TH", "帖撒罗尼迦前书", "1 Thessalonians", 5),
        BookRef(53, "2TH", "帖撒罗尼迦后书", "2 Thessalonians", 3),
        BookRef(54, "1TI", "提摩太前书", "1 Timothy", 6),
        BookRef(55, "2TI", "提摩太后书", "2 Timothy", 4),
        BookRef(56, "TIT", "提多书", "Titus", 3),
        BookRef(57, "PHM", "腓利门书", "Philemon", 1),
        ),
    ),
    BookGroup(
        id = "canon-general-epistles",
        name = "General epistles",
        colorHex = 0x9B4B8F,
        books = listOf(
        BookRef(58, "HEB", "希伯来书", "Hebrews", 13),
        BookRef(59, "JAS", "雅各书", "James", 5),
        BookRef(60, "1PE", "彼得前书", "1 Peter", 5),
        BookRef(61, "2PE", "彼得后书", "2 Peter", 3),
        BookRef(62, "1JN", "约翰一书", "1 John", 5),
        BookRef(63, "2JN", "约翰二书", "2 John", 1),
        BookRef(64, "3JN", "约翰三书", "3 John", 1),
        BookRef(65, "JUD", "犹大书", "Jude", 1),
        ),
    ),
    BookGroup(
        id = "canon-apocalyptic",
        name = "Apocalypse",
        colorHex = 0xA8324A,
        books = listOf(
        BookRef(66, "REV", "启示录", "Revelation", 22),
        ),
    ),
    )

    val all: List<BookRef> = groups.flatMap { it.books }

    val oldTestament: List<BookGroup> get() = groups.filter { it.books.first().number <= OLD_TESTAMENT_MAX }
    val newTestament: List<BookGroup> get() = groups.filter { it.books.first().number > OLD_TESTAMENT_MAX }

    fun book(id: String): BookRef? = all.firstOrNull { it.id == id }
}
