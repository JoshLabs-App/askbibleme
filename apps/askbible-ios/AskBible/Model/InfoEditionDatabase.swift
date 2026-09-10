import Foundation
import SQLite3

/// 「读后两版」内容库：陪你探索（guide，发现版 V2）/ 查找资料（info，讲解版 V1）。
/// 数据是 RN 同一份 assets/content/info-edition.sqlite（4761 行，按「书卷:章:角色」取一行），
/// 由 tools/gen-info-edition.mjs 复制进 bundle。查找顺序照搬 RN bundled-info-edition.ts：
/// 先「书卷:章:角色」精确取，取不到再退回旧式「书卷:章」并校验角色。
struct InfoEditionChapter {
    let bookId: String
    let chapter: Int
    let roleId: String
    let roleLabel: String
    let markdown: String
    let publishedAt: String
}

final class InfoEditionDatabase {
    static let infoRoleId = "info_edition_v1"
    static let infoEnRoleId = "info_edition_v1_en"
    static let guideRoleId = "role_356f0ffb"
    static let guideEnRoleId = "role_guide_v2_en"
    static let guideLabelAliases: Set<String> = ["发现版V2", "引导版V2", "引导版", "Study Guide V2 EN", "Guide V2 EN"]

    static let shared: InfoEditionDatabase? = {
        guard let url = Bundle.main.url(forResource: "info-edition", withExtension: "sqlite") else { return nil }
        return InfoEditionDatabase(url: url)
    }()

    private static let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
    private var handle: OpaquePointer?

    init?(url: URL) {
        var db: OpaquePointer?
        guard sqlite3_open_v2(url.path, &db, SQLITE_OPEN_READONLY, nil) == SQLITE_OK, let db else { return nil }
        handle = db
    }

    deinit { if let handle { sqlite3_close(handle) } }

    static func roleId(for variant: InfoEditionVariant) -> String { variant == .guide ? guideRoleId : infoRoleId }

    static func roleMatches(_ ch: InfoEditionChapter, target: String, variant: InfoEditionVariant) -> Bool {
        if ch.roleId == target { return true }
        let label = ch.roleLabel.trimmingCharacters(in: .whitespaces)
        if variant == .info {
            return ch.roleId == infoRoleId || ch.roleId == infoEnRoleId || label.hasPrefix("基础版") || label.hasPrefix("讲解版")
        }
        return ch.roleId == guideRoleId || ch.roleId == guideEnRoleId || guideLabelAliases.contains(label)
    }

    func chapter(bookId: String, chapter: Int, variant: InfoEditionVariant) -> InfoEditionChapter? {
        let book = bookId.trimmingCharacters(in: .whitespaces).uppercased()
        let target = Self.roleId(for: variant)
        if let hit = query(key: "\(book):\(chapter):\(target)"), !hit.markdown.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return hit
        }
        if let legacy = query(key: "\(book):\(chapter)"),
           !legacy.markdown.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
           Self.roleMatches(legacy, target: target, variant: variant) {
            return legacy
        }
        return nil
    }

    private func query(key: String) -> InfoEditionChapter? {
        guard let handle else { return nil }
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(handle, "SELECT payload FROM chapter WHERE key = ? LIMIT 1", -1, &stmt, nil) == SQLITE_OK, let stmt else { return nil }
        defer { sqlite3_finalize(stmt) }
        sqlite3_bind_text(stmt, 1, key, -1, Self.transient)
        guard sqlite3_step(stmt) == SQLITE_ROW, let c = sqlite3_column_text(stmt, 0) else { return nil }
        let payload = String(cString: c)
        guard let data = payload.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let markdown = obj["markdown"] as? String else { return nil }
        return InfoEditionChapter(
            bookId: (obj["bookId"] as? String) ?? "",
            chapter: (obj["chapter"] as? Int) ?? 0,
            roleId: (obj["roleId"] as? String) ?? "",
            roleLabel: (obj["roleLabel"] as? String) ?? "",
            markdown: markdown,
            publishedAt: (obj["publishedAt"] as? String) ?? ""
        )
    }
}
