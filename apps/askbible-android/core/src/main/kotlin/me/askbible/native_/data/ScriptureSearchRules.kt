package me.askbible.native_.data

/** 经文搜索范围：全本 / 旧约 / 新约 / 本章（旧约 = 卷号 ≤ 39） */
enum class ScriptureSearchScope(val raw: String) {
    ALL("all"), OLD("old"), NEW("new"), CHAPTER("chapter");
    companion object { fun parse(raw: String?) = values().firstOrNull { it.raw == raw?.trim() } ?: ALL }
}

data class SearchChapterRef(val bookId: String, val chapter: Int)
data class ScriptureSearchHit(val bookId: String, val bookName: String, val chapter: Int, val verse: Int, val text: String)
/** 搜索结果：hits 最多 LIMIT 条，total 是实际命中总数（> hits.size 说明被截断了） */
data class ScriptureSearchResult(val hits: List<ScriptureSearchHit>, val total: Int) {
    companion object { val EMPTY = ScriptureSearchResult(emptyList(), 0) }
}
data class SearchTextSegment(val text: String, val match: Boolean)

/**
 * 经文搜索规则。逐条搬自 RN `src/bible/scripture-search.ts`，与 iOS 的 ScriptureSearchRules 对等，由 check:scripture-search 三端对拍：
 * 关键词 trim + 折叠空白；SQLite LIKE 转义；范围过滤；按关键词切段（大小写不敏感）供命中高亮。
 */
object ScriptureSearchRules {
    const val MIN_LENGTH = 1
    /** 一次最多列出的条数；总数另报（D-30，原来是 RN 的 40） */
    const val LIMIT = 500

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

/**
 * 智能经文出处解析器（零依赖纯 Kotlin，供 check:scripture-search 与 SearchScreen 直达卡共用）：
 * 支持「约 3:16」「约翰福音 3章16节」「诗 23」「创 1:1」「John 3:16」「Ps 23」「Rom 8:28」等写法。
 */
data class ParsedScriptureRef(val book: BookRef, val chapter: Int, val verse: Int?)

object ScriptureReferenceParser {
    private val zhShortAliases = listOf(
        "创" to "GEN", "出" to "EXO", "利" to "LEV", "民" to "NUM", "申" to "DEU",
        "书" to "JOS", "士" to "JDG", "得" to "RUT", "撒上" to "1SA", "撒下" to "2SA",
        "王上" to "1KI", "王下" to "2KI", "代上" to "1CH", "代下" to "2CH", "拉" to "EZR",
        "尼" to "NEH", "斯" to "EST", "伯" to "JOB", "诗" to "PSA", "诗篇" to "PSA",
        "箴" to "PRO", "传" to "ECC", "歌" to "SNG", "赛" to "ISA", "耶" to "JER",
        "哀" to "LAM", "结" to "EZK", "但" to "DAN", "何" to "HOS", "珥" to "JOL",
        "摩" to "AMO", "俄" to "OBA", "拿" to "JON", "弥" to "MIC", "鸿" to "NAM",
        "哈" to "HAB", "番" to "ZEP", "该" to "HAG", "亚" to "ZEC", "玛" to "MAL",
        "太" to "MAT", "可" to "MRK", "路" to "LUK", "约" to "JHN", "徒" to "ACT",
        "罗" to "ROM", "林前" to "1CO", "林后" to "2CO", "加" to "GAL", "弗" to "EPH",
        "腓" to "PHP", "西" to "COL", "帖前" to "1TH", "帖后" to "2TH", "提前" to "1TI",
        "提后" to "2TI", "多" to "TIT", "门" to "PHM", "来" to "HEB", "雅" to "JAS",
        "彼前" to "1PE", "彼后" to "2PE", "约一" to "1JN", "约二" to "2JN", "约三" to "3JN",
        "犹" to "JUD", "启" to "REV",
        "創" to "GEN", "詩" to "PSA", "詩篇" to "PSA", "傳" to "ECC", "約" to "JHN",
        "羅" to "ROM", "林後" to "2CO", "來" to "HEB", "啟" to "REV",
        "創世記" to "GEN", "出埃及記" to "EXO", "利未記" to "LEV", "民數記" to "NUM", "申命記" to "DEU",
        "馬太福音" to "MAT", "馬可福音" to "MRK", "路加福音" to "LUK", "約翰福音" to "JHN", "使徒行傳" to "ACT",
        "羅馬書" to "ROM", "哥林多前書" to "1CO", "哥林多後書" to "2CO", "以弗所書" to "EPH", "腓立比書" to "PHP",
        "希伯來書" to "HEB", "彼得前書" to "1PE", "彼得後書" to "2PE", "約翰一書" to "1JN", "啟示錄" to "REV",
    )

