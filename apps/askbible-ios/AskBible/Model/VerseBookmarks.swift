import Foundation
import Combine

/// 收藏的经文。与 RN `scripture-verse-bookmark-store.ts` 同构：键「译本:书卷:章:节」，
/// 存 JSON（UserDefaults，键与 RN AsyncStorage 同名），按收藏时间倒序列出。
struct VerseBookmark: Identifiable, Equatable {
    let bookId: String
    let bookName: String
    let chapter: Int
    let verse: Int
    let translationId: String
    let text: String
    let savedAt: Double
    var id: String { VerseBookmarkRules.key(translationId: translationId, bookId: bookId, chapter: chapter, verse: verse) }
}

enum VerseBookmarkRules {
    static let storageKey = "askbible-scripture-verse-bookmarks-v1"
    static let tombstonesStorageKey = "askbible-scripture-verse-bookmark-tombstones-v1"
    static let tombstoneTtlMs: Double = 60 * 24 * 60 * 60 * 1000

    static func key(translationId: String, bookId: String, chapter: Int, verse: Int) -> String {
        "\(translationId):\(bookId):\(chapter):\(verse)"
    }

    /// parseScriptureVerseBookmarkStore：坏条目/墓碑跳过；bookId 大写；bookName 缺省用 bookId；savedAt 缺省用现在
    static func parse(_ raw: String?, now: Double = Date().timeIntervalSince1970 * 1000) -> [String: VerseBookmark] {
        guard let raw, let data = raw.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [:] }
        var out: [String: VerseBookmark] = [:]
        for (key, value) in obj {
            guard let item = value as? [String: Any] else { continue }
            if (item["deleted"] as? Bool) == true { continue }
            guard let bookIdRaw = item["bookId"], let tidRaw = item["translationId"] else { continue }
            let bookId0 = "\(bookIdRaw)", tid = "\(tidRaw)"
            if bookId0.isEmpty || tid.isEmpty || bookId0 == "<null>" || tid == "<null>" { continue }
            guard let chapter = item["chapter"] as? Int, chapter >= 1, let verse = item["verse"] as? Int, verse >= 1 else { continue }
            let bookName = (item["bookName"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? bookId0
            let savedAt = (item["savedAt"] as? Double) ?? now
            out[key] = VerseBookmark(
                bookId: bookId0.trimmingCharacters(in: .whitespaces).uppercased(), bookName: bookName,
                chapter: chapter, verse: verse, translationId: tid,
                text: (item["text"] as? String) ?? "", savedAt: savedAt)
        }
        return out
    }

    static func pruneTombstones(_ tombstones: [String: Double], now: Double = Date().timeIntervalSince1970 * 1000) -> [String: Double] {
        var out: [String: Double] = [:]
        for (k, ts) in tombstones where ts.isFinite && ts > 0 && now - ts <= tombstoneTtlMs {
            out[k] = ts
        }
        return out
    }

    static func parseTombstones(_ raw: String?, now: Double = Date().timeIntervalSince1970 * 1000) -> [String: Double] {
        guard let raw, let data = raw.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [:] }
        var out: [String: Double] = [:]
        for (k, v) in obj {
            if let ts = MemberReadingSyncRules.num(v), ts.isFinite, ts > 0, now - ts <= tombstoneTtlMs {
                out[k] = ts
            }
        }
        return out
    }

    static func extractTombstones(json obj: [String: Any], now: Double = Date().timeIntervalSince1970 * 1000) -> [String: Double] {
        var out: [String: Double] = [:]
        for (k, v) in obj {
            guard let item = v as? [String: Any], (item["deleted"] as? Bool) == true,
                  let ts = MemberReadingSyncRules.num(item["deletedAt"]),
                  ts.isFinite, ts > 0, now - ts <= tombstoneTtlMs else { continue }
            out[k] = ts
        }
        return out
    }

    static func serializeTombstones(_ tombstones: [String: Double]) -> String {
        let data = (try? JSONSerialization.data(withJSONObject: tombstones, options: [.sortedKeys])) ?? Data("{}".utf8)
        return String(decoding: data, as: UTF8.self)
    }

    static func serialize(_ store: [String: VerseBookmark]) -> String {
        var obj: [String: Any] = [:]
        for (k, b) in store {
            obj[k] = ["bookId": b.bookId, "bookName": b.bookName, "chapter": b.chapter, "verse": b.verse,
                      "translationId": b.translationId, "text": b.text, "savedAt": b.savedAt]
        }
        let data = (try? JSONSerialization.data(withJSONObject: obj, options: [.sortedKeys])) ?? Data("{}".utf8)
        return String(decoding: data, as: UTF8.self)
    }

    /// listScriptureVerseBookmarks：新的在前
    static func list(_ store: [String: VerseBookmark]) -> [VerseBookmark] {
        store.values.sorted { $0.savedAt > $1.savedAt }
    }
}

final class VerseBookmarkStore: ObservableObject {
    @Published private(set) var store: [String: VerseBookmark]
    private(set) var tombstones: [String: Double]
    private let defaults = UserDefaults.standard

    init() {
        store = VerseBookmarkRules.parse(defaults.string(forKey: VerseBookmarkRules.storageKey))
        tombstones = VerseBookmarkRules.parseTombstones(defaults.string(forKey: VerseBookmarkRules.tombstonesStorageKey))
    }

    var list: [VerseBookmark] { VerseBookmarkRules.list(store) }
    /// 本机改动通知（会员同步）
    var onLocalChange: (() -> Void)?

