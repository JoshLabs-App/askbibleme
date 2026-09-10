import Foundation

/// 整章朗读的音源解析。
///
/// RN 侧 `read-chapter-audio.ts` 有多条分流（bundled / cuv / web / YouVersion / ESV /
/// 已下载），这里先只搬 cuv 这一条 —— 默认译本走的就是它，规则来自
/// `cuv-chapter-audio.ts`：`{base}/{书卷号}/{书卷号}_{章号补三位}.mp3`。
enum ChapterAudioSource {
    /// CUV_CHAPTER_AUDIO_REMOTE_BASE
    static let cuvRemoteBase = "https://media.fhl.net/unvdavid"

    /// translationSupportsCuvChapterAudio
    static func supportsCuvAudio(_ translationId: String) -> Bool {
        translationId.trimmingCharacters(in: .whitespaces).lowercased().hasPrefix("cuv")
    }

    /// buildExternalCuvChapterAudioUrl
    static func cuvChapterURL(bookNumber: Int, chapter: Int) -> URL? {
        guard bookNumber >= 1, chapter >= 1 else { return nil }
        let ch = String(format: "%03d", chapter)
        return URL(string: "\(cuvRemoteBase)/\(bookNumber)/\(bookNumber)_\(ch).mp3")
    }

    // MARK: - KJV（lib/bible/kjv-chapter-audio-url.ts：audiotreasure）

    static let kjvRemoteBase = "https://www.audiotreasure.com/content/KJV_AT"
    private static let kjvBookNames: [String: String] = [
        "GEN": "Genesis", "EXO": "Exodus", "LEV": "Leviticus", "NUM": "Numbers", "DEU": "Deuteronomy",
        "JOS": "Joshua", "JDG": "Judges", "RUT": "Ruth", "1SA": "1Samuel", "2SA": "2Samuel",
        "1KI": "1Kings", "2KI": "2Kings", "1CH": "1Chronicles", "2CH": "2Chronicles",
        "EZR": "Ezra", "NEH": "Nehemiah", "EST": "Esther", "JOB": "Job", "PSA": "Psalms",
        "PRO": "Proverbs", "ECC": "Ecclesiastes", "SNG": "SongofSolomon", "ISA": "Isaiah",
        "JER": "Jeremiah", "LAM": "Lamentations", "EZK": "Ezekiel", "DAN": "Daniel", "HOS": "Hosea",
        "JOL": "Joel", "AMO": "Amos", "OBA": "Obadiah", "JON": "Jonah", "MIC": "Micah", "NAM": "Nahum",
        "HAB": "Habakkuk", "ZEP": "Zephaniah", "HAG": "Haggai", "ZEC": "Zechariah", "MAL": "Malachi",
        "MAT": "Matthew", "MRK": "Mark", "LUK": "Luke", "JHN": "John", "ACT": "Acts", "ROM": "Romans",
        "1CO": "1Corinthians", "2CO": "2Corinthians", "GAL": "Galatians", "EPH": "Ephesians",
        "PHP": "Philippians", "COL": "Colossians", "1TH": "1Thessalonians", "2TH": "2Thessalonians",
        "1TI": "1Timothy", "2TI": "2Timothy", "TIT": "Titus", "PHM": "Philemon", "HEB": "Hebrews",
        "JAS": "James", "1PE": "1Peter", "2PE": "2Peter", "1JN": "1John", "2JN": "2John",
        "3JN": "3John", "JUD": "Jude", "REV": "Revelation",
    ]

    /// buildAudioTreasureKjvChapterUrl：`{base}/{书序两位}_{英文名}{章三位}.mp3`；单章小书第 1 章不带章号；约伯 / 雅歌有特殊 stem
    static func kjvChapterURL(bookId: String, bookNumber: Int, chapter: Int) -> URL? {
        let id = bookId.uppercased()
        guard bookNumber >= 1, chapter >= 1, let name = kjvBookNames[id] else { return nil }
        let ordinal = String(format: "%02d", bookNumber)
        if chapter == 1, ["PHM", "2JN", "3JN", "JUD"].contains(id) {
            return URL(string: "\(kjvRemoteBase)/\(ordinal)_\(name).mp3")
        }
        let stem = id == "JOB" ? "18_Job" : (id == "SNG" ? "22_Song_of_Soloman" : "\(ordinal)_\(name)")
        return URL(string: "\(kjvRemoteBase)/\(stem)\(String(format: "%03d", chapter)).mp3")
    }

    // MARK: - WEB（web-chapter-audio.ts）

    static let webRemoteNT = "https://theaudiopower.org/WEB/Recordings"
    static let webRemoteOT = "https://theaudiopower.org/WEB2/Recordings"
    /// OLD_TESTAMENT_MAX_BOOK_NUMBER
    static let oldTestamentMaxBookNumber = 39

    /// translationUsesWebChapterAudio（本工程只内置 web-en，kjv / blm-es 未进包）
    static func usesWebAudio(_ translationId: String) -> Bool {
        translationId.trimmingCharacters(in: .whitespaces).lowercased() == "web-en"
    }

    /// WEB_AUDIO_BOOK_NAME_OVERRIDES
    private static let webBookNameOverrides: [String: String] = [
        "PSA": "Psalms",
        "SNG": "Song of Solomon",
    ]

    /// buildExternalWebChapterAudioUrl —— `{base}/{英文书名 章号}.mp3`，书名和空格要转义
    static func webChapterURL(bookId: String, bookNumber: Int, bookName: String, chapter: Int) -> URL? {
        guard bookNumber >= 1, chapter >= 1 else { return nil }
        let id = bookId.uppercased()
        let name = webBookNameOverrides[id] ?? bookName
        let base = bookNumber <= oldTestamentMaxBookNumber ? webRemoteOT : webRemoteNT
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._~")
        guard let escaped = "\(name) \(chapter)".addingPercentEncoding(withAllowedCharacters: allowed) else { return nil }
        return URL(string: "\(base)/\(escaped).mp3")
    }

    /// 当前译本下这一章的可播地址；没有音源的译本返回 nil（UI 据此禁用播放键）。
    /// RN 侧还有 bundled / 已下载 / YouVersion / ESV 几条分流，尚未搬。
    static func resolve(translationId: String, bookId: String, bookNumber: Int,
                        bookName: String, chapter: Int) -> URL? {
        if supportsCuvAudio(translationId) {
            return cuvChapterURL(bookNumber: bookNumber, chapter: chapter)
        }
        if translationId.lowercased() == "kjv" {
            return kjvChapterURL(bookId: bookId, bookNumber: bookNumber, chapter: chapter)
        }
        if usesWebAudio(translationId) {
            return webChapterURL(bookId: bookId, bookNumber: bookNumber, bookName: bookName, chapter: chapter)
        }
        // ust-en 在 RN 侧也没有整章音源
        return nil
    }
}
