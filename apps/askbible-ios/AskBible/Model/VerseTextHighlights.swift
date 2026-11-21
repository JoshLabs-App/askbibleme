import Foundation
import SwiftUI
import UIKit

/// 划重点：一节里逐字符的颜色。
/// 存储格式与 RN `read-verse-text-highlights.ts` 完全一致 —— 键 `译本:卷:章:节`，
/// 值是 `[{i, c}]`（i = 该节正文里的字符下标，c = 调色板里的颜色），
/// 同一份也是会员同步的 `highlights` blob，网页端读得懂。
enum VerseHighlightRules {
    static let storageKey = "askbible-read-verse-text-highlights-v1"
    static let timestampsStorageKey = "askbible-read-verse-text-highlights-timestamps-v1"
    static let tombstoneTtlMs: Double = 60 * 24 * 60 * 60 * 1000
    static let defaultColor = "#FFB103"
    /// RN VERSE_TEXT_HIGHLIGHT_PALETTE（2026-09-19 改版，见 docs/design-color-system.md）。
    /// 存的是「颜料」hex，渲染时一律走 `fillColor(_:)` 叠 alpha 铺在羊皮底上，
    /// 不要直接把这些 hex 当不透明背景色用。
    static let palette = [
        "#FFB103",  // 灯油黄
        "#A3B565",  // 橄榄绿
        "#4E86A0",  // 青石蓝
        "#C0625F",  // 石榴红
    ]

    /// 旧色板 → 新色板。老用户存量数据里是旧 hex，不迁就会被 normalizeColor 全打回默认黄。
    static let legacyColorMap = [
        "#7BC96F": "#A3B565",
        "#0FBCDB": "#4E86A0",
        "#F48FB1": "#C0625F",
    ]

    /// 每支笔的铺色透明度（浅色, 深色）：合成后亮度接近，谁也不比谁响
    static let fillAlpha: [String: (CGFloat, CGFloat)] = [
        "#FFB103": (0.45, 0.28),
        "#A3B565": (0.50, 0.28),
        "#4E86A0": (0.46, 0.32),
        "#C0625F": (0.42, 0.30),
    ]

    /// 颜料 hex → 实际铺的颜色（随系统深浅自动换 alpha）。渲染端一律走这里。
    static func fillColor(_ raw: String) -> UIColor {
        let hex = normalizeColor(raw)
        let (light, dark) = fillAlpha[hex] ?? (0.45, 0.28)
        let base = UIColor(Color(hex: hex))
        return UIColor { trait in
            base.withAlphaComponent(trait.userInterfaceStyle == .dark ? dark : light)
        }
    }

    static func key(translationId: String, bookId: String, chapter: Int, verse: Int) -> String {
        "\(translationId):\(bookId):\(chapter):\(verse)"
    }

    static func normalizeColor(_ raw: Any?) -> String {
        guard let s = (raw as? String)?.trimmingCharacters(in: .whitespaces).uppercased() else { return defaultColor }
        if palette.contains(s) { return s }
        return legacyColorMap[s] ?? defaultColor
    }
}

@MainActor
final class VerseHighlightStore: ObservableObject {
    /// 键 → （字符下标 → 颜色）
    @Published private(set) var store: [String: [Int: String]] = [:]
    private(set) var verseTimestamps: [String: Double] = [:]
    private let defaults = UserDefaults.standard

    /// 本机改动通知（会员同步用）
    var onLocalChange: ((String) -> Void)?
    var suppressChangeNotify = false

