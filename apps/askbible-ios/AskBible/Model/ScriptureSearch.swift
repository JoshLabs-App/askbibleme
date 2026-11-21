import Foundation
import SQLite3

/// 经文搜索。规则逐条搬自 RN `src/bible/scripture-search.ts` + `search-scripture-verses.ts`，由 check:scripture-search 三端对拍：
/// 关键词 trim + 折叠空白；SQLite LIKE 转义；范围 全本 / 旧约 / 新约 / 本章（旧约 = 卷号 ≤ 39）；最多列 500 条并报总数（D-30）。
enum ScriptureSearchScope: String, CaseIterable { case all, old, new, chapter }

struct SearchChapterRef: Equatable { let bookId: String; let chapter: Int }

struct ScriptureSearchHit: Identifiable, Equatable {
    let bookId: String
    let bookName: String
    let chapter: Int
    let verse: Int
    let text: String
    var id: String { "\(bookId):\(chapter):\(verse)" }
}

/// 搜索结果：hits 最多 limit 条，total 是实际命中总数（> hits.count 说明被截断了）
struct ScriptureSearchResult: Equatable {
    let hits: [ScriptureSearchHit]
    let total: Int
    static let empty = ScriptureSearchResult(hits: [], total: 0)
    var truncated: Bool { total > hits.count }
}

struct SearchTextSegment: Equatable { let text: String; let match: Bool }

enum ScriptureSearchRules {
    static let minLength = 1
    /// 一次最多列出的条数；总数另报（D-30，原来是 RN 的 40）
    static let limit = 500
    static let defaultScope: ScriptureSearchScope = .all

    /// normalizeScriptureSearchQuery：trim + 连续空白折成一个空格
    static func normalize(_ raw: String) -> String {
        raw.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
    }

    /// escapeSqliteLikePattern：\ % _ 加反斜杠
    static func escapeLike(_ raw: String) -> String {
        raw.replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "%", with: "\\%")
            .replacingOccurrences(of: "_", with: "\\_")
    }

    static func isBookInScope(_ bookId: String, _ scope: ScriptureSearchScope) -> Bool {
        switch scope {
        case .all: return true
        case .chapter: return false
        case .old, .new:
            guard let book = BibleCatalog.book(id: bookId) else { return false }
            let isOld = book.number <= BibleCatalog.oldTestamentMax
            return scope == .old ? isOld : !isOld
        }
    }

    static func isVerseInScope(_ bookId: String, _ chapter: Int, _ scope: ScriptureSearchScope, _ ref: SearchChapterRef?) -> Bool {
        switch scope {
        case .all: return true
        case .chapter: return ref.map { $0.bookId == bookId && $0.chapter == chapter } ?? false
        default: return isBookInScope(bookId, scope)
        }
    }

    /// splitTextByScriptureSearchKeyword：按关键词切段（大小写不敏感），供命中高亮
    static func split(_ text: String, keyword: String) -> [SearchTextSegment] {
        let q = normalize(keyword)
        if q.isEmpty { return [SearchTextSegment(text: text, match: false)] }
        let lowerText = text.lowercased()
        let lowerQ = q.lowercased()
        var out: [SearchTextSegment] = []
        var cursor = lowerText.startIndex
        while cursor < lowerText.endIndex {
            guard let r = lowerText.range(of: lowerQ, range: cursor..<lowerText.endIndex) else {
                out.append(SearchTextSegment(text: String(text[cursor...]), match: false)); break
            }
            if r.lowerBound > cursor { out.append(SearchTextSegment(text: String(text[cursor..<r.lowerBound]), match: false)) }
            out.append(SearchTextSegment(text: String(text[r]), match: true))
            cursor = r.upperBound
        }
        return out.isEmpty ? [SearchTextSegment(text: text, match: false)] : out
    }
}

/// 书卷章节直达解析器（纯 Foundation，兼容 swiftc 独立编译测试）：
/// 支持「约 3:16」「诗 23」「创世记 1:1」「林前 13」「John 3:16」「Rom 8:28」「1 Cor 13」等常见缩写与全称。
struct ParsedScriptureRef: Equatable {
    let book: BookRef
    let chapter: Int
    let verse: Int?
}

