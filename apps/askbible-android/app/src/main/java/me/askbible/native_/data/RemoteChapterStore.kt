package me.askbible.native_.data

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * 在线译本（YouVersion）逐章正文：设备直抓 bible.com 公开章节页，解析与 RN `lib/bible/youversion-chapter-page.ts` 同一套
 * （先试 flight 载荷、再试转义嵌入、再试整页、最后 __NEXT_DATA__；三种节标记正则；去脚注 / 交叉引用；垃圾文本判定）。
 * 抓到后落盘 cacheDir/remote-chapters/<译本>/<BOOK>.<章>.json，下次离线可读。不经 askbible.me（RN 同样如此）。与 iOS 的 RemoteChapterStore 对等。
 */
object RemoteChapterStore {
    data class Row(val verse: Int, val text: String)

    private val memory = HashMap<String, List<Row>>()

    suspend fun load(context: Context, t: ScriptureTranslation, bookId: String, chapter: Int): List<Row>? = withContext(Dispatchers.IO) {
        val book = bookId.uppercase()
        val key = "${t.id}:$book:$chapter"
        synchronized(memory) { memory[key] }?.let { return@withContext it }
        readDisk(context, t.id, book, chapter)?.let { synchronized(memory) { memory[key] = it }; return@withContext it }
        for (url in pageUrls(t, book, chapter)) {
            val html = fetchHtml(url) ?: continue
            val rows = YouVersionPage.parse(html)
            if (rows.isNotEmpty()) {
                synchronized(memory) { memory[key] = rows }
                writeDisk(context, t.id, book, chapter, rows)
                return@withContext rows
            }
        }
        null
    }

    /** 已缓存过的章（同步 peek） */
    fun cached(context: Context, translationId: String, bookId: String, chapter: Int): List<Row>? = readDisk(context, translationId, bookId.uppercase(), chapter)

    /** RN buildYouVersionChapterPageUrls：先音频章页（同样带经文），再文字页（带缩写 / 不带），各带语言前缀变体 */
    fun pageUrls(t: ScriptureTranslation, book: String, chapter: Int): List<String> {
        if (t.remoteId.isEmpty() || chapter < 1) return emptyList()
        val urls = ArrayList<String>()
        fun push(u: String) { if (u.isNotEmpty() && u !in urls) urls.add(u) }
        fun withLocales(u: String) {
            push(u)
            if (t.pageLocale.isNotEmpty()) push(u.replace("https://www.bible.com/", "https://www.bible.com/${t.pageLocale}/"))
        }
        if (t.abbreviation.isNotEmpty()) withLocales("https://www.bible.com/audio-bible/${t.remoteId}/$book.$chapter.${t.abbreviation}")
        val base = "https://www.bible.com/bible/${t.remoteId}/$book.$chapter"
        if (t.abbreviation.isNotEmpty()) withLocales("$base.${t.abbreviation}")
        withLocales(base)
        return urls
    }

    /** RN fetchYouVersionChapterPageHtml：先不带 UA，太短再带浏览器 UA */
    fun fetchHtml(url: String): String? {
        val base = mapOf("Accept" to "text/html,application/xhtml+xml,*/*;q=0.8", "Accept-Language" to "zh-TW,zh-CN,zh;q=0.9,en;q=0.8")
        val first = fetchOnce(url, base)
        if (first != null && first.length > 4_000) return first
        val second = fetchOnce(url, base + ("User-Agent" to TranslationCatalog.BROWSER_USER_AGENT))
        return second ?: first
    }

    private fun fetchOnce(url: String, headers: Map<String, String>): String? {
        return try {
            val conn = URL(url).openConnection() as HttpURLConnection
            conn.connectTimeout = 20_000; conn.readTimeout = 20_000
            conn.instanceFollowRedirects = true
            for ((k, v) in headers) conn.setRequestProperty(k, v)
            try {
                if (conn.responseCode !in 200..299) return null
                val text = conn.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
                text.takeIf { it.isNotBlank() }
            } finally { conn.disconnect() }
        } catch (_: Exception) { null }
    }

    private fun file(context: Context, id: String, book: String, chapter: Int) = File(File(File(context.cacheDir, "remote-chapters"), id), "$book.$chapter.json")

    private fun readDisk(context: Context, id: String, book: String, chapter: Int): List<Row>? = try {
        val f = file(context, id, book, chapter)
        if (!f.exists()) null else {
            val arr = JSONArray(f.readText())
            List(arr.length()) { i -> val o = arr.getJSONObject(i); Row(o.getInt("verse"), o.getString("text")) }.takeIf { it.isNotEmpty() }
        }
    } catch (_: Exception) { null }

