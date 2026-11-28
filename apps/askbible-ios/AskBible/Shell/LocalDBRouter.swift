import Foundation

/// D-47 本地 SQLite 直查路由（`/local-db/chapter`、`/local-db/search`、`/local-db/translations`）。
///
/// 直接复用 `ScriptureDatabase`、`XrefDatabase`、`ScriptureTranslation` 与 `ScriptureSearchRules`，
/// 在 `LocalPackURLSchemeHandler` 内 0ms 返回 JSON（零 WASM、零复制库到内存）。
final class LocalDBRouter: @unchecked Sendable {
    static let shared = LocalDBRouter()

    struct Response {
        let statusCode: Int
        let body: Data
    }

    private let customDirectory: URL?
    private let lock = NSLock()
    private var databases: [String: ScriptureDatabase] = [:]
    private var xrefDatabase: XrefDatabase?
    private var xrefLoaded = false

    init(directory: URL? = nil) {
        self.customDirectory = directory
    }

    func invalidate(translationId: String? = nil) {
        lock.lock()
        defer { lock.unlock() }
        if let translationId {
            databases.removeValue(forKey: translationId)
        } else {
            databases.removeAll()
            xrefDatabase = nil
            xrefLoaded = false
        }
    }

    func canHandle(path: String) -> Bool {
        let norm = Self.normalizePath(path)
        return norm == "/local-db/chapter"
            || norm == "/local-db/search"
            || norm == "/local-db/translations"
            || norm.hasPrefix("/local-db/")
    }

    func handle(url: URL) -> Response {
        let norm = Self.normalizePath(url.path)
        let query = Self.queryItems(from: url)

        switch norm {
        case "/local-db/chapter":
            return handleChapter(query: query)
        case "/local-db/search":
            return handleSearch(query: query)
        case "/local-db/translations":
            return handleTranslations()
        default:
            return jsonResponse(statusCode: 404, payload: [
                "ok": false,
                "error": "unknown_local_db_route",
                "path": norm,
            ])
        }
    }

    // MARK: - /local-db/chapter?t={id}&b={osis}&c={num}

    private func handleChapter(query: [String: String]) -> Response {
        let requestedId = Self.nonEmpty(query["t"]) ?? "cuv-simp"
        let bookId = (Self.nonEmpty(query["b"]) ?? "").uppercased()
        let chapter = Int(query["c"] ?? "") ?? 0

        guard !bookId.isEmpty, chapter >= 1 else {
            return jsonResponse(statusCode: 400, payload: [
                "ok": false,
                "error": "invalid_params",
                "message": "Expected b (OSIS book id) and c (chapter >= 1)",
            ])
        }

        guard let db = openDatabase(translationId: requestedId) else {
            return jsonResponse(statusCode: 404, payload: [
                "ok": false,
                "error": "translation_not_local",
                "translationId": requestedId,
            ])
        }

        do {
            let rows = try db.loadChapter(bookId: bookId, chapter: chapter)
            let chapterCount = db.chapterCount(bookId: bookId)
            let xrefSet = openXrefDatabase()?.versesWithXrefs(bookId: bookId, chapter: chapter) ?? []

            let verses: [[String: Any]] = rows.map { row in
                var item: [String: Any] = [
                    "verse": row.number,
                    "number": row.number,
                    "text": row.text,
                    "themeRepeatCount": row.themeRepeatCount,
                    "isGolden": row.isGolden,
                    "hasXref": xrefSet.contains(row.number),
                ]
                if let parts = row.speechParts {
                    item["speechParts"] = parts.map { ["kind": $0.kind.rawValue, "text": $0.text] }
                }
                return item
            }

            return jsonResponse(statusCode: 200, payload: [
                "ok": true,
                "translationId": requestedId,
                "bookId": bookId,
                "chapter": chapter,
                "chapterCount": chapterCount,
                "verses": verses,
            ])
        } catch {
            return jsonResponse(statusCode: 500, payload: [
                "ok": false,
                "error": "query_failed",
                "message": error.localizedDescription,
            ])
        }
    }

    // MARK: - /local-db/search?t={id}&q={kw}&limit=50

