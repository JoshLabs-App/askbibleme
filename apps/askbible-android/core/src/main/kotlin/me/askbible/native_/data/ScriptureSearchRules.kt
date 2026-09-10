package me.askbible.native_.data

/** 经文搜索范围：全本 / 旧约 / 新约 / 本章（旧约 = 卷号 ≤ 39） */
enum class ScriptureSearchScope(val raw: String) {
    ALL("all"), OLD("old"), NEW("new"), CHAPTER("chapter");
    companion object { fun parse(raw: String?) = values().firstOrNull { it.raw == raw?.trim() } ?: ALL }
}

data class SearchChapterRef(val bookId: String, val chapter: Int)
data class ScriptureSearchHit(val bookId: String, val bookName: String, val chapter: Int, val verse: Int, val text: String)
data class SearchTextSegment(val text: String, val match: Boolean)

/**
 * 经文搜索规则。逐条搬自 RN `src/bible/scripture-search.ts`，与 iOS 的 ScriptureSearchRules 对等，由 check:scripture-search 三端对拍：
 * 关键词 trim + 折叠空白；SQLite LIKE 转义；范围过滤；按关键词切段（大小写不敏感）供命中高亮。
 */
object ScriptureSearchRules {
    const val MIN_LENGTH = 1
    const val LIMIT = 40
    /** 旧约 / 新约范围先多取 120 条再按卷过滤（RN SCOPED_FETCH_LIMIT） */
    const val SCOPED_FETCH_LIMIT = 120

    fun normalize(raw: String): String = raw.trim().replace(Regex("\\s+"), " ")

    fun escapeLike(raw: String): String = raw.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")

    fun isBookInScope(bookId: String, scope: ScriptureSearchScope): Boolean = when (scope) {
        ScriptureSearchScope.ALL -> true
        ScriptureSearchScope.CHAPTER -> false
        else -> {
            val book = BibleCatalog.book(bookId) ?: return false
            val isOld = book.number <= BibleCatalog.OLD_TESTAMENT_MAX
            if (scope == ScriptureSearchScope.OLD) isOld else !isOld
        }
    }

    fun isVerseInScope(bookId: String, chapter: Int, scope: ScriptureSearchScope, ref: SearchChapterRef?): Boolean = when (scope) {
        ScriptureSearchScope.ALL -> true
        ScriptureSearchScope.CHAPTER -> ref != null && ref.bookId == bookId && ref.chapter == chapter
        else -> isBookInScope(bookId, scope)
    }

    fun split(text: String, keyword: String): List<SearchTextSegment> {
        val q = normalize(keyword)
        if (q.isEmpty()) return listOf(SearchTextSegment(text, false))
        val lowerText = text.lowercase(); val lowerQ = q.lowercase()
        val out = ArrayList<SearchTextSegment>()
        var cursor = 0
        while (cursor < text.length) {
            val idx = lowerText.indexOf(lowerQ, cursor)
            if (idx < 0) { out.add(SearchTextSegment(text.substring(cursor), false)); break }
            if (idx > cursor) out.add(SearchTextSegment(text.substring(cursor, idx), false))
            out.add(SearchTextSegment(text.substring(idx, idx + q.length), true))
            cursor = idx + q.length
        }
        return if (out.isEmpty()) listOf(SearchTextSegment(text, false)) else out
    }
}

/** 最近搜索（RN scripture-recent-searches.ts）：去重（不分大小写）、最多 8 条、新的在前 */
object RecentSearchRules {
    const val MAX_ITEMS = 8

    fun normalizeTerms(raw: List<String>): List<String> {
        val seen = HashSet<String>(); val out = ArrayList<String>()
        for (item in raw) {
            val term = ScriptureSearchRules.normalize(item)
            if (term.length < ScriptureSearchRules.MIN_LENGTH) continue
            val key = term.lowercase()
            if (!seen.add(key)) continue
            out.add(term)
            if (out.size >= MAX_ITEMS) break
        }
        return out
    }

    fun push(raw: String, terms: List<String>): List<String> {
        val normalized = ScriptureSearchRules.normalize(raw)
        if (normalized.length < ScriptureSearchRules.MIN_LENGTH) return terms
        return (listOf(normalized) + terms.filter { it.lowercase() != normalized.lowercase() }).take(MAX_ITEMS)
    }
}

/**
 * 收藏的经文。与 RN `scripture-verse-bookmark-store.ts` 同构：键「译本:书卷:章:节」，存 JSON，按收藏时间倒序列出。
 * 与 iOS 的 VerseBookmarkRules 对等。
 */
data class VerseBookmark(
    val bookId: String, val bookName: String, val chapter: Int, val verse: Int,
    val translationId: String, val text: String, val savedAt: Double,
) {
    val key: String get() = VerseBookmarkRules.key(translationId, bookId, chapter, verse)
}

object VerseBookmarkRules {
    const val STORAGE_KEY = "askbible-scripture-verse-bookmarks-v1"

    fun key(translationId: String, bookId: String, chapter: Int, verse: Int) = "$translationId:$bookId:$chapter:$verse"

    /** parseScriptureVerseBookmarkStore：坏条目跳过；bookId 大写；bookName 缺省用 bookId；savedAt 缺省用现在 */
    fun parse(raw: String?, now: Double = System.currentTimeMillis().toDouble()): Map<String, VerseBookmark> {
        if (raw.isNullOrBlank()) return emptyMap()
        val obj = runCatching { org.json.JSONObject(raw) }.getOrNull() ?: return emptyMap()
        val out = LinkedHashMap<String, VerseBookmark>()
        for (key in obj.keys()) {
            val item = obj.optJSONObject(key) ?: continue
            val bookId0 = item.opt("bookId")?.toString()?.takeIf { it.isNotEmpty() && it != "null" } ?: continue
            val tid = item.opt("translationId")?.toString()?.takeIf { it.isNotEmpty() && it != "null" } ?: continue
            val chapter = item.opt("chapter") as? Int ?: continue
            val verse = item.opt("verse") as? Int ?: continue
            if (chapter < 1 || verse < 1) continue
            val bookName = item.optString("bookName").takeIf { it.isNotEmpty() } ?: bookId0
            val savedAt = if (item.opt("savedAt") is Number) (item.opt("savedAt") as Number).toDouble() else now
            out[key] = VerseBookmark(bookId0.trim().uppercase(), bookName, chapter, verse, tid, item.optString("text"), savedAt)
        }
        return out
    }

    fun serialize(store: Map<String, VerseBookmark>): String {
        val obj = org.json.JSONObject()
        for ((k, b) in store) {
            obj.put(k, org.json.JSONObject().put("bookId", b.bookId).put("bookName", b.bookName).put("chapter", b.chapter)
                .put("verse", b.verse).put("translationId", b.translationId).put("text", b.text).put("savedAt", b.savedAt))
        }
        return obj.toString()
    }

    /** listScriptureVerseBookmarks：新的在前 */
    fun list(store: Map<String, VerseBookmark>): List<VerseBookmark> = store.values.sortedByDescending { it.savedAt }
}
