package me.askbible.native_.home

import me.askbible.native_.data.RemoteBookNames
import me.askbible.native_.data.RemoteChapterStore
import me.askbible.native_.data.TranslationDelivery
import me.askbible.native_.data.ScriptureTranslation
import me.askbible.native_.data.name
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
import me.askbible.native_.data.AppLocale
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
    /**
     * 首页金句跟当前读经版本走（Josh 2026-09-10）：内置译本直接读本机库；在线译本（含法语等）取该版本的正文，
     * 没取到之前先用同语系的内置库顶着。切语言时读经译本本来就会跟着换，所以联动仍然成立。
     */
    var translationId: String = AppLocale.primaryTranslationId(AppLocale.current); private set
    /** 在线版本（正文要联网取）；null = 直接读本机库 */
    var remoteSource: ScriptureTranslation? = null; private set
    /** 金句朗读只有和合本 / WEBP 两套：显示的是别的版本时就没有对得上的朗读，喇叭不出 */
    var voiceAvailable by mutableStateOf(true); private set
    var audioTranslationId: String = AppLocale.goldenVerseAudioTranslationId(AppLocale.current); private set
    private val appContext = context.applicationContext
    private var db = ScriptureDatabase.open(context, translationId)
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

    /** 切语言：换经文译本与朗读译本，当前这句立刻按新译本重取 */
    /** 首页金句的来源版本 = 当前读经版本。内置的直接读库；在线的联网取正文，先用同语系内置库顶着 */
    fun setSource(t: ScriptureTranslation) {
        val fallbackId = if (t.isZh) (if (AppLocale.current == AppLocale.ZH_TW) "cuv-trad" else "cuv-simp") else "web-en"
        val localId = if (t.delivery == TranslationDelivery.BUNDLED) t.id else fallbackId
        if (localId != translationId) {
            translationId = localId
            db?.close()
            db = ScriptureDatabase.open(appContext, localId)
        }
        remoteSource = if (t.delivery == TranslationDelivery.BUNDLED) null else t
        audioTranslationId = AppLocale.goldenVerseAudioTranslationId(if (t.isZh) AppLocale.ZH_CN else AppLocale.EN)
        // 显示的正文不是和合本 / WEBP 时没有对得上的朗读
        voiceAvailable = remoteSource == null
        if (!voiceAvailable && voiceOn) stopVoice()
        if (verseKey.isNotEmpty()) {
            resolve(verseKey)?.let { verse = it }
            fetchRemoteIfNeeded(verseKey)
        }
    }

    /** 在线版本：把这一句所在的章拉回来（RemoteChapterStore 自带内存 + 落盘缓存），拿到就把当前这句换成该版本的正文 */
    private fun fetchRemoteIfNeeded(key: String) {
        val t = remoteSource ?: return
        val loc = GoldenVerseAudioSource.parseVerseKey(key) ?: return
        if (RemoteChapterStore.cached(appContext, t.id, loc.bookId, loc.chapter) != null) return
        scope.launch(Dispatchers.Main) {
            RemoteChapterStore.load(appContext, t, loc.bookId, loc.chapter)
            if (verseKey == key) resolve(key)?.let { verse = it }
        }
    }

    fun setTranslation(id: String, audioTranslationId: String) {
        if (id != translationId) {
            translationId = id
            db?.close()
            db = ScriptureDatabase.open(appContext, id)
        }
        this.audioTranslationId = audioTranslationId
        if (verseKey.isNotEmpty()) resolve(verseKey)?.let { verse = it }
    }

    private fun playCurrent() {
        val url = GoldenVerseAudioSource.remoteUrl(verseKey, audioTranslationId) ?: run { scheduleAdvanceAfterGap(); return }
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
        fetchRemoteIfNeeded(next)
        if (play) playCurrent()
    }

    private fun resolve(key: String): GoldenVerse? {
        val loc = GoldenVerseAudioSource.parseVerseKey(key) ?: return null
        val book = BibleCatalog.book(loc.bookId) ?: return null
        val name = remoteSource?.let { RemoteBookNames.name(appContext, it, loc.bookId) } ?: book.name(AppLocale.current)
        val reference = "$name ${loc.chapter}:${loc.verse}"
        // 在线版本：缓存里有这一章就用它的正文（换句时顺带把这一章拉回来缓存，见 fetchRemoteIfNeeded）
        remoteSource?.let { t ->
            RemoteChapterStore.cached(appContext, t.id, loc.bookId, loc.chapter)
                ?.firstOrNull { it.verse == loc.verse }
                ?.let { return GoldenVerse(VerseDisplayNotes.strip(it.text), reference) }
        }
        val row = db?.loadChapter(loc.bookId, loc.chapter)?.firstOrNull { it.number == loc.verse } ?: return null
        // 首页短展示要去括注（诗前「（上行之诗）」等），与 RN chunk 里的 zh-CN 行一致
        return GoldenVerse(VerseDisplayNotes.strip(row.text), reference)
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
