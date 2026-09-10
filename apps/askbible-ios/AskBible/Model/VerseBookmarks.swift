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

    static func key(translationId: String, bookId: String, chapter: Int, verse: Int) -> String {
        "\(translationId):\(bookId):\(chapter):\(verse)"
    }

    /// parseScriptureVerseBookmarkStore：坏条目跳过；bookId 大写；bookName 缺省用 bookId；savedAt 缺省用现在
    static func parse(_ raw: String?, now: Double = Date().timeIntervalSince1970 * 1000) -> [String: VerseBookmark] {
        guard let raw, let data = raw.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [:] }
        var out: [String: VerseBookmark] = [:]
        for (key, value) in obj {
            guard let item = value as? [String: Any],
                  let bookIdRaw = item["bookId"], let tidRaw = item["translationId"] else { continue }
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
    private let defaults = UserDefaults.standard

    init() {
        store = VerseBookmarkRules.parse(defaults.string(forKey: VerseBookmarkRules.storageKey))
    }

    var list: [VerseBookmark] { VerseBookmarkRules.list(store) }
    /// 本机改动通知（会员同步）
    var onLocalChange: (() -> Void)?

    /// 序列化成 RN 同形的 JSON 对象（同步 blob）
    var json: [String: Any] {
        (try? JSONSerialization.jsonObject(with: Data(VerseBookmarkRules.serialize(store).utf8))) as? [String: Any] ?? [:]
    }
    /// 云端书签落本机（RN replaceScriptureVerseBookmarkStore）
    func replace(json: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: json) else { return }
        let raw = String(decoding: data, as: UTF8.self)
        store = VerseBookmarkRules.parse(raw)
        defaults.set(VerseBookmarkRules.serialize(store), forKey: VerseBookmarkRules.storageKey)
    }
    func clearForAccountSwitch() { store = [:]; defaults.removeObject(forKey: VerseBookmarkRules.storageKey) }

    func isBookmarked(translationId: String, bookId: String, chapter: Int, verse: Int) -> Bool {
        store[VerseBookmarkRules.key(translationId: translationId, bookId: bookId, chapter: chapter, verse: verse)] != nil
    }

    func bookmarkedVerses(translationId: String, bookId: String, chapter: Int) -> Set<Int> {
        Set(store.values.filter { $0.translationId == translationId && $0.bookId == bookId && $0.chapter == chapter }.map(\.verse))
    }

    /// toggleScriptureVerseBookmark：有则删，无则加；返回是否为新加
    @discardableResult
    func toggle(bookId: String, bookName: String, chapter: Int, verse: Int, translationId: String, text: String) -> Bool {
        let key = VerseBookmarkRules.key(translationId: translationId, bookId: bookId, chapter: chapter, verse: verse)
        var next = store
        let added: Bool
        if next[key] != nil { next.removeValue(forKey: key); added = false }
        else {
            next[key] = VerseBookmark(bookId: bookId, bookName: bookName, chapter: chapter, verse: verse, translationId: translationId,
                                      text: text, savedAt: Date().timeIntervalSince1970 * 1000)
            added = true
        }
        store = next
        defaults.set(VerseBookmarkRules.serialize(next), forKey: VerseBookmarkRules.storageKey)
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
