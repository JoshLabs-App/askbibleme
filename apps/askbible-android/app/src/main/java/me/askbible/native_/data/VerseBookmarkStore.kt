package me.askbible.native_.data

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/** 收藏与搜索偏好的落盘（SharedPreferences，键与 RN AsyncStorage 同名）；规则在 core 的 ScriptureSearchRules.kt。与 iOS 的 VerseBookmarkStore / SearchPrefs 对等。 */
class VerseBookmarkStore(context: Context) {
    private val sp = context.applicationContext.getSharedPreferences("verse-bookmarks", Context.MODE_PRIVATE)
    var store by mutableStateOf(VerseBookmarkRules.parse(sp.getString(VerseBookmarkRules.STORAGE_KEY, null)))
        private set

    val list: List<VerseBookmark> get() = VerseBookmarkRules.list(store)
    /** 本机改动通知（会员同步） */
    var onLocalChange: (() -> Unit)? = null
    /** 序列化成 RN 同形的 JSON 对象（同步 blob） */
    val json: org.json.JSONObject get() = try { org.json.JSONObject(VerseBookmarkRules.serialize(store)) } catch (_: Exception) { org.json.JSONObject() }
    /** 云端书签落本机（RN replaceScriptureVerseBookmarkStore） */
    fun replace(json: org.json.JSONObject) {
        store = VerseBookmarkRules.parse(json.toString())
        sp.edit().putString(VerseBookmarkRules.STORAGE_KEY, VerseBookmarkRules.serialize(store)).apply()
    }
    fun clearForAccountSwitch() { store = emptyMap(); sp.edit().remove(VerseBookmarkRules.STORAGE_KEY).apply() }

    fun isBookmarked(translationId: String, bookId: String, chapter: Int, verse: Int) =
        store.containsKey(VerseBookmarkRules.key(translationId, bookId, chapter, verse))

    fun bookmarkedVerses(translationId: String, bookId: String, chapter: Int): Set<Int> =
        store.values.filter { it.translationId == translationId && it.bookId == bookId && it.chapter == chapter }.map { it.verse }.toSet()

    /** toggleScriptureVerseBookmark：有则删，无则加；返回是否为新加 */
    fun toggle(bookId: String, bookName: String, chapter: Int, verse: Int, translationId: String, text: String): Boolean {
        val key = VerseBookmarkRules.key(translationId, bookId, chapter, verse)
        val next = LinkedHashMap(store)
        val added = if (next.containsKey(key)) { next.remove(key); false } else {
            next[key] = VerseBookmark(bookId, bookName, chapter, verse, translationId, text, System.currentTimeMillis().toDouble()); true
        }
        store = next
        sp.edit().putString(VerseBookmarkRules.STORAGE_KEY, VerseBookmarkRules.serialize(next)).apply()
        onLocalChange?.invoke()
        return added
    }
}

class SearchPrefs(context: Context) {
    companion object {
        const val RECENT_KEY = "askbible-mobile-scripture-recent-searches-v1"
        const val SCOPE_KEY = "askbible-mobile-scripture-search-scope-v1"
    }
    private val sp = context.applicationContext.getSharedPreferences("scripture-search", Context.MODE_PRIVATE)
    var recent by mutableStateOf(readRecent())
        private set
    var scope by mutableStateOf(ScriptureSearchScope.parse(sp.getString(SCOPE_KEY, null)))
        private set

    private fun readRecent(): List<String> {
        val raw = sp.getString(RECENT_KEY, null) ?: return emptyList()
        val terms = ArrayList<String>()
        runCatching {
            val tok = org.json.JSONTokener(raw).nextValue()
            val arr = when (tok) {
                is org.json.JSONArray -> tok
                is org.json.JSONObject -> if (tok.optInt("version") == 1) tok.optJSONArray("terms") else null
                else -> null
            }
            if (arr != null) for (i in 0 until arr.length()) arr.optString(i)?.let { terms.add(it) }
        }
        return RecentSearchRules.normalizeTerms(terms)
    }

    /** 不能叫 setScope：与 `var scope` 的 setter 在 JVM 上撞签名 */
    fun updateScope(next: ScriptureSearchScope) { scope = next; sp.edit().putString(SCOPE_KEY, next.raw).apply() }

    var onLocalChange: (() -> Unit)? = null
    fun push(raw: String) {
        val next = RecentSearchRules.push(raw, recent)
        if (next == recent) return
        recent = next
        persistRecent()
        onLocalChange?.invoke()
    }
    private fun persistRecent() {
        val obj = org.json.JSONObject().put("version", 1).put("terms", org.json.JSONArray(recent))
        sp.edit().putString(RECENT_KEY, obj.toString()).apply()
    }
    /** 云端最近搜索落本机（RN replaceScriptureRecentSearches） */
    fun replaceRecent(terms: List<String>) { recent = RecentSearchRules.normalizeTerms(terms); persistRecent() }
    fun clearRecentForAccountSwitch() { recent = emptyList(); sp.edit().remove(RECENT_KEY).apply() }
}
