package me.askbible.native_.data

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

/**
 * 读经活动的本机记录（RN reading-habit-stats / scripture-listen-totals / app-usage-time / read-last-position / read-recent-chapters）：
 * 探索页的「今年已过 / 读经天 / 连续天 / 使用时长 / 累计听 / 最近阅读」全从这里来，键与 RN AsyncStorage 同名。
 * habitStats / scriptureListenTotals / lastPosition 参与会员同步；使用时长 / 最近阅读只在本机。与 iOS ReadingActivityStore 同构。
 */
class ReadingActivityStore(context: Context) {
    companion object {
        const val HABIT_KEY = "askbible-reading-habit-stats-v1"
        const val LISTEN_KEY = "askbible-scripture-listen-totals-v1"
        const val USAGE_KEY = "askbible-app-usage-time-v1"
        const val LAST_KEY = "askbible-mobile-read-last-v1"
        const val RECENT_KEY = "askbible-mobile-read-recent-chapters-v1"
        const val MAX_RECENT = 3
    }

    data class RecentChapter(val bookId: String, val chapter: Int, val bookName: String, val at: Double) {
        val id: String get() = "$bookId:$chapter"
    }

    private val sp = context.applicationContext.getSharedPreferences("reading-activity", Context.MODE_PRIVATE)
    private val scope = CoroutineScope(Dispatchers.Main)

    /** 习惯统计：有读经活动（或打开过 App）的日历日，排序去重 */
    var completedDates by mutableStateOf<List<String>>(emptyList()); private set
    /** 累计听读秒数（经文朗读） */
    var listenTotalSec by mutableStateOf(0.0); private set
    /** 累计前台使用秒数（不含本次前台会话） */
    var usageStoredSec by mutableStateOf(0.0); private set
    var recent by mutableStateOf<List<RecentChapter>>(emptyList()); private set
    var lastPosition by mutableStateOf<RecentChapter?>(null); private set

    /** 本机改动通知（会员同步；应用云端期间压住） */
    var onLocalChange: ((String) -> Unit)? = null
    var suppressChangeNotify = false

    private var sessionStartedAtMs: Long? = null
    private var lastListenPos = -1.0
    private var listenPersistJob: Job? = null
    private var usagePersistJob: Job? = null

    init {
        completedDates = parseDates(sp.getString(HABIT_KEY, null), "completedDates")
        listenTotalSec = parseTotal(sp.getString(LISTEN_KEY, null))
        usageStoredSec = parseTotal(sp.getString(USAGE_KEY, null))
        recent = parseRecent(sp.getString(RECENT_KEY, null))
        lastPosition = parseLast(sp.getString(LAST_KEY, null))
    }

    private fun obj(raw: String?): JSONObject? = try { if (raw.isNullOrBlank()) null else JSONObject(raw) } catch (_: Exception) { null }

    // ---- 习惯统计（RN touchReadingHabitDay / replaceReadingHabitStatsRecord / computeReadingStreak） ----

    val completedDateSet: Set<String> get() = completedDates.toSet()
    val readDays: Int get() = completedDates.size
    val streakDays: Int get() = MemberReadingSyncRules.computeReadingStreak(completedDates, PlanDates.localDateString())

    private fun parseDates(raw: String?, field: String): List<String> {
        val o = obj(raw) ?: return emptyList()
        if (MemberReadingSyncRules.num(o.opt("version")) != 1.0) return emptyList()
        return MemberReadingSyncRules.normalizeDates(MemberReadingSyncRules.stringArray(o.opt(field)))
    }

    private fun writeHabit(dates: List<String>, notify: Boolean) {
        completedDates = dates
        sp.edit().putString(HABIT_KEY, JSONObject().put("version", 1).put("completedDates", JSONArray(dates)).toString()).apply()
        if (notify && !suppressChangeNotify) onLocalChange?.invoke("habitStats")
    }