    private func handleSearch(query: [String: String]) -> Response {
        let requestedId = Self.nonEmpty(query["t"]) ?? "cuv-simp"
        let rawQ = query["q"] ?? ""
        let normalizedQ = ScriptureSearchRules.normalize(rawQ)
        let rawLimit = Int(query["limit"] ?? "") ?? 50
        let limit = min(ScriptureSearchRules.limit, max(1, rawLimit))
        let scope = ScriptureSearchScope(rawValue: query["scope"] ?? "all") ?? .all
        let chapterRef: SearchChapterRef? = {
            guard scope == .chapter,
                  let b = Self.nonEmpty(query["b"])?.uppercased(),
                  let c = Int(query["c"] ?? ""), c >= 1 else { return nil }
            return SearchChapterRef(bookId: b, chapter: c)
        }()

        let effectiveId: String
        if openDatabase(translationId: requestedId) != nil {
            effectiveId = requestedId
        } else {
            let zh = ScriptureTranslation.find(requestedId)?.isZh ?? true
            effectiveId = zh ? "cuv-simp" : "web-en"
        }

        if normalizedQ.count < ScriptureSearchRules.minLength {
            return jsonResponse(statusCode: 200, payload: [
                "ok": true,
                "translationId": effectiveId,
                "query": normalizedQ,
                "total": 0,
                "truncated": false,
                "hits": [],
            ])
        }

        guard let db = openDatabase(translationId: effectiveId) else {
            return jsonResponse(statusCode: 404, payload: [
                "ok": false,
                "error": "translation_not_local",
                "translationId": effectiveId,
            ])
        }

        let result = db.search(query: normalizedQ, scope: scope, chapterRef: chapterRef)
        let limitedHits = Array(result.hits.prefix(limit))
        let isZh = ScriptureTranslation.find(effectiveId)?.isZh ?? true

        let hitsPayload: [[String: Any]] = limitedHits.map { hit in
            let book = BibleCatalog.book(id: hit.bookId)
            let bookName = isZh ? (book?.nameZh ?? hit.bookName) : (book?.nameEn ?? hit.bookName)
            return [
                "bookId": hit.bookId,
                "bookName": bookName,
                "chapter": hit.chapter,
                "verse": hit.verse,
                "text": hit.text,
            ]
        }

        return jsonResponse(statusCode: 200, payload: [
            "ok": true,
            "translationId": effectiveId,
            "query": normalizedQ,
            "total": result.total,
            "truncated": result.total > limitedHits.count,
            "hits": hitsPayload,
        ])
    }

    // MARK: - /local-db/translations

    private func handleTranslations() -> Response {
        let items: [[String: Any]] = ScriptureTranslation.all.map { t in
            let installed: Bool
            if let customDirectory {
                let candidate = customDirectory.appendingPathComponent("\(t.id).sqlite")
                installed = FileManager.default.fileExists(atPath: candidate.path)
            } else {
                installed = t.delivery == .bundled
                    || ScriptureDatabase.isInstalled(t.id)
                    || Bundle.main.url(forResource: t.id, withExtension: "sqlite") != nil
            }
            return [
                "id": t.id,
                "labelZh": t.labelZh,
                "labelEn": t.labelEn,
                "shortZh": t.shortZh,
                "shortZhTw": t.shortZhTw,
                "shortEn": t.shortEn,
                "language": t.language,
                "delivery": t.delivery.rawValue,
                "installed": installed,
                "hasChapterAudio": t.hasChapterAudio,
                "downloadUrl": t.downloadUrl,
            ]
        }
        return jsonResponse(statusCode: 200, payload: [
            "ok": true,
            "translations": items,
        ])
    }

    // MARK: - Helpers

    private func openDatabase(translationId: String) -> ScriptureDatabase? {
        lock.lock()
        defer { lock.unlock() }
        if let cached = databases[translationId] { return cached }
        if customDirectory == nil, let t = ScriptureTranslation.find(translationId) {
            if t.delivery == .online { return nil }
            if t.delivery == .download, !ScriptureDatabase.isInstalled(translationId) { return nil }
        }
        guard let db = try? ScriptureDatabase(translationId: translationId, directory: customDirectory) else {
            return nil
        }
        databases[translationId] = db
        return db
    }

    private func openXrefDatabase() -> XrefDatabase? {
        lock.lock()
        defer { lock.unlock() }
        if !xrefLoaded {
            xrefLoaded = true
            xrefDatabase = XrefDatabase(directory: customDirectory)
        }
        return xrefDatabase
    }

    private func jsonResponse(statusCode: Int, payload: [String: Any]) -> Response {
        let data = (try? JSONSerialization.data(withJSONObject: payload)) ?? Data("{\"ok\":false}".utf8)
        return Response(statusCode: statusCode, body: data)
    }

    private static func normalizePath(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        return "/" + trimmed
    }

    private static func queryItems(from url: URL) -> [String: String] {
        guard let comps = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let items = comps.queryItems else { return [:] }
        var map: [String: String] = [:]
        for item in items {
            if let value = item.value { map[item.name] = value }
        }
        return map
    }

    private static func nonEmpty(_ raw: String?) -> String? {
        let s = raw?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return s.isEmpty ? nil : s
    }
}