enum ScriptureReferenceParser {
    private static let zhShortAliases: [(String, String)] = [
        ("创", "GEN"), ("出", "EXO"), ("利", "LEV"), ("民", "NUM"), ("申", "DEU"),
        ("书", "JOS"), ("士", "JDG"), ("得", "RUT"), ("撒上", "1SA"), ("撒下", "2SA"),
        ("王上", "1KI"), ("王下", "2KI"), ("代上", "1CH"), ("代下", "2CH"), ("拉", "EZR"),
        ("尼", "NEH"), ("斯", "EST"), ("伯", "JOB"), ("诗", "PSA"), ("詩", "PSA"),
        ("箴", "PRO"), ("传", "ECC"), ("傳", "ECC"), ("歌", "SNG"), ("赛", "ISA"), ("賽", "ISA"),
        ("耶", "JER"), ("哀", "LAM"), ("结", "EZK"), ("結", "EZK"), ("但", "DAN"),
        ("何", "HOS"), ("珥", "JOL"), ("摩", "AMO"), ("俄", "OBA"), ("拿", "JON"),
        ("弥", "MIC"), ("彌", "MIC"), ("鸿", "NAM"), ("鴻", "NAM"), ("哈", "HAB"),
        ("番", "ZEP"), ("该", "HAG"), ("該", "HAG"), ("亚", "ZEC"), ("亞", "ZEC"), ("玛", "MAL"), ("瑪", "MAL"),
        ("太", "MAT"), ("可", "MRK"), ("路", "LUK"), ("约一", "1JN"), ("約一", "1JN"),
        ("约二", "2JN"), ("約二", "2JN"), ("约三", "3JN"), ("約三", "3JN"),
        ("约壹", "1JN"), ("约贰", "2JN"), ("约叁", "3JN"),
        ("约", "JHN"), ("約", "JHN"), ("徒", "ACT"), ("罗", "ROM"), ("羅", "ROM"),
        ("林前", "1CO"), ("林后", "2CO"), ("林後", "2CO"), ("加", "GAL"), ("弗", "EPH"),
        ("腓", "PHP"), ("西", "COL"), ("帖前", "1TH"), ("帖后", "2TH"), ("帖後", "2TH"),
        ("提前", "1TI"), ("提后", "2TI"), ("提後", "2TI"), ("多", "TIT"), ("门", "PHM"), ("門", "PHM"),
        ("来", "HEB"), ("來", "HEB"), ("雅", "JAS"), ("彼前", "1PE"), ("彼后", "2PE"), ("彼後", "2PE"),
        ("犹", "JUD"), ("猶", "JUD"), ("启", "REV"), ("啟", "REV"),
        // 常见繁体全名补充
        ("創世記", "GEN"), ("出埃及記", "EXO"), ("利未記", "LEV"), ("民數記", "NUM"), ("申命記", "DEU"),
        ("約書亞記", "JOS"), ("士師記", "JDG"), ("路得記", "RUT"), ("詩篇", "PSA"), ("傳道書", "ECC"),
        ("以賽亞書", "ISA"), ("耶利米書", "JER"), ("馬太福音", "MAT"), ("馬可福音", "MRK"),
        ("路加福音", "LUK"), ("約翰福音", "JHN"), ("使徒行傳", "ACT"), ("羅馬書", "ROM"),
        ("哥林多前書", "1CO"), ("哥林多後書", "2CO"), ("以弗所書", "EPH"), ("腓立比書", "PHP"),
        ("希伯來書", "HEB"), ("彼得前書", "1PE"), ("彼得後書", "2PE"), ("約翰一書", "1JN"), ("啟示錄", "REV")
    ]

