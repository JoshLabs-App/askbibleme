package me.askbible.native_.data

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import org.json.JSONArray
import org.json.JSONObject

/**
 * 划重点：一节里逐字符的颜色。
 * 存储格式与 RN `read-verse-text-highlights.ts` 完全一致 —— 键 `译本:卷:章:节`，
 * 值是 `[{i, c}]`（i = 该节正文里的字符下标，c = 调色板里的颜色），
 * 同一份也是会员同步的 `highlights` blob，网页端读得懂。与 iOS 的 VerseHighlightStore 对等。
 */
object VerseHighlightRules {
    const val STORAGE_KEY = "askbible-read-verse-text-highlights-v1"
    const val DEFAULT_COLOR = "#FFB103"
    /** RN VERSE_TEXT_HIGHLIGHT_PALETTE */
    val PALETTE = listOf("#FFB103", "#7BC96F", "#0FBCDB", "#F48FB1")

    fun key(translationId: String, bookId: String, chapter: Int, verse: Int) = "$translationId:$bookId:$chapter:$verse"

    fun normalizeColor(raw: Any?): String {
        val s = (raw as? String)?.trim()?.uppercase() ?: return DEFAULT_COLOR
        return if (s in PALETTE) s else DEFAULT_COLOR
    }
}

class VerseHighlightStore(context: Context) {
    private val sp = context.getSharedPreferences("askbible", Context.MODE_PRIVATE)

    /** 键 → （字符下标 → 颜色） */
    var store by mutableStateOf<Map<String, Map<Int, String>>>(emptyMap())
        private set

    /** 本机改动通知（会员同步用） */
    var onLocalChange: ((String) -> Unit)? = null
    var suppressChangeNotify = false

    init { store = parse(sp.getString(VerseHighlightRules.STORAGE_KEY, null)) }

    fun colors(translationId: String, bookId: String, chapter: Int, verse: Int): Map<Int, String> =
        store[VerseHighlightRules.key(translationId, bookId, chapter, verse)] ?: emptyMap()

    /** 当前章的划重点：节号 → （节内字符下标 → 颜色） */
    fun chapter(translationId: String, bookId: String, chapter: Int): Map<Int, Map<Int, String>> {
        val prefix = "$translationId:$bookId:$chapter:"
        val out = HashMap<Int, Map<Int, String>>()
        for ((key, byIndex) in store) {
            if (!key.startsWith(prefix)) continue
            val verse = key.removePrefix(prefix).toIntOrNull() ?: continue
            if (byIndex.isNotEmpty()) out[verse] = byIndex
        }
        return out
    }

    /** 给一段字符上色；color 传 null 表示擦除 */
    fun paint(translationId: String, bookId: String, chapter: Int, verse: Int, range: IntRange, color: String?) {
        val key = VerseHighlightRules.key(translationId, bookId, chapter, verse)
        val byIndex = HashMap(store[key] ?: emptyMap())
        for (i in range) {
            if (i < 0) continue
            if (color != null) byIndex[i] = VerseHighlightRules.normalizeColor(color) else byIndex.remove(i)
        }
        val next = HashMap(store)
        if (byIndex.isEmpty()) next.remove(key) else next[key] = byIndex
        store = next
        persist()
    }

    /** 云端并入（会员同步 highlights blob） */
    fun replace(next: Map<String, Map<Int, String>>) {
        store = next
        persist(notify = false)
    }

    fun clearForAccountSwitch() {
        store = emptyMap()
        persist(notify = false)
    }

    /** 同步用：`{"译本:卷:章:节": [{i, c}]}` */
    fun json(): JSONObject {
        val out = JSONObject()
        for ((key, byIndex) in store) {
            if (byIndex.isEmpty()) continue
            val arr = JSONArray()
            for (i in byIndex.keys.sorted()) {
                arr.put(JSONObject().put("i", i).put("c", byIndex[i] ?: VerseHighlightRules.DEFAULT_COLOR))
            }
            out.put(key, arr)
        }
        return out
    }

    private fun persist(notify: Boolean = true) {
        sp.edit().putString(VerseHighlightRules.STORAGE_KEY, json().toString()).apply()
        if (notify && !suppressChangeNotify) onLocalChange?.invoke("highlights")
    }

    companion object {
        fun parse(raw: String?): Map<String, Map<Int, String>> {
            if (raw.isNullOrEmpty()) return emptyMap()
            return parse(runCatching { JSONObject(raw) }.getOrNull() ?: return emptyMap())
        }

        fun parse(o: JSONObject): Map<String, Map<Int, String>> {
            val out = HashMap<String, Map<Int, String>>()
            val keys = o.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                val rows = o.opt(key) as? JSONArray ?: continue
                val byIndex = HashMap<Int, String>()
                for (i in 0 until rows.length()) {
                    when (val row = rows.opt(i)) {
                        is Int -> if (row >= 0) byIndex[row] = VerseHighlightRules.DEFAULT_COLOR
                        is JSONObject -> {
                            val idx = (MemberReadingSyncRules.num(row.opt("i")) ?: continue).toInt()
                            if (idx >= 0) byIndex[idx] = VerseHighlightRules.normalizeColor(row.opt("c"))
                        }
                    }
                }
                if (byIndex.isNotEmpty()) out[key] = byIndex
            }
            return out
        }
    }
}
