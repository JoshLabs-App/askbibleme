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

    /** scopeForTranslation —— web 系走 web-en，其余走 cuv-v20 */
    fun scopeFor(translationId: String): String =
        if (translationId.trim().lowercase().startsWith("web")) "web-en" else "cuv-v20"
}
