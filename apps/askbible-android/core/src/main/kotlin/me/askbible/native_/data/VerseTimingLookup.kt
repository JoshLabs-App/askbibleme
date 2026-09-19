package me.askbible.native_.data

/** 一节在整章音频里的时间区间 */
data class VerseTiming(val verse: Int, val start: Double, val end: Double)

/**
 * 由播放位置定位当前节。与 iOS 的 `VerseTimingLookup` 对等双写。
 *
 * 时间轴按 start 升序，用二分找最后一个 start <= time 的节；
 * 落在两节之间的空隙（朗读停顿）算作前一节仍在朗读。
 */
object VerseTimingLookup {
    fun activeVerse(time: Double, timings: List<VerseTiming>): Int? {
        if (timings.isEmpty() || time < 0) return null
        val first = timings.first()
        if (time < first.start) return null

        var lo = 0
        var hi = timings.size - 1
        var found = -1
        while (lo <= hi) {
            val mid = (lo + hi) / 2
            if (timings[mid].start <= time) {
                found = mid
                lo = mid + 1
            } else {
                hi = mid - 1
            }
        }
        if (found < 0) return null
        // 超出整章最后一节的 end 之后不再高亮
        if (found == timings.size - 1 && time > timings[found].end) return null
        return timings[found].verse
    }

    /**
     * 当前节 + 节内进度（0…1）。进度给 [VerseSentences] 插值定位到句，
     * 让跟读高亮跟到句而不是整节（Josh 2026-09-19）。
     * 停顿间隙（time > end）算 1.0，即停在本节最后一句上，不会提前跳走。
     */
    fun activeVerseProgress(time: Double, timings: List<VerseTiming>): Pair<Int, Double>? {
        val verse = activeVerse(time, timings) ?: return null
        val t = timings.firstOrNull { it.verse == verse } ?: return null
        val span = t.end - t.start
        if (span <= 0) return verse to 0.0
        return verse to ((time - t.start) / span).coerceIn(0.0, 1.0)
    }

    /**
     * scopeForTranslation。RN 里是「不是 web 就当和合本」，只有内置那几个译本时没问题；
     * 放开 YouVersion 全量译本后，法语版会去套和合本的时间轴、高亮全错位，
     * 所以认不出的译本一律返回 null ——「没有时间点就不高亮」（Josh 2026-09-11）。
     */
    fun scopeFor(translationId: String): String? {
        val id = translationId.trim().lowercase()
        return when {
            id.startsWith("web") -> "web-en"
            id.startsWith("cuv") -> "cuv-v20"
            else -> null
        }
    }
}
