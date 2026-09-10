package me.askbible.native_.data

import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * 全量在线译本目录：网站 `/api/mobile/bible/youversion/catalog`（服务端拿 YouVersion 官方平台接口，带密钥）。
 *
 * 内置 / 下载型那 20 本仍以 [TranslationCatalog.entries] 为准（离线可用、带朗读与下载信息），
 * 这里只补「多出来的」几百本（各语种，纯在线、正文逐章取）。落盘 cacheDir/translations-catalog.json，
 * 冷启动先读盘（所以记住的译本一进来就认得），再后台按 TTL 刷新。与 iOS 的 RemoteTranslations 对等。
 * Josh 2026-09-10：「YouVersion 里有的版本全放开来，不需要人为去选」。
 */
object RemoteTranslations {
    const val CATALOG_ENDPOINT = "https://askbible.me/api/mobile/bible/youversion/catalog"
    const val CHAPTER_ENDPOINT = "https://askbible.me/api/mobile/bible/youversion/chapter"
    /** 一天刷一次（目录很少变） */
    const val TTL_MS = 24L * 3600 * 1000

    data class Entry(
        val translation: ScriptureTranslation,
        val languageNameZh: String,
        val languageNameEn: String,
        val copyright: String,
    )

    private val lock = Any()
    @Volatile private var cacheFile: File? = null
    @Volatile private var entries: List<Entry> = emptyList()
    @Volatile private var extrasCache: List<ScriptureTranslation> = emptyList()
    /** 目录内容变一次 +1：ScriptureTranslation 的合并表 / id 索引据此失效重建 */
    @Volatile var revision = 0; private set

    /** 壳启动时接上缓存目录并读盘（同步；TSV 很快，见 writeDisk 的说明） */
    fun attach(cacheDir: File) {
        val f = File(cacheDir, "translations-catalog.tsv")
        cacheFile = f
        if (entries.isEmpty() && f.exists()) {
            val parsed = runCatching { readDisk(f) }.getOrNull().orEmpty()
            if (parsed.isNotEmpty()) replace(parsed)
        }
    }

    /** 换一批目录（内存 + 派生缓存 + 版本号一起更新） */
    private fun replace(next: List<Entry>) {
        synchronized(lock) {
            entries = next
            extrasCache = next.map { it.translation }
            revision += 1
        }
    }

    /** 内置目录之外的在线译本。缓存成 List，别每次访问都 map 一遍几百条 */
    val extras: List<ScriptureTranslation> get() = extrasCache

    /** 语言码 → 显示名（按界面语言）；目录里没有返回 null */
    fun languageName(tag: String, locale: AppLocale): String? {
        val key = tag.lowercase()
        val hit = entries.firstOrNull { it.translation.language.lowercase() == key } ?: return null
        val name = if (locale == AppLocale.EN) hit.languageNameEn else hit.languageNameZh
        return if (name.isEmpty()) null else if (locale == AppLocale.EN) name else locale.zh(name)
    }

    /**
     * 版权 / 来源声明（YouVersion 条款要求展示）：目录给了版权文本就用它，否则「版本名 · 经文由 YouVersion 提供」；
     * 内置译本不是 YouVersion 来的，返回 null
     */
    fun attribution(translationId: String, locale: AppLocale = AppLocale.current): String? {
        val hit = entries.firstOrNull { it.translation.id == translationId } ?: return null
        if (hit.copyright.isNotEmpty()) return hit.copyright
        return SiteCopy.f("native.remoteTextAttribution", mapOf("name" to hit.translation.label(locale)), locale)
    }

    /** 盘里过期了才走网；成功返回 true（壳据此刷新目录相关 UI）。在 IO 线程调 */
    fun refresh(force: Boolean = false): Boolean {
        val f = cacheFile
        if (!force && f != null && f.exists() && System.currentTimeMillis() - f.lastModified() < TTL_MS) return false
        val text = try {
            val conn = URL(CATALOG_ENDPOINT).openConnection() as HttpURLConnection
            // 服务端冷启动要现拉一次 YouVersion 目录，给足时间（拉到就缓存一天）
            conn.connectTimeout = 30_000; conn.readTimeout = 90_000
            conn.setRequestProperty("Accept", "application/json")
            try {
                if (conn.responseCode != 200) return false
                conn.inputStream.bufferedReader().use { it.readText() }
            } finally { conn.disconnect() }
        } catch (_: Exception) { return false }
        val parsed = runCatching { parse(text) }.getOrNull().orEmpty()
        if (parsed.isEmpty()) return false
        replace(parsed)
        runCatching { f?.let { writeDisk(it, parsed) } }
        return true
    }