    /// 序列化成 RN 同形的 JSON 对象（同步 blob，含 60 天墓碑）
    var json: [String: Any] {
        var obj = (try? JSONSerialization.jsonObject(with: Data(VerseBookmarkRules.serialize(store).utf8))) as? [String: Any] ?? [:]
        let nowMs = Date().timeIntervalSince1970 * 1000
        for (k, ts) in VerseBookmarkRules.pruneTombstones(tombstones, now: nowMs) where store[k] == nil {
            obj[k] = ["deleted": true, "deletedAt": ts]
        }
        return obj
    }
    /// 云端书签落本机（RN replaceScriptureVerseBookmarkStore）
    func replace(json: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: json) else { return }
        let raw = String(decoding: data, as: UTF8.self)
        let nowMs = Date().timeIntervalSince1970 * 1000
        let nextStore = VerseBookmarkRules.parse(raw, now: nowMs)
        let remoteTombstones = VerseBookmarkRules.extractTombstones(json: json, now: nowMs)
        var nextTombstones = VerseBookmarkRules.pruneTombstones(tombstones, now: nowMs)
        for (k, ts) in remoteTombstones {
            nextTombstones[k] = max(nextTombstones[k] ?? 0, ts)
        }
        for k in nextStore.keys {
            nextTombstones.removeValue(forKey: k)
        }
        store = nextStore
        tombstones = nextTombstones
        defaults.set(VerseBookmarkRules.serialize(nextStore), forKey: VerseBookmarkRules.storageKey)
        defaults.set(VerseBookmarkRules.serializeTombstones(nextTombstones), forKey: VerseBookmarkRules.tombstonesStorageKey)
    }
    func clearForAccountSwitch() {
        store = [:]
        tombstones = [:]
        defaults.removeObject(forKey: VerseBookmarkRules.storageKey)
        defaults.removeObject(forKey: VerseBookmarkRules.tombstonesStorageKey)
    }

    func isBookmarked(translationId: String, bookId: String, chapter: Int, verse: Int) -> Bool {
        store[VerseBookmarkRules.key(translationId: translationId, bookId: bookId, chapter: chapter, verse: verse)] != nil
    }

    func bookmarkedVerses(translationId: String, bookId: String, chapter: Int) -> Set<Int> {
        Set(store.values.filter { $0.translationId == translationId && $0.bookId == bookId && $0.chapter == chapter }.map(\.verse))
    }

    /// toggleScriptureVerseBookmark：有则删并记墓碑，无则加并清墓碑；返回是否为新加
    @discardableResult
    func toggle(bookId: String, bookName: String, chapter: Int, verse: Int, translationId: String, text: String) -> Bool {
        let key = VerseBookmarkRules.key(translationId: translationId, bookId: bookId, chapter: chapter, verse: verse)
        let nowMs = Date().timeIntervalSince1970 * 1000
        var next = store
        var nextTombstones = VerseBookmarkRules.pruneTombstones(tombstones, now: nowMs)
        let added: Bool
        if next[key] != nil {
            next.removeValue(forKey: key)
            nextTombstones[key] = nowMs
            added = false
        } else {
            next[key] = VerseBookmark(bookId: bookId, bookName: bookName, chapter: chapter, verse: verse, translationId: translationId,
                                      text: text, savedAt: nowMs)
            nextTombstones.removeValue(forKey: key)
            added = true
        }
        store = next
        tombstones = nextTombstones
        defaults.set(VerseBookmarkRules.serialize(next), forKey: VerseBookmarkRules.storageKey)
        defaults.set(VerseBookmarkRules.serializeTombstones(nextTombstones), forKey: VerseBookmarkRules.tombstonesStorageKey)
        onLocalChange?()
        return added
    }
}

/// 最近搜索 + 搜索范围偏好（键与 RN AsyncStorage 同名）
final class SearchPrefs: ObservableObject {
    static let recentKey = "askbible-mobile-scripture-recent-searches-v1"
    static let scopeKey = "askbible-mobile-scripture-search-scope-v1"
    @Published private(set) var recent: [String]
    @Published var scope: ScriptureSearchScope { didSet { UserDefaults.standard.set(scope.rawValue, forKey: Self.scopeKey) } }
    /// 从章页返回搜索页时要恢复的关键词（只在内存里，用一次就清）
    var resumeQuery: String?

    init() {
        let d = UserDefaults.standard
        var terms: [String] = []
        if let raw = d.string(forKey: Self.recentKey), let data = raw.data(using: .utf8),
           let obj = try? JSONSerialization.jsonObject(with: data) {
            if let arr = obj as? [String] { terms = arr }
            else if let rec = obj as? [String: Any], (rec["version"] as? Int) == 1, let arr = rec["terms"] as? [String] { terms = arr }
        }
        recent = RecentSearchRules.normalizeTerms(terms)
        scope = ScriptureSearchScope(rawValue: d.string(forKey: Self.scopeKey) ?? "") ?? ScriptureSearchRules.defaultScope
    }

    var onLocalChange: (() -> Void)?

    func push(_ raw: String) {
        let next = RecentSearchRules.push(raw, into: recent)
        if next == recent { return }
        recent = next
        persistRecent()
        onLocalChange?()
    }

    private func persistRecent() {
        if let data = try? JSONSerialization.data(withJSONObject: ["version": 1, "terms": recent]) {
            UserDefaults.standard.set(String(decoding: data, as: UTF8.self), forKey: Self.recentKey)
        }
    }

    /// 云端最近搜索落本机（RN replaceScriptureRecentSearches）
    func replaceRecent(_ terms: [String]) {
        recent = RecentSearchRules.normalizeTerms(terms)
        persistRecent()
    }
    func clearRecentForAccountSwitch() { recent = []; UserDefaults.standard.removeObject(forKey: Self.recentKey) }
}
