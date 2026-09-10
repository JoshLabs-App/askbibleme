package me.askbible.native_.home

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import me.askbible.native_.audio.GoldenVersePlayer
import me.askbible.native_.data.BibleCatalog
import me.askbible.native_.data.GoldenVerse
import me.askbible.native_.data.GoldenVerseAudioSource
import me.askbible.native_.data.HomeVerseEntry
import me.askbible.native_.data.HomeVersePool
import me.askbible.native_.data.PrayerMemoryRow
import me.askbible.native_.data.ScriptureDatabase
import me.askbible.native_.data.VerseDisplayNotes
import org.json.JSONObject
import kotlin.random.Random

/**
 * 首页金句：轮播 + 朗读。与 iOS 的 HomeVerseController 对等。
 * · 不出声时每 10 秒换一句（DEFAULT_HOME_VERSE_ROTATION_SEC）
 * · 开了朗读后，一句播完停 5 秒（DEFAULT_HOME_VERSE_GAP_SEC）再换下一句接着播
 * · 选句走 HomeVersePool 的间隔记忆，记忆落 SharedPreferences
 * 经文正文从内置 cuv-simp 库取（与 RN chunk 里的 zh-CN 行逐字相同，对拍脚本抽查过）。
 */
class HomeVerseController(private val context: Context, private val scope: CoroutineScope) {
    companion object {
        const val ROTATION_MS = 10_000L
        const val GAP_MS = 5_000L
        private const val PREFS = "home-verse"
        private const val MEMORY_KEY = "memory-v1"
    }

    var verse by mutableStateOf(GoldenVerse.SAMPLE); private set
    var verseKey by mutableStateOf(""); private set
    var voiceOn by mutableStateOf(false); private set
    var sleepDeadlineMs by mutableStateOf<Long?>(null); private set

    val player = GoldenVersePlayer(context)
    private val entries: List<HomeVerseEntry> = loadManifest()
    private val memory: MutableMap<String, PrayerMemoryRow> = loadMemory()
    private val db = ScriptureDatabase.open(context, "cuv-simp")
    private var rotation: Job? = null
    private var gap: Job? = null
    private var sleep: Job? = null

    init {
        player.onEnded = { scheduleAdvanceAfterGap() }
        advance(play = false)
        startRotation()
    }

    // ---- 朗读开关（首页那排氛围图标里的喇叭） ----

    fun toggleVoice() = if (voiceOn) stopVoice() else startVoice()

    fun startVoice() {
        voiceOn = true
        stopRotation()
        playCurrent()
    }

    fun stopVoice() {
        voiceOn = false
        gap?.cancel(); gap = null
        player.stop()
        startRotation()
    }

    private fun playCurrent() {
        val url = GoldenVerseAudioSource.remoteUrl(verseKey) ?: run { scheduleAdvanceAfterGap(); return }
        player.play(url, verse.reference)
    }

    private fun scheduleAdvanceAfterGap() {
        if (!voiceOn) return
        gap?.cancel()
        gap = scope.launch(Dispatchers.Main) {
            delay(GAP_MS)
            if (voiceOn) advance(play = true)
        }
    }

    // ---- 轮播 ----

    private fun startRotation() {
        rotation?.cancel()
        rotation = scope.launch(Dispatchers.Main) {
            while (true) {
                delay(ROTATION_MS)
                if (!voiceOn) advance(play = false)
            }
        }
    }

    private fun stopRotation() { rotation?.cancel(); rotation = null }

    /** 选下一句、更新记忆、换显示；play 为 true 时接着朗读 */
    fun advance(play: Boolean) {
        val now = System.currentTimeMillis().toDouble()
        val next = HomeVersePool.pickNext(entries, memory, now) { Random.nextDouble() }
        if (next.isEmpty()) return
        HomeVersePool.advanceMemory(memory, next, now)
        saveMemory(memory)
        verseKey = next
        verse = resolve(next) ?: GoldenVerse.SAMPLE
        if (play) playCurrent()
    }

    private fun resolve(key: String): GoldenVerse? {
        val loc = GoldenVerseAudioSource.parseVerseKey(key) ?: return null
        val book = BibleCatalog.book(loc.bookId) ?: return null
        val row = db?.loadChapter(loc.bookId, loc.chapter)?.firstOrNull { it.number == loc.verse } ?: return null
        // 首页短展示要去括注（诗前「（上行之诗）」等），与 RN chunk 里的 zh-CN 行一致
        return GoldenVerse(VerseDisplayNotes.strip(row.text), "${book.nameZh} ${loc.chapter}:${loc.verse}")
    }

    // ---- 睡眠定时（到期关掉朗读，与其它两个播放器同一套档位） ----

    fun setSleepTimer(minutes: Int?) {
        sleep?.cancel(); sleep = null
        if (minutes == null || minutes <= 0) { sleepDeadlineMs = null; return }
        val deadline = System.currentTimeMillis() + minutes * 60_000L
        sleepDeadlineMs = deadline
        sleep = scope.launch(Dispatchers.Main) {
            delay(deadline - System.currentTimeMillis())
            sleepDeadlineMs = null
            if (voiceOn) stopVoice()
        }
    }

    // ---- 数据 ----

    private fun loadManifest(): List<HomeVerseEntry> = try {
        val json = context.assets.open("home-verse-manifest.json").bufferedReader().use { it.readText() }
        val arr = JSONObject(json).getJSONArray("entries")
        List(arr.length()) { i -> val o = arr.getJSONObject(i); HomeVerseEntry(o.getString("verseKey"), o.getInt("weight")) }
    } catch (_: Exception) { emptyList() }

    private fun loadMemory(): MutableMap<String, PrayerMemoryRow> {
        val out = HashMap<String, PrayerMemoryRow>()
        try {
            val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(MEMORY_KEY, null) ?: return out
            val o = JSONObject(raw)
            for (k in o.keys()) {
                val r = o.getJSONObject(k)
                out[k] = PrayerMemoryRow(r.getDouble("lastShownAt"), r.getDouble("intervalMs"), r.getInt("level"))
            }
        } catch (_: Exception) { }
        return out
    }

    private fun saveMemory(memory: Map<String, PrayerMemoryRow>) {
        val o = JSONObject()
        for ((k, r) in memory) {
            o.put(k, JSONObject().put("lastShownAt", r.lastShownAt).put("intervalMs", r.intervalMs).put("level", r.level))
        }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(MEMORY_KEY, o.toString()).apply()
    }

    fun release() {
        rotation?.cancel(); gap?.cancel(); sleep?.cancel()
        player.release()
        db?.close()
    }
}