    /** org.json 的 optString 碰到 JSON null 会给出字符串 "null"，一律走这里取字符串 */
    private fun str(o: JSONObject, key: String): String = if (o.isNull(key)) "" else o.optString(key).trim()

    /** 目录 JSON → 条目（内置目录已有的 YouVersion 版本号跳过，避免同一本出现两次） */
    fun parse(text: String): List<Entry> {
        val list = JSONObject(text).optJSONArray("translations") ?: return emptyList()
        val taken = TranslationCatalog.entries.map { it.remoteId }.filter { it.isNotEmpty() }.toHashSet()
        val out = ArrayList<Entry>(list.length())
        val seen = HashSet<String>()
        for (i in 0 until list.length()) {
            val item = list.optJSONObject(i) ?: continue
            val remoteId = str(item, "remoteId").ifEmpty { str(item, "id") }
            val language = str(item, "language")
            val labelEn = str(item, "labelEn")
            val labelZh = str(item, "labelZh")
            if (remoteId.isEmpty() || language.isEmpty() || language == "und") continue
            if (labelEn.isEmpty() && labelZh.isEmpty()) continue
            if (remoteId in taken) continue
            val id = "yv-$remoteId"
            if (!seen.add(id)) continue
            val abbreviation = str(item, "abbreviation")
            val zhName = str(item, "languageNameZh").ifEmpty { str(item, "languageName") }.ifEmpty { language }
            val enName = str(item, "languageNameEn").ifEmpty { str(item, "languageName") }.ifEmpty { language }
            val short = abbreviation.ifEmpty { labelEn.ifEmpty { labelZh } }
            out.add(Entry(
                ScriptureTranslation(
                    id = id,
                    labelZh = labelZh.ifEmpty { labelEn },
                    labelEn = labelEn.ifEmpty { labelZh },
                    language = language,
                    delivery = TranslationDelivery.ONLINE,
                    provider = "youversion",
                    remoteId = remoteId,
                    pageLocale = "",
                    abbreviation = abbreviation,
                    downloadUrl = "",
                    hasChapterAudio = false,
                    shortZh = short, shortZhTw = short, shortEn = short),
                zhName, enName, str(item, "copyright")))
        }
        return out
    }
}

// ---- 落盘 ----
//
// 存成一行一条的 TSV，不存服务端那份 JSON：启动时要在主线程上把它读回来，
// 92KB JSON 解析要几十毫秒（会顶到冷启动时间上），TSV 按 \t / \n 切开只要一两毫秒。

private fun esc(s: String) = s.replace("\\", "\\\\").replace("\t", "\\t").replace("\n", "\\n")

private fun unesc(s: String): String {
    val sb = StringBuilder(s.length)
    var escaped = false
    for (ch in s) {
        when {
            escaped -> { sb.append(if (ch == 't') '\t' else if (ch == 'n') '\n' else ch); escaped = false }
            ch == '\\' -> escaped = true
            else -> sb.append(ch)
        }
    }
    return sb.toString()
}

private fun RemoteTranslations.writeDisk(f: File, list: List<RemoteTranslations.Entry>) {
    f.writeText(list.joinToString("\n") { e ->
        listOf(e.translation.remoteId, e.translation.language, e.translation.labelZh, e.translation.labelEn,
               e.translation.abbreviation, e.languageNameZh, e.languageNameEn, e.copyright).joinToString("\t") { esc(it) }
    })
}

private fun RemoteTranslations.readDisk(f: File): List<RemoteTranslations.Entry> {
    val out = ArrayList<RemoteTranslations.Entry>(512)
    for (line in f.readText().split('\n')) {
        if (line.isBlank()) continue
        val fields = line.split('\t')
        if (fields.size != 8) continue
        val remoteId = unesc(fields[0]); val language = unesc(fields[1])
        if (remoteId.isEmpty() || language.isEmpty()) continue
        val labelZh = unesc(fields[2]); val labelEn = unesc(fields[3]); val abbreviation = unesc(fields[4])
        val short = abbreviation.ifEmpty { labelEn.ifEmpty { labelZh } }
        out.add(RemoteTranslations.Entry(
            ScriptureTranslation("yv-$remoteId", labelZh, labelEn, language, TranslationDelivery.ONLINE,
                "youversion", remoteId, "", abbreviation, "", false, short, short, short),
            unesc(fields[5]), unesc(fields[6]), unesc(fields[7])))
    }
    return out
}
