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
    const val TIMESTAMPS_STORAGE_KEY = "askbible-read-verse-text-highlights-timestamps-v1"
    const val TOMBSTONE_TTL_MS = 60L * 24L * 60L * 60L * 1000L
    const val DEFAULT_COLOR = "#FFB103"
    /**
     * RN VERSE_TEXT_HIGHLIGHT_PALETTE（2026-09-19 改版，见 docs/design-color-system.md）。
     * 存的是「颜料」hex，渲染时一律叠 [fillAlpha] 铺在羊皮底上，不要当不透明背景色用。
     */
    val PALETTE = listOf(
        "#FFB103", // 灯油黄
        "#A3B565", // 橄榄绿
        "#4E86A0", // 青石蓝
        "#C0625F", // 石榴红
    )

    /** 旧色板 → 新色板。老用户存量数据里是旧 hex，不迁就会被 normalizeColor 全打回默认黄。 */
    val LEGACY_COLOR_MAP = mapOf(
        "#7BC96F" to "#A3B565",
        "#0FBCDB" to "#4E86A0",
        "#F48FB1" to "#C0625F",
    )

    /** 每支笔的铺色透明度（浅色 to 深色）：合成后亮度接近，谁也不比谁响 */
    private val FILL_ALPHA = mapOf(
        "#FFB103" to (0.45f to 0.28f),
        "#A3B565" to (0.50f to 0.28f),
        "#4E86A0" to (0.46f to 0.32f),
        "#C0625F" to (0.42f to 0.30f),
    )

    fun fillAlpha(raw: String, dark: Boolean): Float {
        val (light, night) = FILL_ALPHA[normalizeColor(raw)] ?: (0.45f to 0.28f)
        return if (dark) night else light
    }

    fun key(translationId: String, bookId: String, chapter: Int, verse: Int) = "$translationId:$bookId:$chapter:$verse"

    fun normalizeColor(raw: Any?): String {
        val s = (raw as? String)?.trim()?.uppercase() ?: return DEFAULT_COLOR
        if (s in PALETTE) return s
        return LEGACY_COLOR_MAP[s] ?: DEFAULT_COLOR
    }
}

class VerseHighlightStore(context: Context) {
    private val sp = context.getSharedPreferences("askbible", Context.MODE_PRIVATE)

    /** 键 → （字符下标 → 颜色） */
    var store by mutableStateOf<Map<String, Map<Int, String>>>(emptyMap())
        private set
    var verseTimestamps: Map<String, Long> = emptyMap()
        private set

    /** 本机改动通知（会员同步用） */
    var onLocalChange: ((String) -> Unit)? = null
    var suppressChangeNotify = false

    /** 本机最后一次划/擦的时间（ms），0 = 从未改过；同步 blob 的 updatedAt 用它，擦空也要上传 */
    var localUpdatedAtMs: Long = 0L
        private set
    /** 本机改过、还没同步成功 */
    val dirty: Boolean get() = sp.getBoolean(DIRTY_KEY, false)
    fun markSynced() { sp.edit().putBoolean(DIRTY_KEY, false).apply() }