    private static let enAliases: [(String, String)] = [
        ("gen", "GEN"), ("ex", "EXO"), ("exo", "EXO"), ("lev", "LEV"), ("num", "NUM"), ("deut", "DEU"), ("deu", "DEU"),
        ("josh", "JOS"), ("judg", "JDG"), ("ruth", "RUT"), ("1sam", "1SA"), ("2sam", "2SA"),
        ("1kgs", "1KI"), ("2kgs", "2KI"), ("1chr", "1CH"), ("2chr", "2CH"), ("ezra", "EZR"),
        ("neh", "NEH"), ("esth", "EST"), ("job", "JOB"), ("ps", "PSA"), ("psa", "PSA"), ("psalm", "PSA"),
        ("prov", "PRO"), ("pro", "PRO"), ("eccl", "ECC"), ("ecc", "ECC"), ("song", "SNG"),
        ("isa", "ISA"), ("jer", "JER"), ("lam", "LAM"), ("ezek", "EZK"), ("dan", "DAN"),
        ("hos", "HOS"), ("joel", "JOL"), ("amos", "AMO"), ("obad", "OBA"), ("jonah", "JON"),
        ("mic", "MIC"), ("nah", "NAM"), ("hab", "HAB"), ("zeph", "ZEP"), ("hag", "HAG"), ("zech", "ZEC"), ("mal", "MAL"),
        ("matt", "MAT"), ("mat", "MAT"), ("mt", "MAT"), ("mk", "MRK"), ("mrk", "MRK"), ("lk", "LUK"), ("luk", "LUK"),
        ("john", "JHN"), ("jn", "JHN"), ("jhn", "JHN"), ("acts", "ACT"), ("act", "ACT"),
        ("rom", "ROM"), ("1cor", "1CO"), ("2cor", "2CO"), ("gal", "GAL"), ("eph", "EPH"),
        ("phil", "PHP"), ("php", "PHP"), ("col", "COL"), ("1thess", "1TH"), ("2thess", "2TH"),
        ("1tim", "1TI"), ("2tim", "2TI"), ("titus", "TIT"), ("phlm", "PHM"), ("heb", "HEB"),
        ("jas", "JAS"), ("1pet", "1PE"), ("2pet", "2PE"), ("1jn", "1JN"), ("2jn", "2JN"), ("3jn", "3JN"),
        ("jude", "JUD"), ("rev", "REV")
    ]

    private static let pattern = try! NSRegularExpression(
        pattern: "^\\s*([1-3]?\\s*[A-Za-z\\u4e00-\\u9fff]+?)\\s*(?:第)?\\s*([0-9]{1,3})\\s*(?:章)?(?:\\s*[:：.篇节節\\s]\\s*([0-9]{1,3}))?\\s*(?:节|節)?\\s*$"
    )

    static func parse(_ raw: String) -> ParsedScriptureRef? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        let ns = trimmed as NSString
        guard let m = pattern.firstMatch(in: trimmed, range: NSRange(location: 0, length: ns.length)) else { return nil }
        let rawBook = ns.substring(with: m.range(at: 1)).trimmingCharacters(in: .whitespaces)
        guard let ch = Int(ns.substring(with: m.range(at: 2))), ch >= 1 else { return nil }
        let vs: Int? = m.range(at: 3).location != NSNotFound ? Int(ns.substring(with: m.range(at: 3))) : nil
        if let v = vs, v < 1 { return nil }

        guard let book = matchBook(rawBook) else { return nil }
        let clampedChapter = min(ch, book.chapterCount)
        return ParsedScriptureRef(book: book, chapter: clampedChapter, verse: vs)
    }

    private static func matchBook(_ token: String) -> BookRef? {
        let clean = token.replacingOccurrences(of: " ", with: "").lowercased()
        // 1) 精确匹配全名或英文名或 ID
        if let exact = BibleCatalog.all.first(where: {
            $0.nameZh == token
            || $0.nameEn.replacingOccurrences(of: " ", with: "").lowercased() == clean
            || $0.id.lowercased() == clean
        }) {
            return exact
        }
        // 2) 中文标准简称映射（长词优先，避免「约一」被「约」吃掉）
        let sortedZh = zhShortAliases.sorted { $0.0.count > $1.0.count }
        if let hit = sortedZh.first(where: { $0.0 == token }), let b = BibleCatalog.book(id: hit.1) {
            return b
        }
        // 3) 英文常用缩写映射
        if let hit = enAliases.first(where: { $0.0 == clean }), let b = BibleCatalog.book(id: hit.1) {
            return b
        }
        // 4) 前缀匹配（如「创世」「约翰」「matth」）
        if clean.count >= 2, let pref = BibleCatalog.all.first(where: {
            $0.nameZh.hasPrefix(token) || $0.nameEn.replacingOccurrences(of: " ", with: "").lowercased().hasPrefix(clean)
        }) {
            return pref
        }
        return nil
    }
}

/// 最近搜索（RN scripture-recent-searches.ts）：去重（不分大小写）、最多 10 条、新的在前
enum RecentSearchRules {
    static let maxItems = 10

    static func normalizeTerms(_ raw: [String]) -> [String] {
        var seen = Set<String>(); var out: [String] = []
        for item in raw {
            let term = ScriptureSearchRules.normalize(item)
            if term.count < ScriptureSearchRules.minLength { continue }
            let key = term.lowercased()
            if seen.contains(key) { continue }
            seen.insert(key); out.append(term)
            if out.count >= maxItems { break }
        }
        return out
    }

