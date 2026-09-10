import Foundation

/// 在线译本（YouVersion）逐章正文：设备直抓 bible.com 公开章节页，解析与 RN `lib/bible/youversion-chapter-page.ts` 同一套
/// （先试 flight 载荷、再试转义嵌入、再试整页、最后 __NEXT_DATA__；三种节标记正则；去脚注 / 交叉引用；垃圾文本判定）。
/// 抓到后落盘 Caches/remote-chapters/<译本>/<BOOK>.<章>.json，下次离线可读。不经 askbible.me（RN 同样如此）。
actor RemoteChapterStore {
    static let shared = RemoteChapterStore()

    struct Row: Codable, Equatable {
        let verse: Int
        let text: String
    }

    private var memory: [String: [Row]] = [:]

    func load(_ t: ScriptureTranslation, bookId: String, chapter: Int) async -> [Row]? {
        let book = bookId.uppercased()
        let key = "\(t.id):\(book):\(chapter)"
        if let hit = memory[key] { return hit }
        if let cached = Self.readDisk(t.id, book, chapter) { memory[key] = cached; return cached }
        // 先问网站接口（服务端走 YouVersion 官方平台接口，带密钥、稳定）；拿不到再退回抓 bible.com 公开页
        if let rows = await Self.fetchViaSite(t, book: book, chapter: chapter), !rows.isEmpty {
            memory[key] = rows
            Self.writeDisk(t.id, book, chapter, rows)
            return rows
        }
        for url in Self.pageURLs(t, book: book, chapter: chapter) {
            guard let html = await Self.fetchHTML(url) else { continue }
            let rows = YouVersionPage.parse(html)
            if !rows.isEmpty {
                memory[key] = rows
                Self.writeDisk(t.id, book, chapter, rows)
                return rows
            }
        }
        return nil
    }

    /// 已缓存过的章（同步 peek，给搜索 / 对照预览这类不该等网络的地方）
    nonisolated static func cached(_ translationId: String, bookId: String, chapter: Int) -> [Row]? {
        readDisk(translationId, bookId.uppercased(), chapter)
    }

    // MARK: 网站接口（/api/mobile/bible/youversion/chapter → {ok, verses:[{verse,text}]}）

    static func fetchViaSite(_ t: ScriptureTranslation, book: String, chapter: Int) async -> [Row]? {
        guard !t.remoteId.isEmpty, chapter >= 1,
              let url = URL(string: "\(RemoteTranslations.chapterEndpoint)?versionId=\(t.remoteId)&bookId=\(book)&chapter=\(chapter)") else { return nil }
        var req = URLRequest(url: url, timeoutInterval: 25)
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        guard let (data, resp) = try? await URLSession.shared.data(for: req),
              (resp as? HTTPURLResponse)?.statusCode == 200,
              let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let list = root["verses"] as? [[String: Any]] else { return nil }
        let rows: [Row] = list.compactMap { item in
            guard let v = item["verse"] as? Int,
                  let text = (item["text"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !text.isEmpty else { return nil }
            return Row(verse: v, text: text)
        }
        return rows.isEmpty ? nil : rows
    }

    // MARK: URL（RN buildYouVersionChapterPageUrls）

    static func pageURLs(_ t: ScriptureTranslation, book: String, chapter: Int) -> [URL] {
        var urls: [String] = []
        func push(_ u: String) { if !u.isEmpty, !urls.contains(u) { urls.append(u) } }
        func withLocales(_ u: String) {
            push(u)
            if !t.pageLocale.isEmpty { push(u.replacingOccurrences(of: "https://www.bible.com/", with: "https://www.bible.com/\(t.pageLocale)/")) }
        }
        guard !t.remoteId.isEmpty, chapter >= 1 else { return [] }
        // RN 先试音频章页（同样带经文），再文字页（带缩写 / 不带）
        if !t.abbreviation.isEmpty { withLocales("https://www.bible.com/audio-bible/\(t.remoteId)/\(book).\(chapter).\(t.abbreviation)") }
        let base = "https://www.bible.com/bible/\(t.remoteId)/\(book).\(chapter)"
        if !t.abbreviation.isEmpty { withLocales(base + "." + t.abbreviation) }
        withLocales(base)
        return urls.compactMap(URL.init(string:))
    }

    // MARK: 抓页（RN fetchYouVersionChapterPageHtml：先不带 UA，太短再带浏览器 UA）

    static func fetchHTML(_ url: URL) async -> String? {
        let base = ["Accept": "text/html,application/xhtml+xml,*/*;q=0.8", "Accept-Language": "zh-TW,zh-CN,zh;q=0.9,en;q=0.8"]
        let first = await fetchOnce(url, headers: base)
        if let first, first.count > 4_000 { return first }
        let second = await fetchOnce(url, headers: base.merging(["User-Agent": TranslationCatalog.browserUserAgent]) { $1 })
        return second ?? first
    }

    private static func fetchOnce(_ url: URL, headers: [String: String]) async -> String? {
        var req = URLRequest(url: url, timeoutInterval: 20)
        for (k, v) in headers { req.setValue(v, forHTTPHeaderField: k) }
        guard let (data, resp) = try? await URLSession.shared.data(for: req),
              let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode),
              let text = String(data: data, encoding: .utf8), !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
        return text
    }

    // MARK: 落盘

    private static var cacheDir: URL {
        let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        return base.appendingPathComponent("remote-chapters", isDirectory: true)
    }

    private static func file(_ id: String, _ book: String, _ chapter: Int) -> URL {
        cacheDir.appendingPathComponent(id, isDirectory: true).appendingPathComponent("\(book).\(chapter).json")
    }

    private static func readDisk(_ id: String, _ book: String, _ chapter: Int) -> [Row]? {
        guard let data = try? Data(contentsOf: file(id, book, chapter)),
              let rows = try? JSONDecoder().decode([Row].self, from: data), !rows.isEmpty else { return nil }
        return rows
    }

    private static func writeDisk(_ id: String, _ book: String, _ chapter: Int, _ rows: [Row]) {
        let url = file(id, book, chapter)
        try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        if let data = try? JSONEncoder().encode(rows) { try? data.write(to: url, options: .atomic) }
    }
}

/// bible.com 章节页解析（RN youversion-chapter-page.ts 的纯函数部分，逐段照搬）
enum YouVersionPage {
    typealias Row = RemoteChapterStore.Row

    private static var cache: [String: NSRegularExpression] = [:]
    private static func re(_ pattern: String, _ opts: NSRegularExpression.Options = []) -> NSRegularExpression {
        let key = pattern + (opts.contains(.caseInsensitive) ? "/i" : "")
        if let hit = cache[key] { return hit }
        let r = try! NSRegularExpression(pattern: pattern, options: opts)
        cache[key] = r
        return r
    }
    private static func replace(_ s: String, _ pattern: String, _ opts: NSRegularExpression.Options = [], with template: String) -> String {
        re(pattern, opts).stringByReplacingMatches(in: s, range: NSRange(s.startIndex..., in: s), withTemplate: template)
    }
    private static func test(_ s: String, _ pattern: String, _ opts: NSRegularExpression.Options = []) -> Bool {
        re(pattern, opts).firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) != nil
    }

    static func parse(_ html: String) -> [Row] {
        if html.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return [] }
        for payload in flightPayloads(html) where payload.contains("verse") && payload.contains("data-usfm") {
            let rows = parseContent(truncateRscTail(payload))
            if usable(rows) { return rows }
        }
        // 部分响应把经文章节以转义形式嵌在整页 HTML 里
        if html.contains("class=\\\"verse") || html.contains("data-usfm=\\") {
            let loosened = html.replacingOccurrences(of: "\\\"", with: "\"")
                .replacingOccurrences(of: "\\n", with: "\n")
                .replacingOccurrences(of: "\\u003c", with: "<", options: .caseInsensitive)
                .replacingOccurrences(of: "\\u003e", with: ">", options: .caseInsensitive)
            let rows = parseContent(loosened)
            if usable(rows) { return rows }
        }
        let direct = parseContent(html)
        if usable(direct) { return direct }
        let marker = "<script id=\"__NEXT_DATA__\" type=\"application/json\">"
        guard let start = html.range(of: marker), let end = html.range(of: "</script>", range: start.upperBound..<html.endIndex) else { return [] }
        let json = String(html[start.upperBound..<end.lowerBound])
        guard let data = json.data(using: .utf8), let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let props = obj["props"] as? [String: Any], let pageProps = props["pageProps"] as? [String: Any],
              let info = pageProps["chapterInfo"] as? [String: Any], let content = info["content"] as? String else { return [] }
        let rows = parseContent(content)
        return usable(rows) ? rows : []
    }

    /// RN extractYouVersionFlightPayloads：按 push 标记切片、逐个 JSON 解析字符串字面量，不用整页大正则
    static func flightPayloads(_ html: String) -> [String] {
        var payloads: [String] = []
        let marker = "self.__next_f.push([1,"
        let chars = Array(html.utf16)
        let markerChars = Array(marker.utf16)
        var from = 0
        while from < chars.count {
            guard let start = indexOf(markerChars, in: chars, from: from) else { break }
            let quoteAt = start + markerChars.count
            guard quoteAt < chars.count, chars[quoteAt] == 34 else { from = quoteAt; continue }  // "
            var i = quoteAt + 1
            var escaped = false
            while i < chars.count {
                let ch = chars[i]
                if escaped { escaped = false; i += 1; continue }
                if ch == 92 { escaped = true; i += 1; continue }  // backslash
                if ch == 34 { break }
                i += 1
            }
            guard i < chars.count, chars[i] == 34 else { from = quoteAt + 1; continue }
            let literal = String(utf16CodeUnits: Array(chars[quoteAt...i]), count: i - quoteAt + 1)
            if let data = literal.data(using: .utf8),
               let payload = (try? JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])) as? String, !payload.isEmpty {
                payloads.append(payload)
            }
            from = i + 1
        }
        return payloads
    }

    private static func indexOf(_ needle: [UInt16], in hay: [UInt16], from: Int) -> Int? {
        guard !needle.isEmpty, hay.count >= needle.count else { return nil }
        var i = from
        let last = hay.count - needle.count
        while i <= last {
            if hay[i] == needle[0] {
                var ok = true
                for j in 1..<needle.count where hay[i + j] != needle[j] { ok = false; break }
                if ok { return i }
            }
            i += 1
        }
        return nil
    }

    /// RN parseYouVersionChapterContent：经典 class="verse v1"；新版 CSS modules：*verse* + data-usfm（属性顺序不固定）
    static func parseContent(_ html: String) -> [Row] {
        let patterns = [
            "<span class=\"verse v(\\d+)\"[^>]*data-usfm=\"[^\"]+\">",
            "<(?:span|div)[^>]*data-usfm=\"[A-Z0-9]+\\.\\d+\\.(\\d+)\"[^>]*class=\"[^\"]*verse[^\"]*\"[^>]*>",
            "<(?:span|div)[^>]*class=\"[^\"]*verse[^\"]*\"[^>]*data-usfm=\"[A-Z0-9]+\\.\\d+\\.(\\d+)\"[^>]*>",
        ]
        for p in patterns {
            let rows = collect(html, re(p, .caseInsensitive))
            if !rows.isEmpty { return rows }
        }
        return []
    }

    private static func collect(_ source: String, _ verseStart: NSRegularExpression) -> [Row] {
        let clipped = truncateRscTail(source)
        let ns = clipped as NSString
        var starts: [(verse: Int, index: Int)] = []
        for m in verseStart.matches(in: clipped, range: NSRange(location: 0, length: ns.length)) {
            guard m.numberOfRanges > 1, let verse = Int(ns.substring(with: m.range(at: 1))), verse >= 1 else { continue }
            starts.append((verse, m.range.location))
        }
        if starts.isEmpty { return [] }
        var rows: [Row] = []
        for (i, start) in starts.enumerated() {
            let end = i + 1 < starts.count ? starts[i + 1].index : ns.length
            let block = ns.substring(with: NSRange(location: start.index, length: end - start.index))
            var text = plainText(block)
            text = replace(text, "^\\s*\(start.verse)\\s*", with: "").trimmingCharacters(in: .whitespacesAndNewlines)
            if text.isEmpty || garbage(text) { continue }
            if let idx = rows.firstIndex(where: { $0.verse == start.verse }) {
                if !rows[idx].text.contains(text) {
                    rows[idx] = Row(verse: start.verse, text: collapse(rows[idx].text + " " + text))
                }
                continue
            }
            rows.append(Row(verse: start.verse, text: text))
        }
        return rows.sorted { $0.verse < $1.verse }
    }

    /// RN extractYouVersionVersePlainText
    private static func plainText(_ block: String) -> String {
        let withoutNotes = stripNoteNodes(truncateRscTail(block))
        var chunks: [String] = []
        let contentRe = re("<(?:span|div)[^>]*class=\"[^\"]*(?:__content|_content|\\bcontent\\b)[^\"]*\"[^>]*>([\\s\\S]*?)</(?:span|div)>", .caseInsensitive)
        let ns = withoutNotes as NSString
        for m in contentRe.matches(in: withoutNotes, range: NSRange(location: 0, length: ns.length)) where m.numberOfRanges > 1 {
            let piece = collapse(decodeEntities(stripHtml(ns.substring(with: m.range(at: 1)))))
            if !piece.isEmpty { chunks.append(piece) }
        }
        var text = chunks.isEmpty ? decodeEntities(stripHtml(withoutNotes)) : chunks.joined(separator: " ")
        text = collapse(text)
        // 残留交叉引用标签（无 HTML 包裹时）
        text = replace(text, "#(?:ver|ch|vv?)\\.\\s*\\d+(?:\\s*[-–]\\s*\\d+)?", .caseInsensitive, with: " ")
        text = replace(text, "#[A-Z][a-z]{0,4}\\.?\\s*\\d+:\\d+(?:\\s*[-–]\\s*\\d+)?", with: " ")
        text = replace(text, "\\b\\d+:Tb\\d+,?", .caseInsensitive, with: " ")
        return collapse(text)
    }

    private static func collapse(_ s: String) -> String {
        replace(s, "\\s+", with: " ").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// RN stripYouVersionNoteNodes：去掉脚注 / 交叉引用节点，避免 `#ver. 13` 进正文
    static func stripNoteNodes(_ raw: String) -> String {
        var source = raw
        for _ in 0..<40 {
            let next = replace(source, "<(span|div)[^>]*class=\"[^\"]*(?:__note|\\bnote\\b|__x\\b)[^\"]*\"[^>]*>[\\s\\S]*?</\\1>", .caseInsensitive, with: "")
            if next == source { break }
            source = next
        }
        return source
    }

    static func stripHtml(_ raw: String) -> String {
        var s = replace(raw, "<\\s*br\\s*/?\\s*>", .caseInsensitive, with: "\n")
        s = replace(s, "</(p|div|section|article|header|footer|h[1-6]|li|tr|table)>", .caseInsensitive, with: "\n")
        s = replace(s, "<[^>]+>", with: "")
        s = s.replacingOccurrences(of: "\r", with: "")
        s = replace(s, "[ \\t]+\\n", with: "\n")
        s = replace(s, "\\n{3,}", with: "\n\n")
        return s.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func decodeEntities(_ raw: String) -> String {
        var s = raw
        for (from, to) in [("&nbsp;", " "), ("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", "\""), ("&#39;", "'")] {
            s = s.replacingOccurrences(of: from, with: to, options: .caseInsensitive)
        }
        s = decodeNumeric(s, "&#(\\d+);", radix: 10)
        s = decodeNumeric(s, "&#x([0-9a-f]+);", radix: 16)
        return s
    }

    private static func decodeNumeric(_ s: String, _ pattern: String, radix: Int) -> String {
        let r = re(pattern, .caseInsensitive)
        let ns = s as NSString
        var out = ""
        var last = 0
        for m in r.matches(in: s, range: NSRange(location: 0, length: ns.length)) {
            out += ns.substring(with: NSRange(location: last, length: m.range.location - last))
            let digits = ns.substring(with: m.range(at: 1))
            if let code = UInt32(digits, radix: radix), let scalar = Unicode.Scalar(code) { out += String(Character(scalar)) } else { out += ns.substring(with: m.range) }
            last = m.range.location + m.range.length
        }
        out += ns.substring(from: last)
        return out
    }

    /// RN truncateYouVersionRscTail：Flight / RSC 尾巴，末节常把 pageProps 拼进经文
    static func truncateRscTail(_ raw: String) -> String {
        if raw.isEmpty { return "" }
        let markers = ["\\d+:\\[\"\\$\"", "\\[\"\\$\",\"\\$L", "\\[\"\\$\",\"meta\"", "\\[\"\\$\",\"link\"", "\"analyticsUsfmRef\"", "\"pageProps\"", "\"audioVersionInfo\"", "self\\.__next_f"]
        let ns = raw as NSString
        var cut = ns.length
        for p in markers {
            if let m = re(p).firstMatch(in: raw, range: NSRange(location: 0, length: ns.length)), m.range.location >= 40, m.range.location < cut { cut = m.range.location }
        }
        return ns.substring(to: cut)
    }

    /// RN looksLikeYouVersionGarbageText
    static func garbage(_ text: String) -> Bool {
        if text.isEmpty { return true }
        if text.contains("[\"$,\"") || text.contains("[\"$\",\"") { return true }
        if text.contains("analyticsUsfmRef") || text.contains("pageProps") { return true }
        if text.contains("self.__next_f") || text.contains("fb:app_id") { return true }
        if text.contains("youversionapi.com") || text.contains("web-assets.youversion.com") { return true }
        if test(text, "https?://www\\.bible\\.com/", .caseInsensitive), text.count > 180 { return true }
        if text.count > 2800, test(text, "[\\[{]") { return true }
        return false
    }

    static func usable(_ rows: [Row]) -> Bool { !rows.isEmpty && !rows.contains { garbage($0.text) } }
}