    private fun writeDisk(context: Context, id: String, book: String, chapter: Int, rows: List<Row>) {
        try {
            val f = file(context, id, book, chapter); f.parentFile?.mkdirs()
            val arr = JSONArray(); for (r in rows) arr.put(JSONObject().put("verse", r.verse).put("text", r.text))
            f.writeText(arr.toString())
        } catch (_: Exception) { }
    }
}

/** bible.com 章节页解析（RN youversion-chapter-page.ts 的纯函数部分，逐段照搬） */
object YouVersionPage {
    private val CI = setOf(RegexOption.IGNORE_CASE)

    fun parse(html: String): List<RemoteChapterStore.Row> {
        if (html.isBlank()) return emptyList()
        for (payload in flightPayloads(html)) {
            if (!payload.contains("verse") || !payload.contains("data-usfm")) continue
            val rows = parseContent(truncateRscTail(payload))
            if (usable(rows)) return rows
        }
        if (html.contains("class=\\\"verse") || html.contains("data-usfm=\\")) {
            val loosened = html.replace("\\\"", "\"").replace("\\n", "\n")
                .replace(Regex("\\\\u003c", CI), "<").replace(Regex("\\\\u003e", CI), ">")
            val rows = parseContent(loosened)
            if (usable(rows)) return rows
        }
        val direct = parseContent(html)
        if (usable(direct)) return direct
        val marker = "<script id=\"__NEXT_DATA__\" type=\"application/json\">"
        val start = html.indexOf(marker); if (start < 0) return emptyList()
        val end = html.indexOf("</script>", start + marker.length); if (end < 0) return emptyList()
        return try {
            val content = JSONObject(html.substring(start + marker.length, end))
                .optJSONObject("props")?.optJSONObject("pageProps")?.optJSONObject("chapterInfo")?.optString("content") ?: return emptyList()
            val rows = parseContent(content)
            if (usable(rows)) rows else emptyList()
        } catch (_: Exception) { emptyList() }
    }

    /** RN extractYouVersionFlightPayloads：按 push 标记切片、逐个 JSON 解析字符串字面量 */
    fun flightPayloads(html: String): List<String> {
        val payloads = ArrayList<String>()
        val marker = "self.__next_f.push([1,"
        var from = 0
        while (from < html.length) {
            val start = html.indexOf(marker, from); if (start < 0) break
            val quoteAt = start + marker.length
            if (quoteAt >= html.length || html[quoteAt] != '"') { from = quoteAt; continue }
            var i = quoteAt + 1
            var escaped = false
            while (i < html.length) {
                val ch = html[i]
                if (escaped) { escaped = false; i += 1; continue }
                if (ch == '\\') { escaped = true; i += 1; continue }
                if (ch == '"') break
                i += 1
            }
            if (i >= html.length || html[i] != '"') { from = quoteAt + 1; continue }
            val literal = html.substring(quoteAt, i + 1)
            try {
                val payload = JSONArray("[$literal]").optString(0)
                if (payload.isNotEmpty()) payloads.add(payload)
            } catch (_: Exception) { }
            from = i + 1
        }
        return payloads
    }

    private val patterns = listOf(
        Regex("<span class=\"verse v(\\d+)\"[^>]*data-usfm=\"[^\"]+\">", CI),
        Regex("<(?:span|div)[^>]*data-usfm=\"[A-Z0-9]+\\.\\d+\\.(\\d+)\"[^>]*class=\"[^\"]*verse[^\"]*\"[^>]*>", CI),
        Regex("<(?:span|div)[^>]*class=\"[^\"]*verse[^\"]*\"[^>]*data-usfm=\"[A-Z0-9]+\\.\\d+\\.(\\d+)\"[^>]*>", CI),
    )

    fun parseContent(html: String): List<RemoteChapterStore.Row> {
        for (p in patterns) {
            val rows = collect(html, p)
            if (rows.isNotEmpty()) return rows
        }
        return emptyList()
    }

    private fun collect(source: String, verseStart: Regex): List<RemoteChapterStore.Row> {
        val clipped = truncateRscTail(source)
        val starts = verseStart.findAll(clipped).mapNotNull { m -> m.groupValues[1].toIntOrNull()?.takeIf { it >= 1 }?.let { it to m.range.first } }.toList()
        if (starts.isEmpty()) return emptyList()
        val rows = ArrayList<RemoteChapterStore.Row>()
        for ((i, start) in starts.withIndex()) {
            val end = if (i + 1 < starts.size) starts[i + 1].second else clipped.length
            val block = clipped.substring(start.second, end)
            var text = plainText(block)
            text = text.replace(Regex("^\\s*${start.first}\\s*"), "").trim()
            if (text.isEmpty() || garbage(text)) continue
            val hitIdx = rows.indexOfFirst { it.verse == start.first }
            if (hitIdx >= 0) {
                val hit = rows[hitIdx]
                if (!hit.text.contains(text)) rows[hitIdx] = RemoteChapterStore.Row(hit.verse, collapse(hit.text + " " + text))
                continue
            }
            rows.add(RemoteChapterStore.Row(start.first, text))
        }
        return rows.sortedBy { it.verse }
    }

