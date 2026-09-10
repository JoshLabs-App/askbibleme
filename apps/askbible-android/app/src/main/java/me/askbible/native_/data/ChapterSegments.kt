package me.askbible.native_.data

import android.content.Context
import org.json.JSONObject

/**
 * 一章的分段元数据：小标题（起始节 → 标题）与段落起点。
 * 对应 RN buildChapterSegmentMeta 的产物；数据由 tools/gen-chapter-segments.mts 按 t1（故事化小标题）模式生成。
 */
data class ChapterSegmentMeta(
    val headings: Map<Int, List<String>>,
    val paragraphStarts: Set<Int>,
) {
    companion object { val EMPTY = ChapterSegmentMeta(emptyMap(), emptySet()) }
}

object ChapterSegments {
    @Volatile private var root: JSONObject? = null

    private fun load(context: Context): JSONObject {
        root?.let { return it }
        val text = context.assets.open("chapter-segments.json").bufferedReader().use { it.readText() }
        return JSONObject(text).also { root = it }
    }

    /**
     * english = 英文译本的面（RN preferEnglishTitles）：小标题只取 USFM 的英文 T1（`he`），没有就不显示；
     * 段落起点若英文那套不同则用 `pe`。中文面下 zh-TW 由调用方再转繁。
     */
    fun meta(context: Context, bookId: String, chapter: Int, english: Boolean = false): ChapterSegmentMeta {
        val entry = load(context).optJSONObject(bookId.uppercase())?.optJSONObject(chapter.toString())
            ?: return ChapterSegmentMeta.EMPTY
        val headings = HashMap<Int, List<String>>()
        entry.optJSONObject(if (english) "he" else "h")?.let { h ->
            for (k in h.keys()) {
                val arr = h.optJSONArray(k) ?: continue
                headings[k.toInt()] = List(arr.length()) { arr.getString(it) }
            }
        }
        val starts = HashSet<Int>()
        (entry.optJSONArray(if (english) "pe" else "p") ?: entry.optJSONArray("p"))?.let { p -> for (i in 0 until p.length()) starts.add(p.getInt(i)) }
        return ChapterSegmentMeta(headings, starts)
    }

    /** 对应 buildParagraphGroups：段落起点或带小标题的节开新段 */
    fun paragraphGroups(verses: List<LoadedVerse>, meta: ChapterSegmentMeta): List<List<LoadedVerse>> {
        val groups = ArrayList<List<LoadedVerse>>()
        var current = ArrayList<LoadedVerse>()
        verses.forEachIndexed { i, v ->
            val isStart = i == 0 || v.number in meta.paragraphStarts || !meta.headings[v.number].isNullOrEmpty()
            if (isStart && current.isNotEmpty()) { groups.add(current); current = ArrayList() }
            current.add(v)
        }
        if (current.isNotEmpty()) groups.add(current)
        return groups
    }
}
