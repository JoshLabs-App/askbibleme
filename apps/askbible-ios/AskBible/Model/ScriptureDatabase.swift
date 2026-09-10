import Foundation
import SQLite3

/// 内置圣经库的只读访问。对应 RN 版 `src/bible/load-chapter.ts` 的查询，
/// 但省掉了 expo-sqlite 那一路「复制到 documents + schema 版本标记 + 重建重试」——
/// 原生侧直接以 SQLITE_OPEN_READONLY 打开 bundle 内的文件，不需要落盘副本。
///
/// schema（`selah-scripture-sqlite-v3`）：
///   verse(book_id, chapter, verse, text, speech_spans, flags, theme_repeat_count)
///   meta(key, value)
final class ScriptureDatabase {
    enum DatabaseError: LocalizedError {
        case missingFile(String)
        case openFailed(String)
        case queryFailed(String)

        var errorDescription: String? {
            switch self {
            case .missingFile(let name): return "内置圣经库缺失：\(name)"
            case .openFailed(let msg): return "打开圣经库失败：\(msg)"
            case .queryFailed(let msg): return "查询失败：\(msg)"
            }
        }
    }

    /// SQLite 要求文本绑定的生命周期覆盖整次 step，用 TRANSIENT 让它自己拷贝
    private static let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

    let handle: OpaquePointer
    let translationId: String

    /// 按需下载的译本（KJV）落在 Application Support/scripture/<id>.sqlite；
    /// 路径规则放在这里而不是下载器里，数据层自检 harness 才能单独编译本文件。
    static var installedDirectory: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("scripture", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    static func installedFile(_ translationId: String) -> URL {
        installedDirectory.appendingPathComponent("\(translationId).sqlite")
    }

    static func isInstalled(_ translationId: String) -> Bool {
        FileManager.default.fileExists(atPath: installedFile(translationId).path)
    }

    /// `directory` 留空走 App bundle；命令行 harness 传入 Resources 目录来做数据层自检。
    init(translationId: String, directory: URL? = nil) throws {
        self.translationId = translationId
        let resolved: URL?
        if let directory {
            let candidate = directory.appendingPathComponent("\(translationId).sqlite")
            resolved = FileManager.default.fileExists(atPath: candidate.path) ? candidate : nil
        } else if Self.isInstalled(translationId) {
            resolved = Self.installedFile(translationId)
        } else {
            resolved = Bundle.main.url(forResource: translationId, withExtension: "sqlite")
        }
        guard let url = resolved else {
            throw DatabaseError.missingFile("\(translationId).sqlite")
        }
        var db: OpaquePointer?
        let rc = sqlite3_open_v2(url.path, &db, SQLITE_OPEN_READONLY, nil)
        guard rc == SQLITE_OK, let db else {
            let msg = db.map { String(cString: sqlite3_errmsg($0)) } ?? "rc=\(rc)"
            if let db { sqlite3_close(db) }
            throw DatabaseError.openFailed(msg)
        }
        self.handle = db
    }

    deinit { sqlite3_close(handle) }

    /// meta 表，用于校验 schema 版本
    func meta(_ key: String) -> String? {
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(handle, "SELECT value FROM meta WHERE key = ?", -1, &stmt, nil) == SQLITE_OK else { return nil }
        sqlite3_bind_text(stmt, 1, key, -1, Self.transient)
        guard sqlite3_step(stmt) == SQLITE_ROW, let c = sqlite3_column_text(stmt, 0) else { return nil }
        return String(cString: c)
    }

    /// 书卷的章数，用于目录页
    func chapterCount(bookId: String) -> Int {
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(handle, "SELECT MAX(chapter) FROM verse WHERE book_id = ?", -1, &stmt, nil) == SQLITE_OK else { return 0 }
        sqlite3_bind_text(stmt, 1, bookId, -1, Self.transient)
        guard sqlite3_step(stmt) == SQLITE_ROW else { return 0 }
        return Int(sqlite3_column_int(stmt, 0))
    }

    /// 读一章。与 TS 侧同样按 verse 升序，逐行走标注解码。
    func loadChapter(bookId: String, chapter: Int) throws -> [LoadedVerse] {
        guard isValidBookId(bookId), chapter >= 1 else { return [] }

        let sql = """
            SELECT verse, text, speech_spans, flags, theme_repeat_count
            FROM verse WHERE book_id = ? AND chapter = ? ORDER BY verse ASC
            """
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(handle, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw DatabaseError.queryFailed(String(cString: sqlite3_errmsg(handle)))
        }
        sqlite3_bind_text(stmt, 1, bookId, -1, Self.transient)
        sqlite3_bind_int(stmt, 2, Int32(chapter))

        var out: [LoadedVerse] = []
        while sqlite3_step(stmt) == SQLITE_ROW {
            let number = Int(sqlite3_column_int(stmt, 0))
            let text = columnText(stmt, 1) ?? ""
            let rawSpans = columnText(stmt, 2)
            let themeRepeat = Int(sqlite3_column_int(stmt, 4))
            guard number >= 1, !text.isEmpty else { continue }

            out.append(LoadedVerse(
                number: number,
                text: text,
                speechParts: VerseAnnotations.speechParts(text: text, rawSpans: rawSpans),
                themeRepeatCount: themeRepeat,
                isGolden: VerseAnnotations.showsGoldenThemeMarker(themeRepeatCount: themeRepeat)
            ))
        }
        return out
    }

    private func columnText(_ stmt: OpaquePointer?, _ idx: Int32) -> String? {
        guard let c = sqlite3_column_text(stmt, idx) else { return nil }
        return String(cString: c)
    }

    /// 与 TS 侧 BOOK_RE 一致：导航尚未落定时可能传进空/脏值，别绑进 SQLite
    private func isValidBookId(_ id: String) -> Bool {
        !id.isEmpty && id.count <= 8 && id.allSatisfy { $0.isUppercase && $0.isASCII || $0.isNumber }
    }
}

/// 交叉引用库（scripture-xrefs.sqlite）。目前只用到「本章哪些节带 xref」——
/// 节号有 xref 走 verseNum(#C98300)，没有走 verseNumMuted。
/// 查询与 RN 版 `load-chapter-xrefs.ts` 的 UNION 一致。
final class XrefDatabase {
    private static let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
    private let handle: OpaquePointer

