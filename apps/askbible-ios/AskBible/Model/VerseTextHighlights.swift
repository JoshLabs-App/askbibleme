import Foundation

/// 划重点：一节里逐字符的颜色。
/// 存储格式与 RN `read-verse-text-highlights.ts` 完全一致 —— 键 `译本:卷:章:节`，
/// 值是 `[{i, c}]`（i = 该节正文里的字符下标，c = 调色板里的颜色），
/// 同一份也是会员同步的 `highlights` blob，网页端读得懂。
enum VerseHighlightRules {
    static let storageKey = "askbible-read-verse-text-highlights-v1"
    static let defaultColor = "#FFB103"
    /// RN VERSE_TEXT_HIGHLIGHT_PALETTE
    static let palette = ["#FFB103", "#7BC96F", "#0FBCDB", "#F48FB1"]

    static func key(translationId: String, bookId: String, chapter: Int, verse: Int) -> String {
        "\(translationId):\(bookId):\(chapter):\(verse)"
    }

    static func normalizeColor(_ raw: Any?) -> String {
        guard let s = (raw as? String)?.trimmingCharacters(in: .whitespaces).uppercased(),
              palette.contains(s) else { return defaultColor }
        return s
    }
}

@MainActor
final class VerseHighlightStore: ObservableObject {
    /// 键 → （字符下标 → 颜色）
    @Published private(set) var store: [String: [Int: String]] = [:]
    private let defaults = UserDefaults.standard

    /// 本机改动通知（会员同步用）
    var onLocalChange: ((String) -> Void)?
    var suppressChangeNotify = false

    init() { store = Self.parse(defaults.string(forKey: VerseHighlightRules.storageKey)) }

    func colors(translationId: String, bookId: String, chapter: Int, verse: Int) -> [Int: String] {
        store[VerseHighlightRules.key(translationId: translationId, bookId: bookId, chapter: chapter, verse: verse)] ?? [:]
    }

    func hasAny(translationId: String, bookId: String, chapter: Int) -> Bool {
        let prefix = "\(translationId):\(bookId):\(chapter):"
        return store.keys.contains { $0.hasPrefix(prefix) }
    }

    /// 给一段字符上色；color 传 nil 表示擦除
    func paint(translationId: String, bookId: String, chapter: Int, verse: Int,
               range: ClosedRange<Int>, color: String?) {
        let key = VerseHighlightRules.key(translationId: translationId, bookId: bookId, chapter: chapter, verse: verse)
        var byIndex = store[key] ?? [:]
        for i in range where i >= 0 {
            if let color { byIndex[i] = VerseHighlightRules.normalizeColor(color) } else { byIndex[i] = nil }
        }
        if byIndex.isEmpty { store[key] = nil } else { store[key] = byIndex }
        persist()
    }

    func clear(translationId: String, bookId: String, chapter: Int, verse: Int) {
        store[VerseHighlightRules.key(translationId: translationId, bookId: bookId, chapter: chapter, verse: verse)] = nil
        persist()
    }

    /// 云端并入（会员同步 highlights blob）
    func replace(_ next: [String: [Int: String]]) {
        store = next
        persist(notify: false)
    }

    /// 同步用：`{"译本:卷:章:节": [{i, c}]}`
    var json: [String: Any] {
        var out: [String: Any] = [:]
        for (key, byIndex) in store where !byIndex.isEmpty {
            out[key] = byIndex.keys.sorted().map { ["i": $0, "c": byIndex[$0] ?? VerseHighlightRules.defaultColor] as [String: Any] }
        }
        return out
    }

    func clearForAccountSwitch() {
        store = [:]
        persist(notify: false)
    }

    private func persist(notify: Bool = true) {
        if let data = try? JSONSerialization.data(withJSONObject: json) {
            defaults.set(String(decoding: data, as: UTF8.self), forKey: VerseHighlightRules.storageKey)
        }
        if notify, !suppressChangeNotify { onLocalChange?("highlights") }
    }

    static func parse(_ raw: String?) -> [String: [Int: String]] {
        guard let raw, let data = raw.data(using: .utf8),
              let o = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return [:] }
        return parse(json: o)
    }

    static func parse(json o: [String: Any]) -> [String: [Int: String]] {
        var out: [String: [Int: String]] = [:]
        for (key, value) in o {
            guard let rows = value as? [Any] else { continue }
            var byIndex: [Int: String] = [:]
            for row in rows {
                if let i = row as? Int, i >= 0 {
                    byIndex[i] = VerseHighlightRules.defaultColor
                } else if let d = row as? [String: Any],
                          let i = MemberReadingSyncRules.num(d["i"]), i >= 0, i == i.rounded() {
                    byIndex[Int(i)] = VerseHighlightRules.normalizeColor(d["c"])
                }
            }
            if !byIndex.isEmpty { out[key] = byIndex }
        }
        return out
    }
}
