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
) {
    /** 「10月1日」 */
    val dateLabel: String get() = md.split("-").let { "${it[0].toInt()}月${it[1].toInt()}日" }
}

object SolidJoys {
    private const val URL_JSON = "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev/devotionals/solid-joys-zh.json"
    private const val FILE = "solid-joys-zh.json"

    const val TITLE = "约翰·派博每日灵修"
    const val CREDIT_AUTHOR = "John Piper / Desiring God"
    const val CREDIT_TRANSLATION = "忠信福音事工"
    const val CREDIT_LINK = "https://www.befaithful.net"

    sealed class State {
        object Idle : State()
        object Loading : State()
        data class Ready(val days: Map<String, DevotionalDay>) : State()
        data class Failed(val message: String) : State()
    }

    var state: State by mutableStateOf(State.Idle)
        private set

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var job: Job? = null

    /** 授权只给中文版：英文界面整块不出现 */
    fun availableFor(locale: AppLocale) = locale != AppLocale.EN

    /** 某天那一篇；2 月 29 日这本灵修没有，显示 2 月 28 日 */
    fun day(date: LocalDate): DevotionalDay? {
        val days = (state as? State.Ready)?.days ?: return null
        val md = if (date.monthValue == 2 && date.dayOfMonth == 29) "02-28" else "%02d-%02d".format(date.monthValue, date.dayOfMonth)
        return days[md]
    }

    /** 有缓存读缓存，没有就下载；已在下载或已就绪不重复做。失败后再调一次即重试 */
    fun ensureLoaded(context: Context) {
        if (state is State.Ready || job?.isActive == true) return
        val app = context.applicationContext
        state = State.Loading
        job = scope.launch {
            val file = File(app.filesDir, FILE)
            state = try {
                if (!file.exists() || file.length() == 0L) download(file)
                State.Ready(parse(file.readText()))
            } catch (e: Exception) {
                // 缓存坏了就删掉，下次重新下
                file.delete()
                State.Failed(e.message ?: "load failed")
            }
        }
    }

    private fun download(dest: File) {
        val conn = URL(URL_JSON).openConnection() as HttpURLConnection
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
            )
            out[d.md] = d
        }
        if (out.size < 360) throw IllegalStateException("only ${out.size} days")
        return out
    }
}