    static func push(_ raw: String, into terms: [String]) -> [String] {
        let normalized = ScriptureSearchRules.normalize(raw)
        if normalized.count < ScriptureSearchRules.minLength { return terms }
        let rest = terms.filter { $0.lowercased() != normalized.lowercased() }
        return Array(([normalized] + rest).prefix(maxItems))
    }
}

extension ScriptureDatabase {
    /// `CASE book_id WHEN 'GEN' THEN 0 … END`：把创世记→启示录的卷序交给 SQLite 排
    static let bookOrderSQL: String = {
        let cases = BibleCatalog.all.enumerated().map { "WHEN '\($0.element.id)' THEN \($0.offset)" }.joined(separator: " ")
        return "CASE book_id \(cases) ELSE 999 END"
    }()

    /// 经文搜索：LIKE 全文；本章范围直接带 book/chapter 条件，旧约 / 新约在 SQL 里按卷序筛。
    /// 结果全部给出、另报总数，超过 500 条才截断（D-30，Josh 2026-10-04：原来 40 条封顶又不提示，看着像搜不到）。
    /// 排序按圣经卷序（Josh 2026-09-11「搜索结果要按圣经顺序排」）：book_id 是字符串，直接排「1CO」会在「GEN」前面，
    /// 所以把卷序做成 CASE 表达式交给 SQLite。
    func search(query raw: String, scope: ScriptureSearchScope, chapterRef: SearchChapterRef?) -> ScriptureSearchResult {
        let q = ScriptureSearchRules.normalize(raw)
        if q.isEmpty || q.count < ScriptureSearchRules.minLength { return .empty }
        if scope == .chapter, chapterRef == nil { return .empty }
        var whereSQL = "text LIKE ? ESCAPE '\\'"
        var binds: [Any] = ["%\(ScriptureSearchRules.escapeLike(q))%"]
        let ot = BibleCatalog.oldTestamentMax
        switch scope {
        case .chapter:
            guard let ref = chapterRef else { return .empty }
            whereSQL += " AND book_id = ? AND chapter = ?"; binds += [ref.bookId, ref.chapter]
        case .old: whereSQL += " AND (\(Self.bookOrderSQL)) < \(ot)"
        case .new: whereSQL += " AND (\(Self.bookOrderSQL)) BETWEEN \(ot) AND \(BibleCatalog.all.count - 1)"
        case .all: break
        }
        let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
        func prepare(_ sql: String) -> OpaquePointer? {
            var stmt: OpaquePointer?
            guard sqlite3_prepare_v2(handle, sql, -1, &stmt, nil) == SQLITE_OK else { sqlite3_finalize(stmt); return nil }
            for (i, v) in binds.enumerated() {
                if let t = v as? String { sqlite3_bind_text(stmt, Int32(i + 1), t, -1, transient) }
                else if let n = v as? Int { sqlite3_bind_int(stmt, Int32(i + 1), Int32(n)) }
            }
            return stmt
        }
        var total = 0
        if let stmt = prepare("SELECT COUNT(*) FROM verse WHERE \(whereSQL)") {
            if sqlite3_step(stmt) == SQLITE_ROW { total = Int(sqlite3_column_int(stmt, 0)) }
            sqlite3_finalize(stmt)
        }
        var hits: [ScriptureSearchHit] = []
        if total > 0, let stmt = prepare("SELECT book_id, chapter, verse, text FROM verse WHERE \(whereSQL) ORDER BY \(Self.bookOrderSQL), chapter, verse LIMIT \(ScriptureSearchRules.limit)") {
            while sqlite3_step(stmt) == SQLITE_ROW {
                guard let b = sqlite3_column_text(stmt, 0), let t = sqlite3_column_text(stmt, 3) else { continue }
                let bookId = String(cString: b)
                let text = String(cString: t).trimmingCharacters(in: .whitespacesAndNewlines)
                guard !bookId.isEmpty, !text.isEmpty else { continue }
                hits.append(ScriptureSearchHit(bookId: bookId, bookName: BibleCatalog.book(id: bookId)?.nameZh ?? bookId,
                                               chapter: Int(sqlite3_column_int(stmt, 1)), verse: Int(sqlite3_column_int(stmt, 2)), text: text))
            }
            sqlite3_finalize(stmt)
        }
        return ScriptureSearchResult(hits: hits, total: total)
    }
}
