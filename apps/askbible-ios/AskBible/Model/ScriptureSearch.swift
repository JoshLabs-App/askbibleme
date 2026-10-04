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