    private val contentRe = Regex("<(?:span|div)[^>]*class=\"[^\"]*(?:__content|_content|\\bcontent\\b)[^\"]*\"[^>]*>([\\s\\S]*?)</(?:span|div)>", CI)

    /** RN extractYouVersionVersePlainText */
    private fun plainText(block: String): String {
        val withoutNotes = stripNoteNodes(truncateRscTail(block))
        val chunks = contentRe.findAll(withoutNotes).map { collapse(decodeEntities(stripHtml(it.groupValues[1]))) }.filter { it.isNotEmpty() }.toList()
        var text = if (chunks.isNotEmpty()) chunks.joinToString(" ") else decodeEntities(stripHtml(withoutNotes))
        text = collapse(text)
        text = text.replace(Regex("#(?:ver|ch|vv?)\\.\\s*\\d+(?:\\s*[-–]\\s*\\d+)?", CI), " ")
            .replace(Regex("#[A-Z][a-z]{0,4}\\.?\\s*\\d+:\\d+(?:\\s*[-–]\\s*\\d+)?"), " ")
            .replace(Regex("\\b\\d+:Tb\\d+,?", CI), " ")
        return collapse(text)
    }

    private fun collapse(s: String) = s.replace(Regex("\\s+"), " ").trim()

    private val noteRe = Regex("<(span|div)[^>]*class=\"[^\"]*(?:__note|\\bnote\\b|__x\\b)[^\"]*\"[^>]*>[\\s\\S]*?</\\1>", CI)

    /** RN stripYouVersionNoteNodes */
    fun stripNoteNodes(raw: String): String {
        var source = raw
        repeat(40) {
            val next = noteRe.replace(source, "")
            if (next == source) return source
            source = next
        }
        return source
    }

    fun stripHtml(raw: String): String = raw
        .replace(Regex("<\\s*br\\s*/?\\s*>", CI), "\n")
        .replace(Regex("</(p|div|section|article|header|footer|h[1-6]|li|tr|table)>", CI), "\n")
        .replace(Regex("<[^>]+>"), "")
        .replace("\r", "")
        .replace(Regex("[ \\t]+\\n"), "\n")
        .replace(Regex("\\n{3,}"), "\n\n")
        .trim()

    fun decodeEntities(raw: String): String {
        var s = raw
        for ((from, to) in listOf("&nbsp;" to " ", "&amp;" to "&", "&lt;" to "<", "&gt;" to ">", "&quot;" to "\"", "&#39;" to "'")) s = s.replace(from, to, ignoreCase = true)
        s = Regex("&#(\\d+);").replace(s) { m -> m.groupValues[1].toIntOrNull()?.let { runCatching { String(Character.toChars(it)) }.getOrNull() } ?: m.value }
        s = Regex("&#x([0-9a-f]+);", CI).replace(s) { m -> m.groupValues[1].toIntOrNull(16)?.let { runCatching { String(Character.toChars(it)) }.getOrNull() } ?: m.value }
        return s
    }

    private val tailMarkers = listOf(
        Regex("\\d+:\\[\"\\$\""), Regex("\\[\"\\$\",\"\\\$L"), Regex("\\[\"\\$\",\"meta\""), Regex("\\[\"\\$\",\"link\""),
        Regex("\"analyticsUsfmRef\""), Regex("\"pageProps\""), Regex("\"audioVersionInfo\""), Regex("self\\.__next_f"),
    )

    /** RN truncateYouVersionRscTail */
    fun truncateRscTail(raw: String): String {
        if (raw.isEmpty()) return ""
        var cut = raw.length
        for (re in tailMarkers) {
            val m = re.find(raw) ?: continue
            if (m.range.first >= 40 && m.range.first < cut) cut = m.range.first
        }
        return raw.substring(0, cut)
    }

    private val bibleComRe = Regex("https?://www\\.bible\\.com/", CI)

    /** RN looksLikeYouVersionGarbageText */
    fun garbage(text: String): Boolean {
        if (text.isEmpty()) return true
        if (text.contains("[\"$,\"") || text.contains("[\"$\",\"")) return true
        if (text.contains("analyticsUsfmRef") || text.contains("pageProps")) return true
        if (text.contains("self.__next_f") || text.contains("fb:app_id")) return true
        if (text.contains("youversionapi.com") || text.contains("web-assets.youversion.com")) return true
        if (bibleComRe.containsMatchIn(text) && text.length > 180) return true
        if (text.length > 2800 && Regex("[\\[{]").containsMatchIn(text)) return true
        return false
    }

    fun usable(rows: List<RemoteChapterStore.Row>) = rows.isNotEmpty() && rows.none { garbage(it.text) }
}