    /** 记某日已有读经（只增不减）：打开 App、读完 / 听完一章、计划页点听 */
    fun touchHabitDay(date: String = PlanDates.localDateString()) {
        if (PlanDates.parseLocalDate(date) == null || date in completedDates) return
        writeHabit(MemberReadingSyncRules.normalizeDates(completedDates + date), notify = true)
    }

    /** 云端习惯日并入本机（并集，不触发再上传） */
    fun mergeRemoteHabit(dates: Collection<String>) {
        val merged = MemberReadingSyncRules.normalizeDates(completedDates + dates)
        if (merged != completedDates) writeHabit(merged, notify = false)
    }

    val habitJson: JSONObject get() = JSONObject().put("version", 1).put("completedDates", JSONArray(completedDates))

    // ---- 累计听读（RN noteScriptureListenProgress：按播放位置差累加，单次最多 1.5 秒） ----

    private fun parseTotal(raw: String?): Double {
        val o = obj(raw) ?: return 0.0
        if (MemberReadingSyncRules.num(o.opt("version")) != 1.0) return 0.0
        val n = MemberReadingSyncRules.num(o.opt("totalSec")) ?: return 0.0
        if (n.isNaN() || n.isInfinite() || n < 0) return 0.0
        return Math.floor(n)
    }

    fun noteListenProgress(positionSec: Double, isPlaying: Boolean) {
        if (!isPlaying || positionSec.isNaN() || positionSec.isInfinite() || positionSec < 0) { lastListenPos = -1.0; return }
        if (lastListenPos >= 0 && positionSec > lastListenPos) {
            val delta = minOf(positionSec - lastListenPos, 1.5)
            if (delta > 0) { listenTotalSec += delta; scheduleListenPersist() }
        }
        lastListenPos = positionSec
    }

    private fun scheduleListenPersist() {
        if (listenPersistJob != null) return
        listenPersistJob = scope.launch { delay(2000); listenPersistJob = null; persistListen(notify = true) }
    }

    private fun persistListen(notify: Boolean) {
        listenPersistJob?.cancel(); listenPersistJob = null
        sp.edit().putString(LISTEN_KEY, JSONObject().put("version", 1).put("totalSec", Math.floor(listenTotalSec).toLong()).toString()).apply()
        if (notify && !suppressChangeNotify) onLocalChange?.invoke("scriptureListenTotals")
    }

    /** 云端累计听并入：取较大值 */
    fun mergeRemoteListen(totalSec: Double) {
        val next = maxOf(listenTotalSec, Math.floor(totalSec))
        if (next == listenTotalSec) return
        listenTotalSec = next
        persistListen(notify = false)
    }

    val listenJson: JSONObject get() = JSONObject().put("version", 1).put("totalSec", Math.floor(listenTotalSec).toLong())

    // ---- 使用时长（RN app-usage-time：前台时段累加，15 秒打点，2.5 秒落盘） ----

    val usageTotalSec: Double get() = usageStoredSec + (sessionStartedAtMs?.let { maxOf(0L, System.currentTimeMillis() - it) / 1000.0 } ?: 0.0)

    fun noteForeground() { if (sessionStartedAtMs == null) sessionStartedAtMs = System.currentTimeMillis() }

    fun noteBackground() { flushUsageTick(); sessionStartedAtMs = null; persistUsage() }

    /** 把本次前台已过的秒数记入累计，重新起算 */
    fun flushUsageTick() {
        val started = sessionStartedAtMs ?: return
        val elapsed = maxOf(0L, System.currentTimeMillis() - started) / 1000.0
        if (elapsed > 0) { usageStoredSec += elapsed; sessionStartedAtMs = System.currentTimeMillis(); scheduleUsagePersist() }
    }

    private fun scheduleUsagePersist() {
        if (usagePersistJob != null) return
        usagePersistJob = scope.launch { delay(2500); usagePersistJob = null; persistUsage() }
    }

    private fun persistUsage() {
        usagePersistJob?.cancel(); usagePersistJob = null
        sp.edit().putString(USAGE_KEY, JSONObject().put("version", 1).put("totalSec", Math.floor(usageStoredSec).toLong()).toString()).apply()
    }

