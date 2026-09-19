package me.askbible.native_.data

/**
 * 跟读高亮的「句」切分。与 iOS `VerseSentences.swift` 对等双写。
 *
 * 时间轴（verse-timings）只精确到**节**，一节可能长达三四行，整节铺底看起来就是
 * 「按行高亮」，和耳朵听到的位置对不上（Josh 2026-09-19）。
 * 这里把一节再切成句，节内按字数比例插值定位当前句 —— 每到一节边界都会重新对齐，
 * 误差被限制在一节之内，长节的观感提升最明显。
 */
object VerseSentences {
    /** 句末标点。冒号、逗号、顿号不算断句 —— 中文经文里逗号极多，按逗号切会碎成一片。 */
    private val TERMINATORS = setOf('。', '！', '？', '；', '!', '?', ';')
    /** 紧跟在句末标点后面、应当并进同一句的收尾符号 */
    private val TRAILING = setOf('”', '’', '」', '』', '）', ')', '》', '"', '\'')
    /** 短于这个长度的尾巴并进上一句，避免出现只高亮一个引号的碎片 */
    private const val MIN_LENGTH = 2

    /** 返回各句在 [text] 里的字符下标区间（前闭后开） */
    fun split(text: String): List<IntRange> {
        if (text.isEmpty()) return emptyList()
        val out = ArrayList<IntRange>()
        var start = 0
        var i = 0
        while (i < text.length) {
            if (text[i] !in TERMINATORS) { i++; continue }
            var end = i + 1
            // 连续的句末标点（「？！」）和收尾引号都并进本句
            while (end < text.length && (text[end] in TERMINATORS || text[end] in TRAILING)) end++
            out.add(start until end)
            start = end
            i = end
        }
        if (start < text.length) out.add(start until text.length)
        if (out.isEmpty()) return listOf(0 until text.length)

        // 合并过短的碎片到上一句
        val merged = ArrayList<IntRange>()
        for (r in out) {
            val last = merged.lastOrNull()
            if (last != null && (r.last - r.first + 1) < MIN_LENGTH) {
                merged[merged.size - 1] = last.first..r.last
            } else {
                merged.add(r)
            }
        }
        return merged
    }

    /**
     * 按节内进度（0…1）定位当前句。权重用「非空白字符数」，朗读快慢在一节之内基本均匀。
     * [text] 为空时返回 null。
     */
    fun sentenceAt(progress: Double, text: String): IntRange? {
        val ranges = split(text)
        if (ranges.isEmpty()) return null
        if (ranges.size == 1) return ranges[0]
        val weights = ranges.map { r ->
            maxOf(1, (r.first..r.last).count { !text[it].isWhitespace() })
        }
        val total = weights.sum()
        val target = total * progress.coerceIn(0.0, 1.0)
        var acc = 0
        for ((i, w) in weights.withIndex()) {
            acc += w
            if (acc > target) return ranges[i]
        }
        return ranges.last()
    }
}