    init?(directory: URL? = nil) {
        let resolved: URL?
        if let directory {
            let candidate = directory.appendingPathComponent("scripture-xrefs.sqlite")
            resolved = FileManager.default.fileExists(atPath: candidate.path) ? candidate : nil
        } else {
            resolved = Bundle.main.url(forResource: "scripture-xrefs", withExtension: "sqlite")
        }
        guard let url = resolved else { return nil }
        var db: OpaquePointer?
        guard sqlite3_open_v2(url.path, &db, SQLITE_OPEN_READONLY, nil) == SQLITE_OK, let db else {
            if let db { sqlite3_close(db) }
            return nil
        }
        self.handle = db
    }

    deinit { sqlite3_close(handle) }

    /// 一节的交叉引用：被引用于（incoming）与相关经文（outgoing），各按 priority 降序。
    /// 查询与 RN 版 `load-chapter-xrefs.ts` 的 loadChapterVerseXrefs 一致。
    func verseXrefs(bookId: String, chapter: Int, verse: Int) -> VerseXrefs {
        var outgoing: [XrefTarget] = []
        var incoming: [XrefTarget] = []

        var stmt: OpaquePointer?
        let outSql = """
            SELECT to_book_id, to_chapter, to_verse_start, to_verse_end, priority
            FROM xref_out WHERE from_book_id = ? AND from_chapter = ? AND from_verse = ?
            ORDER BY priority DESC
            """
        if sqlite3_prepare_v2(handle, outSql, -1, &stmt, nil) == SQLITE_OK {
            sqlite3_bind_text(stmt, 1, bookId, -1, Self.transient)
            sqlite3_bind_int(stmt, 2, Int32(chapter))
            sqlite3_bind_int(stmt, 3, Int32(verse))
            while sqlite3_step(stmt) == SQLITE_ROW {
                guard let c = sqlite3_column_text(stmt, 0) else { continue }
                let start = Int(sqlite3_column_int(stmt, 2))
                let end = Int(sqlite3_column_int(stmt, 3))
                outgoing.append(XrefTarget(
                    bookId: String(cString: c), chapter: Int(sqlite3_column_int(stmt, 1)),
                    verseStart: start, verseEnd: end >= start ? end : start,
                    priority: Int(sqlite3_column_int(stmt, 4))))
            }
        }
        sqlite3_finalize(stmt); stmt = nil

        let inSql = """
            SELECT from_book_id, from_chapter, from_verse, priority
            FROM xref_in WHERE to_book_id = ? AND to_chapter = ? AND to_verse = ?
            ORDER BY priority DESC
            """
        if sqlite3_prepare_v2(handle, inSql, -1, &stmt, nil) == SQLITE_OK {
            sqlite3_bind_text(stmt, 1, bookId, -1, Self.transient)
            sqlite3_bind_int(stmt, 2, Int32(chapter))
            sqlite3_bind_int(stmt, 3, Int32(verse))
            while sqlite3_step(stmt) == SQLITE_ROW {
                guard let c = sqlite3_column_text(stmt, 0) else { continue }
                let v = Int(sqlite3_column_int(stmt, 2))
                incoming.append(XrefTarget(
                    bookId: String(cString: c), chapter: Int(sqlite3_column_int(stmt, 1)),
                    verseStart: v, verseEnd: v, priority: Int(sqlite3_column_int(stmt, 3))))
            }
        }
        sqlite3_finalize(stmt)
        return VerseXrefs(verse: verse, incoming: incoming, outgoing: outgoing)
    }