    init() {
        let loaded = Self.parse(defaults.string(forKey: VerseHighlightRules.storageKey))
        store = loaded
        verseTimestamps = Self.parseTimestamps(defaults.string(forKey: VerseHighlightRules.timestampsStorageKey), liveStore: loaded)
    }

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
        let nowMs = Date().timeIntervalSince1970 * 1000
        verseTimestamps[key] = nowMs
        verseTimestamps = Self.pruneTimestamps(verseTimestamps, liveStore: store, now: nowMs)
        persist()
    }

    func clear(translationId: String, bookId: String, chapter: Int, verse: Int) {
        let key = VerseHighlightRules.key(translationId: translationId, bookId: bookId, chapter: chapter, verse: verse)
        store[key] = nil
        let nowMs = Date().timeIntervalSince1970 * 1000
        verseTimestamps[key] = nowMs
        verseTimestamps = Self.pruneTimestamps(verseTimestamps, liveStore: store, now: nowMs)
        persist()
    }

    /// 云端并入（会员同步 highlights blob）
    func replace(_ next: [String: [Int: String]]) {
        store = next
        verseTimestamps = Self.pruneTimestamps(verseTimestamps, liveStore: next)
        persist(notify: false)
    }

    /// 云端并入（含 `_t` 节级时间戳与擦除墓碑）
    func replace(json o: [String: Any]) {
        let nowMs = Date().timeIntervalSince1970 * 1000
        let nextStore = Self.parse(json: o)
        let remoteTs = Self.extractTimestamps(json: o, liveStore: nextStore, now: nowMs)
        var mergedTs = verseTimestamps
        for (k, ts) in remoteTs {
            mergedTs[k] = max(mergedTs[k] ?? 0, ts)
        }
        store = nextStore
        verseTimestamps = Self.pruneTimestamps(mergedTs, liveStore: nextStore, now: nowMs)
        persist(notify: false)
    }

    private var storeJSON: [String: Any] {
        var out: [String: Any] = [:]
        for (key, byIndex) in store where !byIndex.isEmpty {
            out[key] = byIndex.keys.sorted().map { ["i": $0, "c": byIndex[$0] ?? VerseHighlightRules.defaultColor] as [String: Any] }
        }
        return out
    }

    /// 同步用：`{"译本:卷:章:节": [{i, c}], "_t": {"译本:卷:章:节": tsMs}}`
    var json: [String: Any] {
        var out = storeJSON
        let prunedTs = Self.pruneTimestamps(verseTimestamps, liveStore: store)
        if !prunedTs.isEmpty {
            out["_t"] = prunedTs
        }
        return out
    }

    func clearForAccountSwitch() {
        store = [:]
        verseTimestamps = [:]
        defaults.removeObject(forKey: VerseHighlightRules.storageKey)
        defaults.removeObject(forKey: VerseHighlightRules.timestampsStorageKey)
    }

    private func persist(notify: Bool = true) {
        if let data = try? JSONSerialization.data(withJSONObject: storeJSON) {
            defaults.set(String(decoding: data, as: UTF8.self), forKey: VerseHighlightRules.storageKey)
        }
        if let tsData = try? JSONSerialization.data(withJSONObject: verseTimestamps, options: [.sortedKeys]) {
            defaults.set(String(decoding: tsData, as: UTF8.self), forKey: VerseHighlightRules.timestampsStorageKey)
        }
        if notify, !suppressChangeNotify { onLocalChange?("highlights") }
    }

    static func pruneTimestamps(_ ts: [String: Double], liveStore: [String: [Int: String]],
                                now: Double = Date().timeIntervalSince1970 * 1000) -> [String: Double] {
        var out: [String: Double] = [:]
        for (k, v) in ts where k != "_t" && v.isFinite && v > 0 {
            let isLive = !(liveStore[k]?.isEmpty ?? true)
            if isLive || now - v <= VerseHighlightRules.tombstoneTtlMs {
                out[k] = v
            }
        }
        return out
    }

    static func parseTimestamps(_ raw: String?, liveStore: [String: [Int: String]],
                                now: Double = Date().timeIntervalSince1970 * 1000) -> [String: Double] {
        guard let raw, let data = raw.data(using: .utf8),
              let o = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return [:] }
        var rawTs: [String: Double] = [:]
        for (k, v) in o where k != "_t" {
            if let num = MemberReadingSyncRules.num(v), num.isFinite, num > 0 {
                rawTs[k] = num
            }
        }
        return pruneTimestamps(rawTs, liveStore: liveStore, now: now)
    }

    static func extractTimestamps(json o: [String: Any], liveStore: [String: [Int: String]],
                                  now: Double = Date().timeIntervalSince1970 * 1000) -> [String: Double] {
        guard let tMap = o["_t"] as? [String: Any] else { return [:] }
        var rawTs: [String: Double] = [:]
        for (k, v) in tMap where k != "_t" {
            if let num = MemberReadingSyncRules.num(v), num.isFinite, num > 0 {
                rawTs[k] = num
            }
        }
        return pruneTimestamps(rawTs, liveStore: liveStore, now: now)
    }

    static func parse(_ raw: String?) -> [String: [Int: String]] {
        guard let raw, let data = raw.data(using: .utf8),
              let o = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return [:] }
        return parse(json: o)
    }

    static func parse(json o: [String: Any]) -> [String: [Int: String]] {
        var out: [String: [Int: String]] = [:]
        for (key, value) in o {
            if key == "_t" { continue }
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
