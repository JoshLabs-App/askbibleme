package me.askbible.native_.data

/** 金句池里的一条：经文键 + 权重（theme_repeat_count） */
data class HomeVerseEntry(val verseKey: String, val weight: Int)

/** 间隔记忆行。与 RN / Web 的 PrayerMemoryRowV1 同形；时间用毫秒 Double，和 JS number 对齐 */
data class PrayerMemoryRow(val lastShownAt: Double, val intervalMs: Double, val level: Int)

/**
 * 首页金句池的选句算法。逐行对应共享库 lib/home-prayer-pools/pick-next.ts，与 iOS 的 HomeVersePool 对等：
 * 按权重 + 间隔记忆选下一节，已看过的按 6h → ×2 → 最多 21 天的间隔复现。
 * 池子是 RN 的 theme-repeat-ge5/manifest.json 原样打进 assets（4242 节），不从 sqlite 现算。
 */
object HomeVersePool {
    const val P_REVIEW = 0.72
    const val INITIAL_INTERVAL_MS = 6.0 * 60 * 60 * 1000
    const val INTERVAL_FACTOR = 2.0
    const val MAX_INTERVAL_MS = 21.0 * 24 * 60 * 60 * 1000

    fun dueAt(row: PrayerMemoryRow?, now: Double): Double = if (row == null) 0.0 else row.lastShownAt + row.intervalMs

    fun weightedPick(items: List<HomeVerseEntry>, rng: () -> Double): String {
        if (items.isEmpty()) return ""
        var sum = 0.0
        for (it in items) sum += maxOf(1, it.weight).toDouble()
        var r = rng() * sum
        for (it in items) {
            r -= maxOf(1, it.weight).toDouble()
            if (r <= 0) return it.verseKey
        }
        return items[items.size - 1].verseKey
    }

    /** 在全池上选下一节。rng 每次给 [0,1) 的随机数；对拍时喂固定序列 */
    fun pickNext(list: List<HomeVerseEntry>, memory: Map<String, PrayerMemoryRow>, now: Double, rng: () -> Double): String {
        if (list.isEmpty()) return ""
        val due = list.filter { dueAt(memory[it.verseKey], now) <= now }
        if (due.isEmpty()) {
            // 全都没到期：挑最早到期的那批按权重抽
            var bestT = Double.POSITIVE_INFINITY
            for (m in list) { val t = dueAt(memory[m.verseKey], now); if (t < bestT) bestT = t }
            val tie = list.filter { dueAt(memory[it.verseKey], now) == bestT }
            return weightedPick(tie, rng)
        }
        if (rng() < P_REVIEW) {
            // 复习：到期里 level 最低的一档，按到期时间排（sortedBy 是稳定排序，与 JS sort 一致）
            val minLevel = due.minOf { memory[it.verseKey]?.level ?: 0 }
            val tier = due.filter { (memory[it.verseKey]?.level ?: 0) == minLevel }
            val sorted = tier.sortedBy { dueAt(memory[it.verseKey], now) }
            return weightedPick(if (sorted.isEmpty()) due else sorted, rng)
        }
        return weightedPick(list, rng)
    }

    /** 展示过一节后推进记忆：新句 6h，老句间隔翻倍到 21 天封顶 */
    fun advanceMemory(memory: MutableMap<String, PrayerMemoryRow>, verseKey: String, now: Double) {
        val prev = memory[verseKey]
        val level = (prev?.level ?: 0) + 1
        val next = if (prev == null) INITIAL_INTERVAL_MS
                   else minOf(MAX_INTERVAL_MS, maxOf(INITIAL_INTERVAL_MS, prev.intervalMs) * INTERVAL_FACTOR)
        memory[verseKey] = PrayerMemoryRow(now, next, level)
    }
}
