package me.askbible.native_.data

/** 读后两版：陪你探索（guide，发现版 V2）/ 查找资料（info，讲解版 V1） */
enum class InfoEditionVariant(val raw: String) { GUIDE("guide"), INFO("info") }

/**
 * 「读后两版」正文的归一化规则。逐条搬自 RN `src/bible/info-edition-format.ts`
 * （网站 `lib/bible/info-edition-v1-format.ts` 同源），由 check:info-edition 与 TS / Swift 三端对拍。
 */
object InfoEditionFormat {
    /** 查找资料里隐藏的版块标题（INFO_EDITION_KEY_SCENES_HEADING_PATTERNS） */
    val keyScenesHeadingPatterns = listOf(
        Regex("^关键画面$"), Regex("^關鍵畫面$"),
        Regex("^Key\\s+Scenes$", RegexOption.IGNORE_CASE), Regex("^Key\\s+Visuals$", RegexOption.IGNORE_CASE),
    )

    private val HEADING_LINE = Regex("^#{1,6}\\s+\\S")
    private val HR = Regex("^(?:-{3,}|\\*{3,}|_{3,})\\s*$")
    private val HEADING_ANY = Regex("^(\\s*)#{1,6}(\\s+\\S.*)$")
    private val HEADING_SINGLE = Regex("^(\\s*)#(\\s+\\S.*)$")
    private val FENCE = Regex("^```(?:markdown|md)?\\s*\\n?([\\s\\S]*?)\\n?```$", RegexOption.IGNORE_CASE)

    private fun isHeadingLine(line: String) = HEADING_LINE.containsMatchIn(line.trim())
    private fun isHorizontalRule(line: String) = HR.matches(line.trim())
    private fun collapseBlankLines(s: String) = s.replace(Regex("\\n{3,}"), "\n\n")

    /** stripInfoEditionSectionByHeading：删掉指定标题（≤ 3 级）到下一个同级或更高级标题之间的整段 */
    fun stripSection(markdown: String, patterns: List<Regex>): String {
        if (markdown.trim().isEmpty()) return markdown
        val lines = markdown.replace("\r\n", "\n").split("\n")
        val keep = ArrayList<String>()
        val headingRe = Regex("^(#{1,6})\\s+(.*\\S)\\s*$")
        fun heading(line: String): Pair<Int, String>? = headingRe.matchEntire(line)?.let { it.groupValues[1].length to it.groupValues[2] }
        var i = 0
        while (i < lines.size) {
            val h = heading(lines[i])
            if (h != null && h.first <= 3 && patterns.any { it.containsMatchIn(h.second) }) {
                val startLevel = h.first
                i += 1
                while (i < lines.size) {
                    val nh = heading(lines[i])
                    if (nh != null && nh.first <= startLevel) break
                    i += 1
                }
                continue
            }
            keep.add(lines[i]); i += 1
        }
        return collapseBlankLines(keep.joinToString("\n")).trim()
    }

    /**
     * normalizeInfoEditionCompareMarkdown：去 code fence、首个标题升一级其余 # 降为 ##、
     * 贴着标题 / 边界 / 另一条分隔线的 --- 丢掉、软换行合并、首行强制成 H1、旧式「X第N章导读」标题、嵌套列表拉平。
     */
    fun normalize(raw: String): String {
        var text = raw.trim()
        FENCE.matchEntire(text)?.let { text = it.groupValues[1].trim() }
        val lines = text.replace("\r\n", "\n").split("\n").toMutableList()
        val cleaned = ArrayList<String>()
        var firstHeadingSeen = false
        fun nearestMeaningful(start: Int, step: Int): String? {
            var i = start
            while (i >= 0 && i < lines.size) {
                val c = lines[i].trim()
                if (c.isNotEmpty()) return c
                i += step
            }
            return null
        }
        for (i in lines.indices) {
            val line0 = lines[i]
            HEADING_ANY.matchEntire(line0)?.let { m ->
                if (!firstHeadingSeen) {
                    firstHeadingSeen = true
                    lines[i] = "${m.groupValues[1]}#${m.groupValues[2]}"
                } else {
                    HEADING_SINGLE.matchEntire(line0)?.let { sm -> lines[i] = "${sm.groupValues[1]}##${sm.groupValues[2]}" }
                }
            }
            val line = lines[i]
            if (!isHorizontalRule(line)) { cleaned.add(line); continue }
            val prev = nearestMeaningful(i - 1, -1)
            val next = nearestMeaningful(i + 1, 1)
            val shouldDrop = prev == null || next == null ||
                isHorizontalRule(prev) || isHorizontalRule(next) || isHeadingLine(prev) || isHeadingLine(next)
            if (!shouldDrop) cleaned.add(line)
        }
        val merged = enforcePrimaryHeadingStructure(mergeHardWrappedParagraphLines(cleaned))
        text = collapseBlankLines(merged.joinToString("\n")).trim()
        // 手机上把嵌套列表的缩进拉平：保留顶层序号，去掉嵌套的圆点 / 序号前缀
        text = text.replace(Regex("(?m)^[ \\t]+[-*+]\\s+"), "").replace(Regex("(?m)^[ \\t]+\\d+\\.\\s+"), "")
        return text
    }