    private val enAliases = listOf(
        "gen" to "GEN", "ex" to "EXO", "exo" to "EXO", "lev" to "LEV", "num" to "NUM", "deut" to "DEU", "deu" to "DEU",
        "josh" to "JOS", "judg" to "JDG", "ruth" to "RUT", "1sam" to "1SA", "2sam" to "2SA",
        "1kgs" to "1KI", "2kgs" to "2KI", "1chr" to "1CH", "2chr" to "2CH", "ezra" to "EZR",
        "neh" to "NEH", "esth" to "EST", "job" to "JOB", "ps" to "PSA", "psa" to "PSA", "psalm" to "PSA",
        "prov" to "PRO", "pro" to "PRO", "eccl" to "ECC", "ecc" to "ECC", "song" to "SNG",
        "isa" to "ISA", "jer" to "JER", "lam" to "LAM", "ezek" to "EZK", "dan" to "DAN",
        "hos" to "HOS", "joel" to "JOL", "amos" to "AMO", "obad" to "OBA", "jonah" to "JON",
        "mic" to "MIC", "nah" to "NAM", "hab" to "HAB", "zeph" to "ZEP", "hag" to "HAG", "zech" to "ZEC", "mal" to "MAL",
        "matt" to "MAT", "mat" to "MAT", "mt" to "MAT", "mk" to "MRK", "mrk" to "MRK", "lk" to "LUK", "luk" to "LUK",
        "john" to "JHN", "jn" to "JHN", "jhn" to "JHN", "acts" to "ACT", "act" to "ACT",
        "rom" to "ROM", "1cor" to "1CO", "2cor" to "2CO", "gal" to "GAL", "eph" to "EPH",
        "phil" to "PHP", "php" to "PHP", "col" to "COL", "1thess" to "1TH", "2thess" to "2TH",
        "1tim" to "1TI", "2tim" to "2TI", "titus" to "TIT", "phlm" to "PHM", "heb" to "HEB",
        "jas" to "JAS", "1pet" to "1PE", "2pet" to "2PE", "1jn" to "1JN", "2jn" to "2JN", "3jn" to "3JN",
        "jude" to "JUD", "rev" to "REV",
    )

    private val pattern = Regex("^\\s*([1-3]?\\s*[A-Za-z\\u4e00-\\u9fff]+?)\\s*(?:第)?\\s*([0-9]{1,3})\\s*(?:章)?(?:\\s*[:：.篇节節\\s]\\s*([0-9]{1,3}))?\\s*(?:节|節)?\\s*$")

    fun parse(raw: String): ParsedScriptureRef? {
        val trimmed = raw.trim()
        if (trimmed.isEmpty()) return null
        val m = pattern.matchEntire(trimmed) ?: return null
        val rawBook = m.groupValues[1].trim()
        val ch = m.groupValues[2].toIntOrNull()?.takeIf { it >= 1 } ?: return null
        val vs = m.groupValues[3].takeIf { it.isNotEmpty() }?.toIntOrNull()
        if (vs != null && vs < 1) return null
        val book = matchBook(rawBook) ?: return null
        return ParsedScriptureRef(book, ch.coerceAtMost(book.chapterCount), vs)
    }

    private fun matchBook(token: String): BookRef? {
        val clean = token.replace(" ", "").lowercase()
        BibleCatalog.all.firstOrNull {
            it.nameZh == token ||
                it.nameEn.replace(" ", "").lowercase() == clean ||
                it.id.lowercase() == clean
        }?.let { return it }

        zhShortAliases.sortedByDescending { it.first.length }.firstOrNull { it.first == token }
            ?.let { BibleCatalog.book(it.second) }?.let { return it }

        enAliases.firstOrNull { it.first == clean }
            ?.let { BibleCatalog.book(it.second) }?.let { return it }

        if (clean.length >= 2) {
            BibleCatalog.all.firstOrNull {
                it.nameZh.startsWith(token) || it.nameEn.replace(" ", "").lowercase().startsWith(clean)
            }?.let { return it }
        }
        return null
    }
}

/** 最近搜索（RN scripture-recent-searches.ts）：去重（不分大小写）、最多 8 条、新的在前 */
object RecentSearchRules {
    const val MAX_ITEMS = 10

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
    const val TOMBSTONES_STORAGE_KEY = "askbible-scripture-verse-bookmark-tombstones-v1"
    const val TOMBSTONE_TTL_MS = 60L * 24L * 60L * 60L * 1000L

