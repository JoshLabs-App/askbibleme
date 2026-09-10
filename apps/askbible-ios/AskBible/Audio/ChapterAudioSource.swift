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

    // MARK: YouVersion（RN youversion-chapter-audio.ts 的 YOUVERSION_AUDIO_VERSION_IDS）
    //
    // Josh 2026-09-10：「YouVersion 里有的版本全放开来接入，不需要人为去选」—— RN 的 VERIFIED 名单是空的、原生这里不设名单。
    // bible.com 的音频页现在有 JS 反爬壳（直接抓只拿到 Client Challenge），所以走网站自己的代理 /api/read/chapter-audio
    // 拿 CDN 的 mp3 地址（audio-bible-cdn.youversionapi.com），音频本身不经 askbible.me。
    static let youVersionVersionIds: [String: String] = [
        "asv": "12", "esv": "59", "ccb-zh-hans": "36", "ccb-zh-hant": "1392", "cnv-zh-hant": "40", "cnvs-zh-hans": "41",
        "csbs-zh-hans": "43", "csbt-zh-hant": "312", "cunp-zh-hant": "46", "cunp-zh-hant-god": "414",
        "cunpss-zh-hans": "48", "cunpss-zh-hant": "47", "rcuv-zh-hant": "139", "rcuvss-zh-hans": "140",
        "niv": "111", "nlt": "116", "nkjv": "114", "kjv": "1",
    ]
    static let chapterAudioProxyBase = "https://askbible.me/api/read/chapter-audio"

    /// 走 YouVersion 音源的译本（和合本 / KJV / WEB 有直连音源的优先直连）
    static func usesYouVersionAudio(_ translationId: String) -> Bool {
        let id = translationId.trimmingCharacters(in: .whitespaces).lowercased()
        if supportsCuvAudio(id) || id == "kjv" || usesWebAudio(id) { return false }
        return youVersionVersionIds[id] != nil
    }

    /// 代理地址：返回 {"src": "<CDN mp3>"}；播放器先问它再装载
    static func youVersionResolveURL(translationId: String, bookId: String, chapter: Int) -> URL? {
        let id = translationId.trimmingCharacters(in: .whitespaces).lowercased()
        let book = bookId.trimmingCharacters(in: .whitespaces).uppercased()
        guard chapter >= 1, youVersionVersionIds[id] != nil, !book.isEmpty else { return nil }
        return URL(string: "\(chapterAudioProxyBase)?translationId=\(id)&bookId=\(book)&chapter=\(chapter)")
    }

    /// 这是「先问代理」的地址，不是能直接播的 mp3
    static func isResolverURL(_ url: URL) -> Bool {
        url.absoluteString.hasPrefix(chapterAudioProxyBase)
    }

    /// 代理返回的 JSON → mp3 地址（只认 youversionapi.com 的 https 直链）
    static func parseResolverResponse(_ text: String) -> URL? {
        guard let data = text.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let src = (obj["src"] as? String)?.trimmingCharacters(in: .whitespaces),
              src.hasPrefix("https://"), src.contains("youversionapi.com"),
              let url = URL(string: src) else { return nil }
        return url
    }

    /// 已问到的 mp3 地址（key = 译本.书卷.章），同一会话内不重复问
    nonisolated(unsafe) static var resolvedCache: [String: URL] = [:]

    /// 问代理拿 mp3 地址（15 秒超时；失败回 nil）
    static func fetchResolved(_ resolver: URL, cacheKey: String) async -> URL? {
        if let hit = resolvedCache[cacheKey] { return hit }
        var req = URLRequest(url: resolver, timeoutInterval: 15)
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        guard let (data, resp) = try? await URLSession.shared.data(for: req),
              (resp as? HTTPURLResponse)?.statusCode == 200,
              let url = parseResolverResponse(String(decoding: data, as: UTF8.self)) else { return nil }
        resolvedCache[cacheKey] = url
        return url
    }

    /// 这个译本有没有整章音源（直连或 YouVersion）
    static func hasAudio(_ translationId: String) -> Bool {
        supportsCuvAudio(translationId) || translationId.lowercased() == "kjv" || usesWebAudio(translationId) || usesYouVersionAudio(translationId)
    }

    /// 当前译本下这一章的可播地址；没有音源的译本返回 nil（UI 据此禁用播放键）。
    /// YouVersion 译本返回的是代理地址（isResolverURL），壳要先 fetchResolved 再装载。
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
        if usesYouVersionAudio(translationId) {
            return youVersionResolveURL(translationId: translationId, bookId: bookId, chapter: chapter)
        }
        // ust-en 在 RN 侧也没有整章音源
        return nil
    }
}