    func versesWithXrefs(bookId: String, chapter: Int) -> Set<Int> {
        let sql = """
            SELECT DISTINCT from_verse AS verse FROM xref_out
            WHERE from_book_id = ? AND from_chapter = ?
            UNION
            SELECT DISTINCT to_verse AS verse FROM xref_in
            WHERE to_book_id = ? AND to_chapter = ?
            ORDER BY verse
            """
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(handle, sql, -1, &stmt, nil) == SQLITE_OK else { return [] }
        sqlite3_bind_text(stmt, 1, bookId, -1, Self.transient)
        sqlite3_bind_int(stmt, 2, Int32(chapter))
        sqlite3_bind_text(stmt, 3, bookId, -1, Self.transient)
        sqlite3_bind_int(stmt, 4, Int32(chapter))

        var out: Set<Int> = []
        while sqlite3_step(stmt) == SQLITE_ROW {
            let v = Int(sqlite3_column_int(stmt, 0))
            if v >= 1 { out.insert(v) }
        }
        return out
    }
}

/// 交叉引用目标（ScriptureXrefTarget）。verseEnd 已保证 >= verseStart。
struct XrefTarget: Hashable, Identifiable {
    let bookId: String
    let chapter: Int
    let verseStart: Int
    let verseEnd: Int
    let priority: Int
    var id: String { "\(bookId).\(chapter).\(verseStart)-\(verseEnd)" }

    /// formatScriptureXrefLabel：`{书名} {章}:{起}` 或 `{起}–{止}`（en dash）
    func label(bookName: String) -> String {
        let range = verseStart == verseEnd ? "\(verseStart)" : "\(verseStart)\u{2013}\(verseEnd)"
        return "\(bookName) \(chapter):\(range)"
    }
}

struct VerseXrefs {
    let verse: Int
    let incoming: [XrefTarget]
    let outgoing: [XrefTarget]
    var isEmpty: Bool { incoming.isEmpty && outgoing.isEmpty }
}

struct LoadedVerse: Identifiable, Equatable {
    let number: Int
    let text: String
    let speechParts: [SpeechPart]?
    let themeRepeatCount: Int
    let isGolden: Bool

    var id: Int { number }
}
