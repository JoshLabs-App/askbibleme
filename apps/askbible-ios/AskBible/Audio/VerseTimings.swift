import Foundation
import SQLite3

/// 一节在整章音频里的时间区间
struct VerseTiming: Equatable {
    let verse: Int
    let start: Double
    let end: Double
}

/// 跟读高亮的时间轴。
///
/// 数据由 `tools/build-verse-timings-db.mjs` 从 RN 的 verse-timings-bundle.json 转出 ——
/// 那份 JSON 4.5 MB，全量解析进内存不划算，而跟读只需要当前这一章。
///
/// scope 映射与 `bundled-verse-timings.ts` 一致：
///   web-en → "web-en"；其余 cuv 系 → "cuv-v20"，该 scope 缺这一章时回退 "cuv-simp"。
final class VerseTimingDatabase {
    private static let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
    private let handle: OpaquePointer

    init?(directory: URL? = nil) {
        let resolved: URL?
        if let directory {
            let candidate = directory.appendingPathComponent("verse-timings.sqlite")
            resolved = FileManager.default.fileExists(atPath: candidate.path) ? candidate : nil
        } else {
            resolved = Bundle.main.url(forResource: "verse-timings", withExtension: "sqlite")
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

    /// scopeForTranslation。RN 里是「不是 web 就当和合本」，只有内置那几个译本时没问题；
    /// 放开 YouVersion 全量译本后，法语版会去套和合本的时间轴、高亮全错位，
    /// 所以认不出的译本一律返回 nil ——「没有时间点就不高亮」（Josh 2026-09-11）。
    static func scope(for translationId: String) -> String? {
        let id = translationId.trimmingCharacters(in: .whitespaces).lowercased()
        if id.hasPrefix("web") { return "web-en" }
        if id.hasPrefix("cuv") { return "cuv-v20" }
        return nil
    }

    /// 取一章的时间轴，按 verse 升序。cuv-v20 缺章时回退 cuv-simp（与 TS 侧同）。
    func timings(translationId: String, bookId: String, chapter: Int) -> [VerseTiming] {
        guard let primary = Self.scope(for: translationId) else { return [] }
        let rows = query(scope: primary, bookId: bookId, chapter: chapter)
        if !rows.isEmpty { return rows }
        if primary == "cuv-v20" {
            return query(scope: "cuv-simp", bookId: bookId, chapter: chapter)
        }
        return []
    }

    private func query(scope: String, bookId: String, chapter: Int) -> [VerseTiming] {
        let sql = """
            SELECT verse, start_sec, end_sec FROM timing
            WHERE scope = ? AND book_id = ? AND chapter = ? ORDER BY verse ASC
            """
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(handle, sql, -1, &stmt, nil) == SQLITE_OK else { return [] }
        sqlite3_bind_text(stmt, 1, scope, -1, Self.transient)
        sqlite3_bind_text(stmt, 2, bookId.uppercased(), -1, Self.transient)
        sqlite3_bind_int(stmt, 3, Int32(chapter))

        var out: [VerseTiming] = []
        while sqlite3_step(stmt) == SQLITE_ROW {
            out.append(VerseTiming(
                verse: Int(sqlite3_column_int(stmt, 0)),
                start: sqlite3_column_double(stmt, 1),
                end: sqlite3_column_double(stmt, 2)
            ))
        }
        return out
    }
}

/// 由播放位置定位当前节。
///
/// 这一步在 RN 版里要跨语言走一圈：原生播放器报位置 → 桥到 JS → JS 比对时间轴 →
/// 再驱动 UI 高亮。这里播放位置和高亮在同一份状态里，直接算。
enum VerseTimingLookup {
    /// 时间轴按 start 升序，用二分找最后一个 start <= time 的节；
    /// 落在两节之间的空隙（朗读停顿）算作前一节仍在朗读。
    static func activeVerse(at time: Double, in timings: [VerseTiming]) -> Int? {
        guard !timings.isEmpty, time >= 0 else { return nil }
        guard let first = timings.first, time >= first.start else { return nil }

        var lo = 0
        var hi = timings.count - 1
        var found = -1
        while lo <= hi {
            let mid = (lo + hi) / 2
            if timings[mid].start <= time {
                found = mid
                lo = mid + 1
            } else {
                hi = mid - 1
            }
        }
        guard found >= 0 else { return nil }
        // 超出整章最后一节的 end 之后不再高亮
        if found == timings.count - 1, time > timings[found].end { return nil }
        return timings[found].verse
    }
}
