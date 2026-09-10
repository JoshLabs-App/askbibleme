package me.askbible.parity

import me.askbible.native_.data.RecentSearchRules
import me.askbible.native_.data.ScriptureSearchRules
import me.askbible.native_.data.ScriptureSearchScope
import me.askbible.native_.data.SearchChapterRef
import me.askbible.native_.data.TranslationPrefsRules
import me.askbible.native_.data.VerseBookmarkRules

/** 经文搜索 / 收藏规则对拍 harness（core --scripture-search），协议与 Swift 侧相同 */
fun scriptureSearchMain() {
    val lines = generateSequence(::readLine).filter { it.isNotEmpty() }.toList()
    fun strList(json: String): List<String> {
        val arr = org.json.JSONArray(json); return List(arr.length()) { arr.getString(it) }
    }
    fun strArray(list: List<String>) = "[" + list.joinToString(",") { jsonString(it) } + "]"
    val out = ArrayList<String>()
    for (line in lines) {
        val f = line.split("\t")
        out.add(when (f[0]) {
            "norm" -> ScriptureSearchRules.normalize(f[1])
            "esc" -> ScriptureSearchRules.escapeLike(f[1])
            "scope" -> {
                val ref = if (f[4].isEmpty()) null else SearchChapterRef(f[4], f[5].toIntOrNull() ?: 0)
                if (ScriptureSearchRules.isVerseInScope(f[1], f[2].toIntOrNull() ?: 0, ScriptureSearchScope.parse(f[3]), ref)) "1" else "0"
            }
            "split" -> "[" + ScriptureSearchRules.split(f[1], f[2]).joinToString(",") { "{\"match\":${it.match},\"text\":${jsonString(it.text)}}" } + "]"
            "recent" -> strArray(RecentSearchRules.normalizeTerms(RecentSearchRules.push(f[2], strList(f[1]))))
            "recentnorm" -> strArray(RecentSearchRules.normalizeTerms(strList(f[1])))
            "bmkey" -> VerseBookmarkRules.key(f[1], f[2], f[3].toIntOrNull() ?: 0, f[4].toIntOrNull() ?: 0)
            "bmparse" -> {
                val store = VerseBookmarkRules.parse(if (f.size > 1 && f[1].isNotEmpty()) f[1] else null, now = 1.0)
                "{" + store.keys.sorted().joinToString(",") { k ->
                    val b = store.getValue(k)
                    jsonString(k) + ":{\"bookId\":${jsonString(b.bookId)},\"bookName\":${jsonString(b.bookName)},\"chapter\":${b.chapter}," +
                        "\"savedAtSet\":true,\"text\":${jsonString(b.text)},\"translationId\":${jsonString(b.translationId)},\"verse\":${b.verse}}"
                } + "}"
            }
            "tpparse" -> {
                val stored = TranslationPrefsRules.parse(if (f[1].isEmpty()) null else f[1], f[2].split(","), f[3])
                "{\"primary\":${jsonString(stored.primaryId)},\"secondary\":${stored.secondaryId?.let { jsonString(it) } ?: "null"}}"
            }
            "tpser" -> TranslationPrefsRules.serialize(f[1], if (f[2].isEmpty()) null else f[2])
            else -> "skip"
        })
    }
    print("[" + out.joinToString(",") { jsonString(it) } + "]")
}
