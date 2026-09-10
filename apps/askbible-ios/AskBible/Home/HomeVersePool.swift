import Foundation

/// 金句池里的一条：经文键 + 权重（theme_repeat_count）。
struct HomeVerseEntry: Hashable {
    let verseKey: String
    let weight: Int
}

/// 间隔记忆行。与 RN / Web 的 PrayerMemoryRowV1 同形；时间用毫秒，和 JS number 对齐。
struct PrayerMemoryRow: Codable, Equatable {
    var lastShownAt: Double
    var intervalMs: Double
    var level: Int
}

/// 首页金句池的选句算法。逐行对应共享库 `lib/home-prayer-pools/pick-next.ts`：
/// 按权重 + 间隔记忆选下一节，已看过的按 6h → ×2 → 最多 21 天的间隔复现。
/// 池子本身是 RN 的 `theme-repeat-ge5/manifest.json` 原样打进包（4242 节），不从 sqlite 现算 ——
/// sqlite 里 theme_repeat_count ≥ 5 的有 4392 节，manifest 少 150 节，以 manifest 为准。
enum HomeVersePool {
    static let pReview = 0.72
    static let initialIntervalMs: Double = 6 * 60 * 60 * 1000
    static let intervalFactor: Double = 2
    static let maxIntervalMs: Double = 21 * 24 * 60 * 60 * 1000

    private struct Manifest: Decodable {
        struct Entry: Decodable { let verseKey: String; let weight: Int }
        let entries: [Entry]
    }

    static func loadManifest(bundle: Bundle = .main) -> [HomeVerseEntry] {
        guard let url = bundle.url(forResource: "home-verse-manifest", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let m = try? JSONDecoder().decode(Manifest.self, from: data) else { return [] }
        return m.entries.map { HomeVerseEntry(verseKey: $0.verseKey, weight: $0.weight) }
    }

    static func dueAt(_ row: PrayerMemoryRow?, now: Double) -> Double {
        guard let row else { return 0 }
        return row.lastShownAt + row.intervalMs
    }

    static func weightedPick(_ items: [HomeVerseEntry], rng: () -> Double) -> String {
        guard !items.isEmpty else { return "" }
        let sum = items.reduce(0.0) { $0 + Double(max(1, $1.weight)) }
        var r = rng() * sum
        for it in items {
            r -= Double(max(1, it.weight))
            if r <= 0 { return it.verseKey }
        }
        return items[items.count - 1].verseKey
    }

    /// 在全池上选下一节。`rng` 每次给 [0,1) 的随机数；对拍时喂固定序列。
    static func pickNext(_ list: [HomeVerseEntry], memory: [String: PrayerMemoryRow],
                         now: Double, rng: () -> Double) -> String {
        guard !list.isEmpty else { return "" }
        let due = list.filter { dueAt(memory[$0.verseKey], now: now) <= now }
        if due.isEmpty {
            // 全都没到期：挑最早到期的那批按权重抽
            var bestT = Double.infinity
            for m in list {
                let t = dueAt(memory[m.verseKey], now: now)
                if t < bestT { bestT = t }
            }
            let tie = list.filter { dueAt(memory[$0.verseKey], now: now) == bestT }
            return weightedPick(tie, rng: rng)
        }
        if rng() < pReview {
            // 复习：到期里 level 最低的一档，按到期时间排（JS sort 稳定，这里带原下标保证同样稳定）
            let minLevel = due.map { memory[$0.verseKey]?.level ?? 0 }.min() ?? 0
            let tier = due.filter { (memory[$0.verseKey]?.level ?? 0) == minLevel }
            let sorted = tier.enumerated().sorted { a, b in
                let da = dueAt(memory[a.element.verseKey], now: now)
                let db = dueAt(memory[b.element.verseKey], now: now)
                return da == db ? a.offset < b.offset : da < db
            }.map { $0.element }
            return weightedPick(sorted.isEmpty ? due : sorted, rng: rng)
        }
        return weightedPick(list, rng: rng)
    }

    /// 展示过一节后推进记忆：新句 6h，老句间隔翻倍到 21 天封顶
    static func advanceMemory(_ memory: inout [String: PrayerMemoryRow], verseKey: String, now: Double) {
        let prev = memory[verseKey]
        let level = (prev?.level ?? 0) + 1
        let next: Double
        if let prev {
            next = min(maxIntervalMs, max(initialIntervalMs, prev.intervalMs) * intervalFactor)
        } else {
            next = initialIntervalMs
        }
        memory[verseKey] = PrayerMemoryRow(lastShownAt: now, intervalMs: next, level: level)
    }
}
