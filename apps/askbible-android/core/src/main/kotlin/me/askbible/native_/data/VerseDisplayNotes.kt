package me.askbible.native_.data

/**
 * 首页 / 轮播等短展示用：去掉括注。逐行对应共享库 lib/bible/strip-zh-verse-display-notes.ts，与 iOS 对等：
 * · 〔…〕 译注整段去掉
 * · 经节**开头**的 (…) / （…）（诗前「（上行之诗）」「（大卫的诗）」）反复剥，最多 8 层
 * · 连续空白折成一个空格；剥空了就退回原文
 */
object VerseDisplayNotes {
    /**
     * JS 的 \s / trim 字符集（含 NBSP、全角空格 U+3000、U+FEFF）。
     * 三端都用这一份显式集合 —— Java 的 \s 只认 ASCII，Kotlin 的 trim() 又不认 NBSP，直接用会漂。
     */
    private const val WS_CLASS = "[\\t\\n\\x{0B}\\x{0C}\\r \\x{A0}\\x{1680}\\x{2000}-\\x{200A}\\x{2028}\\x{2029}\\x{202F}\\x{205F}\\x{3000}\\x{FEFF}]"
    private val jsWhitespace: Set<Char> = setOf('\u0009', '\u000A', '\u000B', '\u000C', '\u000D', '\u0020', '\u00A0', '\u1680', '\u2000', '\u2001', '\u2002', '\u2003', '\u2004', '\u2005', '\u2006', '\u2007', '\u2008', '\u2009', '\u200A', '\u2028', '\u2029', '\u202F', '\u205F', '\u3000', '\uFEFF')
    private val notesRe = Regex("\\x{3014}[\\s\\S]*?\\x{3015}")
    private val halfRe = Regex("^$WS_CLASS*\\([^)]*\\)$WS_CLASS*")
    private val fullRe = Regex("^$WS_CLASS*（[^）]*）$WS_CLASS*")
    private val collapseRe = Regex("$WS_CLASS{2,}")

    fun jsTrim(s: String): String {
        var start = 0
        var end = s.length
        while (start < end && s[start] in jsWhitespace) start++
        while (end > start && s[end - 1] in jsWhitespace) end--
        return s.substring(start, end)
    }

    fun strip(text: String): String {
        val raw = jsTrim(text)
        if (raw.isEmpty()) return ""
        var s = notesRe.replace(raw, "")
        for (i in 0 until 8) {
            val next = fullRe.replace(halfRe.replace(s, ""), "")
            if (next == s) break
            s = next
        }
        val collapsed = jsTrim(collapseRe.replace(s, " "))
        return if (collapsed.isEmpty()) raw else collapsed
    }
}