    private val PARA_BLOCK_START = Regex("^(#{1,6}\\s|>|\\* |- |\\+ |```|~~~)")
    private val PARA_ORDERED = Regex("^\\d+\\.\\s")

    private fun isParagraphText(line: String): Boolean {
        val t = line.trim()
        if (t.isEmpty()) return false
        if (isHorizontalRule(t)) return false
        if (PARA_BLOCK_START.containsMatchIn(t)) return false
        if (PARA_ORDERED.containsMatchIn(t)) return false
        return true
    }

    /** 行尾两个以上空格视为软换行：与下一行正文并成一段 */
    private fun mergeHardWrappedParagraphLines(lines: List<String>): List<String> {
        val out = ArrayList<String>()
        var i = 0
        val trailing = Regex("\\s+$"); val softBreak = Regex("\\s{2,}$")
        while (i < lines.size) {
            var currentRaw = lines[i]
            if (!isParagraphText(currentRaw)) { out.add(currentRaw); i += 1; continue }
            var current = currentRaw.replace(trailing, "")
            while (softBreak.containsMatchIn(currentRaw) && i + 1 < lines.size && isParagraphText(lines[i + 1])) {
                current = "$current ${lines[i + 1].trim()}"
                i += 1
                currentRaw = lines[i]
            }
            out.add(current)
            i += 1
        }
        return out
    }

    private fun enforcePrimaryHeadingStructure(lines: List<String>): List<String> {
        val next = lines.toMutableList()
        val first = next.indexOfFirst { it.trim().isNotEmpty() }
        if (first < 0) return next
        val firstLine = next[first]
        val hm = Regex("^(\\s*)#{1,6}\\s+(\\S.*)$").matchEntire(firstLine)
        next[first] = if (hm != null) "${hm.groupValues[1]}# ${hm.groupValues[2]}" else "# ${firstLine.trim()}"
        for (i in first + 1 until next.size) {
            HEADING_SINGLE.matchEntire(next[i])?.let { m -> next[i] = "${m.groupValues[1]}##${m.groupValues[2]}" }
        }
        // 旧式标题「# 马太福音第23章导读」→「# 马太福音 23章」
        Regex("^(\\s*#\\s*)(.+?)\\s*第?\\s*(\\d+)\\s*章\\s*导读\\s*$").matchEntire(next[first])?.let { m ->
            next[first] = "${m.groupValues[1]}${m.groupValues[2].trim()} ${m.groupValues[3]}章"
        }
        return next
    }

    /** 阅读器最终喂给 Markdown 渲染的文本：归一化后，查找资料再去掉「关键画面」版块 */
    fun readerText(markdown: String, variant: InfoEditionVariant): String {
        var text = normalize(markdown)
        if (variant == InfoEditionVariant.INFO) text = stripSection(text, keyScenesHeadingPatterns)
        return text
    }

    /** splitPrimaryHeading：首个有内容的行若是「# 标题」就摘成页头，并吃掉紧跟的一个空行 */
    fun splitPrimaryHeading(markdown: String): Pair<String?, String> {
        val lines = markdown.split("\n").toMutableList()
        val first = lines.indexOfFirst { it.trim().isNotEmpty() }
        if (first < 0) return null to markdown
        val m = Regex("^#\\s+(.+)$").matchEntire(lines[first]) ?: return null to markdown
        val heading = m.groupValues[1].trim()
        lines.removeAt(first)
        if (first < lines.size && lines[first].trim().isEmpty()) lines.removeAt(first)
        return heading to lines.joinToString("\n").trim()
    }
}
