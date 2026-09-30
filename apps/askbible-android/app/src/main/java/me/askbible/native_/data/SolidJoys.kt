package me.askbible.native_.data

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate

/**
 * 每日灵修《约翰·派博每日灵修》（纯全喜乐，忠信福音事工中文版）。
 *
 * 数据由 tools/gen-solid-joys.py 从授权方给的 Word 稿切成 365 天，传到 R2 的 devotionals/solid-joys-zh.json；
 * 仓库是公开的，全文不进仓库、不随包内置，首次进计划页时下载，存在 filesDir 里离线可读。
 * 音频不在我们这里：每天的 mp3 直接引用 befaithful.net（DECISIONS D-6）。
 * 入口只在读经计划页（D-7），只在中文界面出现（授权只给中文版，见 docs/content-permissions.md）。
 * 繁体界面读 solid-joys-zh-tw.json：生成数据时用 opencc 整份转好字形并人工修过几处（Josh 2026-09-30「要转」），
 * 不在运行时逐字转——界面文案用的 ZhTw 逐字表对 20 万字的正文不够准。
 */
data class DevotionalDay(
    val md: String,
    val title: String,
    val verse: String,
    val ref: String,
    val refBook: String?,
    val refChapter: Int?,
    val paragraphs: List<String>,
    val audio: String?,
    /** 音频时长（秒），卡片显示「约 N 分钟」 */
    val audioSec: Int?,
) {
    /** 「10月1日」 */
    val dateLabel: String get() = md.split("-").let { "${it[0].toInt()}月${it[1].toInt()}日" }
}

object SolidJoys {
    private const val BASE = "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev/devotionals/"

    const val TITLE = "约翰·派博每日灵修"
    const val CREDIT_AUTHOR = "John Piper / Desiring God"
    const val CREDIT_TRANSLATION = "忠信福音事工"
    const val CREDIT_LINK = "https://www.befaithful.net"

    sealed class State {
        object Idle : State()
        object Loading : State()
        data class Ready(val file: String, val days: Map<String, DevotionalDay>) : State()
        data class Failed(val message: String) : State()
    }

    var state: State by mutableStateOf(State.Idle)
        private set

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var job: Job? = null
    private var loadingFile: String? = null

    /** 授权只给中文版：英文界面整块不出现 */
    fun availableFor(locale: AppLocale) = locale != AppLocale.EN

    /** 某天那一篇；2 月 29 日这本灵修没有，显示 2 月 28 日 */
    fun day(date: LocalDate): DevotionalDay? {
        val days = (state as? State.Ready)?.days ?: return null
        val md = if (date.monthValue == 2 && date.dayOfMonth == 29) "02-28" else "%02d-%02d".format(date.monthValue, date.dayOfMonth)
        return days[md]
    }

    /** R2 上的文件名（远端不带版本号，内容更新直接覆盖） */
    private fun fileFor(locale: AppLocale) = if (locale == AppLocale.ZH_TW) "solid-joys-zh-tw.json" else "solid-joys-zh.json"

    /**
     * 本机缓存的数据版本：数据加了字段（如 v2 的 audioSec）就 +1，老缓存换名作废、自动重下。
     * 只改文字不加字段时不必动它——那种更新目前到不了已下载过的手机（OPEN-ITEMS O-7）。
     */
    private const val CACHE_VERSION = 2
    private fun cacheName(remote: String) = remote.removeSuffix(".json") + ".v$CACHE_VERSION.json"

    /** md → 今年那一天（坞上点篇名回到灵修页用） */
    fun dateForKey(md: String): LocalDate = md.split("-").let { LocalDate.of(LocalDate.now().year, it[0].toInt(), it[1].toInt()) }

    /** 按 md（"09-30"）取，播放坞用 */
    fun dayByKey(md: String): DevotionalDay? = (state as? State.Ready)?.days?.get(md)

    /** 有缓存读缓存，没有就下载；同一版已在下载或已就绪不重复做。失败后再调一次即重试；切简繁会换一份 */
    fun ensureLoaded(context: Context, locale: AppLocale) {
        val name = fileFor(locale)
        if ((state as? State.Ready)?.file == name) return
        if (job?.isActive == true && loadingFile == name) return
        job?.cancel()
        loadingFile = name
        val app = context.applicationContext
        state = State.Loading
        job = scope.launch {
            // 清掉旧版本的缓存
            app.filesDir.listFiles { f -> f.name.startsWith("solid-joys-zh") && f.name != cacheName(name) && !f.name.endsWith(".part") &&
                (f.name.startsWith(name.removeSuffix(".json") + ".") || f.name == name) }?.forEach { it.delete() }
            val file = File(app.filesDir, cacheName(name))
            state = try {
                if (!file.exists() || file.length() == 0L) download(BASE + name, file)
                State.Ready(name, parse(file.readText()))
            } catch (e: Exception) {
                // 缓存坏了就删掉，下次重新下
                file.delete()
                State.Failed(e.message ?: "load failed")
            }
        }
    }

    private fun download(url: String, dest: File) {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 20_000; conn.readTimeout = 60_000
        if (conn.responseCode !in 200..299) throw IllegalStateException("HTTP ${conn.responseCode}")
        val tmp = File(dest.path + ".part")
        conn.inputStream.use { input -> tmp.outputStream().use { input.copyTo(it) } }
        parse(tmp.readText()) // 先确认是完整的 JSON 再换上
        if (!tmp.renameTo(dest)) { tmp.copyTo(dest, overwrite = true); tmp.delete() }
    }

    private fun parse(text: String): Map<String, DevotionalDay> {
        val arr = JSONObject(text).getJSONArray("days")
        val out = HashMap<String, DevotionalDay>(arr.length())
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            val paras = o.getJSONArray("paragraphs").let { p -> List(p.length()) { p.getString(it) } }
            val d = DevotionalDay(
                md = o.getString("md"),
                title = o.optString("title"),
                verse = o.optString("verse"),
                ref = o.optString("ref"),
                refBook = o.optString("refBook").takeIf { it.isNotEmpty() && it != "null" },
                refChapter = o.optInt("refChapter", 0).takeIf { it > 0 },
                paragraphs = paras,
                audio = o.optString("audio").takeIf { it.startsWith("http") },
                audioSec = o.optInt("audioSec", 0).takeIf { it > 0 },
            )
            out[d.md] = d
        }
        if (out.size < 360) throw IllegalStateException("only ${out.size} days")
        return out
    }
}
