package me.askbible.native_.data

/**
 * 交叉引用目标（ScriptureXrefTarget）。verseEnd 已保证 >= verseStart。
 * 与 iOS 的 XrefTarget 对等；label 格式来自 RN 的 format-scripture-xref-label.ts。
 */
data class XrefTarget(
    val bookId: String,
    val chapter: Int,
    val verseStart: Int,
    val verseEnd: Int,
    val priority: Int,
) {
    /** formatScriptureXrefLabel：`{书名} {章}:{起}` 或 `{起}–{止}`（en dash） */
    fun label(bookName: String): String {
        val range = if (verseStart == verseEnd) "$verseStart" else "$verseStart\u2013$verseEnd"
        return "$bookName $chapter:$range"
    }
}

data class VerseXrefs(val verse: Int, val incoming: List<XrefTarget>, val outgoing: List<XrefTarget>) {
    val isEmpty: Boolean get() = incoming.isEmpty() && outgoing.isEmpty()
}
