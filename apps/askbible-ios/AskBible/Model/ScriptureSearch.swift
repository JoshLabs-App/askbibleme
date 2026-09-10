import Foundation
import SQLite3

/// 经文搜索。规则逐条搬自 RN `src/bible/scripture-search.ts` + `search-scripture-verses.ts`，由 check:scripture-search 三端对拍：
/// 关键词 trim + 折叠空白；SQLite LIKE 转义；范围 全本 / 旧约 / 新约 / 本章（旧约 = 卷号 ≤ 39）；命中 40 条封顶。
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

struct SearchTextSegment: Equatable { let text: String; let match: Bool }

enum ScriptureSearchRules {
    static let minLength = 1
    static let limit = 40
    /// 旧约 / 新约范围先多取 120 条再按卷过滤（RN SCOPED_FETCH_LIMIT）
    static let scopedFetchLimit = 120
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

/// 最近搜索（RN scripture-recent-searches.ts）：去重（不分大小写）、最多 8 条、新的在前
enum RecentSearchRules {
    static let maxItems = 8

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
    /// searchScriptureVersesMobile：LIKE 全文；本章范围直接带 book/chapter 条件；旧约 / 新约先取 120 再按卷过滤；最多 40 条。
    /// 排序照 RN：ORDER BY book_id, chapter, verse（book_id 是字符串序，RN 就是这么排的，对齐它）。
    func search(query raw: String, scope: ScriptureSearchScope, chapterRef: SearchChapterRef?) -> [ScriptureSearchHit] {
        let q = ScriptureSearchRules.normalize(raw)
        if q.isEmpty || q.count < ScriptureSearchRules.minLength { return [] }
        if scope == .chapter, chapterRef == nil { return [] }
        let like = "%\(ScriptureSearchRules.escapeLike(q))%"
        var rows: [(String, Int, Int, String)] = []
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
        if scope == .chapter, let ref = chapterRef {
            let sql = "SELECT book_id, chapter, verse, text FROM verse WHERE text LIKE ? ESCAPE '\\' AND book_id = ? AND chapter = ? ORDER BY verse LIMIT ?"
            guard sqlite3_prepare_v2(handle, sql, -1, &stmt, nil) == SQLITE_OK else { return [] }
            sqlite3_bind_text(stmt, 1, like, -1, transient)
            sqlite3_bind_text(stmt, 2, ref.bookId, -1, transient)
            sqlite3_bind_int(stmt, 3, Int32(ref.chapter))
            sqlite3_bind_int(stmt, 4, Int32(ScriptureSearchRules.limit))
        } else {
            let sql = "SELECT book_id, chapter, verse, text FROM verse WHERE text LIKE ? ESCAPE '\\' ORDER BY book_id, chapter, verse LIMIT ?"
            guard sqlite3_prepare_v2(handle, sql, -1, &stmt, nil) == SQLITE_OK else { return [] }
            sqlite3_bind_text(stmt, 1, like, -1, transient)
            sqlite3_bind_int(stmt, 2, Int32(scope == .all ? ScriptureSearchRules.limit : ScriptureSearchRules.scopedFetchLimit))
        }
        while sqlite3_step(stmt) == SQLITE_ROW {
            guard let b = sqlite3_column_text(stmt, 0), let t = sqlite3_column_text(stmt, 3) else { continue }
            rows.append((String(cString: b), Int(sqlite3_column_int(stmt, 1)), Int(sqlite3_column_int(stmt, 2)), String(cString: t)))
        }
        let filtered = scope == .chapter ? rows : rows.filter { ScriptureSearchRules.isVerseInScope($0.0, $0.1, scope, chapterRef) }
        return filtered.prefix(ScriptureSearchRules.limit).compactMap { r in
            let text = r.3.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !r.0.isEmpty, !text.isEmpty else { return nil }
            return ScriptureSearchHit(bookId: r.0, bookName: BibleCatalog.book(id: r.0)?.nameZh ?? r.0, chapter: r.1, verse: r.2, text: text)
        }
    }
}