    fun key(translationId: String, bookId: String, chapter: Int, verse: Int) = "$translationId:$bookId:$chapter:$verse"

    /** parseScriptureVerseBookmarkStore：坏条目/墓碑跳过；bookId 大写；bookName 缺省用 bookId；savedAt 缺省用现在 */
    fun parse(raw: String?, now: Double = System.currentTimeMillis().toDouble()): Map<String, VerseBookmark> {
        if (raw.isNullOrBlank()) return emptyMap()
        val obj = runCatching { org.json.JSONObject(raw) }.getOrNull() ?: return emptyMap()
        val out = LinkedHashMap<String, VerseBookmark>()
        for (key in obj.keys()) {
            val item = obj.optJSONObject(key) ?: continue
            if (item.optBoolean("deleted", false)) continue
            val bookId0 = item.opt("bookId")?.toString()?.takeIf { it.isNotEmpty() && it != "null" } ?: continue
            val tid = item.opt("translationId")?.toString()?.takeIf { it.isNotEmpty() && it != "null" } ?: continue
            val chapter = (item.opt("chapter") as? Number)?.toInt() ?: continue
            val verse = (item.opt("verse") as? Number)?.toInt() ?: continue
            if (chapter < 1 || verse < 1) continue
            val bookName = item.optString("bookName").takeIf { it.isNotEmpty() } ?: bookId0
            val savedAt = if (item.opt("savedAt") is Number) (item.opt("savedAt") as Number).toDouble() else now
            out[key] = VerseBookmark(bookId0.trim().uppercase(), bookName, chapter, verse, tid, item.optString("text"), savedAt)
        }
        return out
    }

    fun pruneTombstones(
        tombstones: Map<String, Double>,
        nowMs: Double = System.currentTimeMillis().toDouble(),
    ): Map<String, Double> {
        val out = LinkedHashMap<String, Double>()
        for ((k, ts) in tombstones) {
            if (ts.isFinite() && ts > 0.0 && nowMs - ts <= TOMBSTONE_TTL_MS) {
                out[k] = ts
            }
        }
        return out
    }

    fun parseTombstones(
        raw: String?,
        nowMs: Double = System.currentTimeMillis().toDouble(),
    ): Map<String, Double> {
        if (raw.isNullOrBlank()) return emptyMap()
        val obj = runCatching { org.json.JSONObject(raw) }.getOrNull() ?: return emptyMap()
        val out = LinkedHashMap<String, Double>()
        for (key in obj.keys()) {
            val ts = (obj.opt(key) as? Number)?.toDouble() ?: continue
            if (ts.isFinite() && ts > 0.0 && nowMs - ts <= TOMBSTONE_TTL_MS) {
                out[key] = ts
            }
        }
        return out
    }

    fun extractTombstones(
        obj: org.json.JSONObject,
        nowMs: Double = System.currentTimeMillis().toDouble(),
    ): Map<String, Double> {
        val out = LinkedHashMap<String, Double>()
        for (key in obj.keys()) {
            val item = obj.optJSONObject(key) ?: continue
            if (!item.optBoolean("deleted", false)) continue
            val ts = (item.opt("deletedAt") as? Number)?.toDouble() ?: continue
            if (ts.isFinite() && ts > 0.0 && nowMs - ts <= TOMBSTONE_TTL_MS) {
                out[key] = ts
            }
        }
        return out
    }

    fun serializeTombstones(tombstones: Map<String, Double>): String {
        val obj = org.json.JSONObject()
        for ((k, ts) in tombstones) {
            obj.put(k, ts)
        }
        return obj.toString()
    }

    fun serializeForSync(
        store: Map<String, VerseBookmark>,
        tombstones: Map<String, Double>,
        nowMs: Double = System.currentTimeMillis().toDouble(),
    ): org.json.JSONObject {
        val obj = org.json.JSONObject()
        for ((k, b) in store) {
            obj.put(k, org.json.JSONObject().put("bookId", b.bookId).put("bookName", b.bookName).put("chapter", b.chapter)
                .put("verse", b.verse).put("translationId", b.translationId).put("text", b.text).put("savedAt", b.savedAt))
        }
        for ((k, ts) in pruneTombstones(tombstones, nowMs)) {
            if (store.containsKey(k)) continue
            obj.put(k, org.json.JSONObject().put("deleted", true).put("deletedAt", ts))
        }
        return obj
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