    // ---- 最近阅读 / 最后位置（RN writeLastReadPosition + pushReadRecentChapter） ----

    private fun parseLast(raw: String?): RecentChapter? {
        val o = obj(raw) ?: return null
        val bookId = (o.opt("bookId") as? String)?.trim().orEmpty()
        val ch = MemberReadingSyncRules.num(o.opt("chapter")) ?: return null
        if (bookId.isEmpty() || ch != Math.floor(ch) || ch < 1) return null
        val name = (o.opt("bookName") as? String)?.trim().orEmpty()
        return RecentChapter(bookId, ch.toInt(), name.ifEmpty { bookId }, 0.0)
    }

    private fun parseRecent(raw: String?): List<RecentChapter> {
        val arr = try { if (raw.isNullOrBlank()) null else JSONArray(raw) } catch (_: Exception) { null } ?: return emptyList()
        val out = ArrayList<RecentChapter>()
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            val bookId = (o.opt("bookId") as? String)?.trim().orEmpty()
            val ch = MemberReadingSyncRules.num(o.opt("chapter")) ?: continue
            if (bookId.isEmpty() || ch != Math.floor(ch) || ch < 1) continue
            val name = (o.opt("bookName") as? String)?.trim().orEmpty()
            val at = MemberReadingSyncRules.num(o.opt("at")) ?: 0.0
            out.add(RecentChapter(bookId, ch.toInt(), name.ifEmpty { bookId }, if (at > 0) at else System.currentTimeMillis().toDouble()))
            if (out.size >= MAX_RECENT) break
        }
        return out
    }

    private fun persistRecent() {
        val arr = JSONArray()
        for (r in recent) arr.put(JSONObject().put("bookId", r.bookId).put("chapter", r.chapter).put("bookName", r.bookName).put("at", r.at.toLong()))
        sp.edit().putString(RECENT_KEY, arr.toString()).apply()
    }

    private fun persistLast(p: RecentChapter) {
        sp.edit().putString(LAST_KEY, JSONObject().put("bookId", p.bookId).put("chapter", p.chapter).put("bookName", p.bookName).toString()).apply()
    }

    private fun pushRecent(p: RecentChapter) {
        val next = ArrayList<RecentChapter>()
        next.add(p)
        for (r in recent) if (r.id != p.id && next.size < MAX_RECENT) next.add(r)
        recent = next
        persistRecent()
    }

    /** 打开了某章：记最后位置 + 最近阅读 */
    fun recordOpened(bookId: String, chapter: Int, bookName: String) {
        val p = RecentChapter(bookId.uppercase(), chapter, bookName, System.currentTimeMillis().toDouble())
        lastPosition = p
        persistLast(p)
        pushRecent(p)
        if (!suppressChangeNotify) onLocalChange?.invoke("lastPosition")
    }

    /** 云端最后位置落本机（RN writeLastReadPosition 也会顶进最近阅读） */
    fun applyRemoteLastPosition(bookId: String, chapter: Int, bookName: String) {
        val p = RecentChapter(bookId, chapter, bookName.ifEmpty { bookId }, System.currentTimeMillis().toDouble())
        lastPosition = p
        persistLast(p)
        pushRecent(p)
    }

    val lastPositionJson: JSONObject? get() = lastPosition?.let { JSONObject().put("bookId", it.bookId).put("chapter", it.chapter).put("bookName", it.bookName) }

    // ---- 换帐号 / 退出（RN clearLocalMemberReadingSyncBlobs：习惯 / 听读 / 最后位置清空；使用时长与最近阅读留着） ----

    fun clearForAccountSwitch() {
        writeHabit(emptyList(), notify = false)
        listenTotalSec = 0.0; lastListenPos = -1.0
        sp.edit().remove(LISTEN_KEY).apply()
        lastPosition = null
        sp.edit().remove(LAST_KEY).apply()
    }
}