    init {
        localUpdatedAtMs = sp.getLong(UPDATED_KEY, 0L)
        val loaded = parse(sp.getString(VerseHighlightRules.STORAGE_KEY, null))
        store = loaded
        verseTimestamps = parseTimestamps(sp.getString(VerseHighlightRules.TIMESTAMPS_STORAGE_KEY, null), loaded)
    }

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
        val nowMs = System.currentTimeMillis()
        store = next
        verseTimestamps = pruneTimestamps(verseTimestamps + (key to nowMs), next, nowMs)
        localUpdatedAtMs = nowMs
        sp.edit().putLong(UPDATED_KEY, localUpdatedAtMs).putBoolean(DIRTY_KEY, true).apply()
        persist()
    }

    fun clear(translationId: String, bookId: String, chapter: Int, verse: Int) {
        val key = VerseHighlightRules.key(translationId, bookId, chapter, verse)
        val next = HashMap(store)
        next.remove(key)
        val nowMs = System.currentTimeMillis()
        store = next
        verseTimestamps = pruneTimestamps(verseTimestamps + (key to nowMs), next, nowMs)
        localUpdatedAtMs = nowMs
        sp.edit().putLong(UPDATED_KEY, localUpdatedAtMs).putBoolean(DIRTY_KEY, true).apply()
        persist()
    }

    /** 云端并入（会员同步 highlights blob） */
    fun replace(next: Map<String, Map<Int, String>>, updatedAtMs: Long) {
        store = next
        verseTimestamps = pruneTimestamps(verseTimestamps, next)
        if (updatedAtMs > localUpdatedAtMs) { localUpdatedAtMs = updatedAtMs; sp.edit().putLong(UPDATED_KEY, updatedAtMs).apply() }
        persist(notify = false)
    }

    /** 云端并入（含 `_t` 节级时间戳与擦除墓碑） */
    fun replace(o: JSONObject, updatedAtMs: Long) {
        val nowMs = System.currentTimeMillis()
        val next = parse(o)
        val remoteTs = extractTimestamps(o, next, nowMs)
        val mergedTs = HashMap(verseTimestamps)
        for ((k, ts) in remoteTs) {
            mergedTs[k] = maxOf(mergedTs[k] ?: 0L, ts)
        }
        store = next
        verseTimestamps = pruneTimestamps(mergedTs, next, nowMs)
        if (updatedAtMs > localUpdatedAtMs) { localUpdatedAtMs = updatedAtMs; sp.edit().putLong(UPDATED_KEY, updatedAtMs).apply() }
        persist(notify = false)
    }

    fun clearForAccountSwitch() {
        store = emptyMap()
        verseTimestamps = emptyMap()
        localUpdatedAtMs = 0L
        sp.edit().remove(UPDATED_KEY).remove(DIRTY_KEY).remove(VerseHighlightRules.TIMESTAMPS_STORAGE_KEY).apply()
        persist(notify = false)
    }

    private fun storeJson(): JSONObject {
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

    /** 同步用：`{"译本:卷:章:节": [{i, c}], "_t": {"译本:卷:章:节": tsMs}}` */
    fun json(): JSONObject {
        val out = storeJson()
        val prunedTs = pruneTimestamps(verseTimestamps, store)
        if (prunedTs.isNotEmpty()) {
            val tObj = JSONObject()
            for ((k, ts) in prunedTs) tObj.put(k, ts)
            out.put("_t", tObj)
        }
        return out
    }

    private fun persist(notify: Boolean = true) {
        val tsObj = JSONObject()
        for ((k, ts) in verseTimestamps) tsObj.put(k, ts)
        sp.edit()
            .putString(VerseHighlightRules.STORAGE_KEY, storeJson().toString())
            .putString(VerseHighlightRules.TIMESTAMPS_STORAGE_KEY, tsObj.toString())
            .apply()
        if (notify && !suppressChangeNotify) onLocalChange?.invoke("highlights")
    }

    companion object {
        private const val UPDATED_KEY = "askbible-read-verse-text-highlights-updated-at"
        private const val DIRTY_KEY = "askbible-read-verse-text-highlights-dirty"

        fun pruneTimestamps(
            ts: Map<String, Long>,
            liveStore: Map<String, Map<Int, String>>,
            nowMs: Long = System.currentTimeMillis(),
        ): Map<String, Long> {
            val out = HashMap<String, Long>()
            for ((k, v) in ts) {
                if (k == "_t" || v <= 0L) continue
                val isLive = liveStore[k]?.isNotEmpty() == true
                if (isLive || nowMs - v <= VerseHighlightRules.TOMBSTONE_TTL_MS) {
                    out[k] = v
                }
            }
            return out
        }

        fun parseTimestamps(
            raw: String?,
            liveStore: Map<String, Map<Int, String>>,
            nowMs: Long = System.currentTimeMillis(),
        ): Map<String, Long> {
            if (raw.isNullOrEmpty()) return emptyMap()
            val obj = runCatching { JSONObject(raw) }.getOrNull() ?: return emptyMap()
            val out = HashMap<String, Long>()
            val keys = obj.keys()
            while (keys.hasNext()) {
                val k = keys.next()
                if (k == "_t") continue
                val v = MemberReadingSyncRules.num(obj.opt(k))?.toLong() ?: continue
                if (v > 0L) out[k] = v
            }
            return pruneTimestamps(out, liveStore, nowMs)
        }

        fun extractTimestamps(
            o: JSONObject,
            liveStore: Map<String, Map<Int, String>>,
            nowMs: Long = System.currentTimeMillis(),
        ): Map<String, Long> {
            val tObj = o.optJSONObject("_t") ?: return emptyMap()
            val out = HashMap<String, Long>()
            val keys = tObj.keys()
            while (keys.hasNext()) {
                val k = keys.next()
                if (k == "_t") continue
                val v = MemberReadingSyncRules.num(tObj.opt(k))?.toLong() ?: continue
                if (v > 0L) out[k] = v
            }
            return pruneTimestamps(out, liveStore, nowMs)
        }

        fun parse(raw: String?): Map<String, Map<Int, String>> {
            if (raw.isNullOrEmpty()) return emptyMap()
            return parse(runCatching { JSONObject(raw) }.getOrNull() ?: return emptyMap())
        }

        fun parse(o: JSONObject): Map<String, Map<Int, String>> {
            val out = HashMap<String, Map<Int, String>>()
            val keys = o.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                if (key == "_t") continue
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
