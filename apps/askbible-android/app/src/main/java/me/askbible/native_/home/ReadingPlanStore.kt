package me.askbible.native_.home

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import me.askbible.native_.data.NtDeepRepeat
import me.askbible.native_.data.NtDeepRepeatState
import me.askbible.native_.data.PlanAnchor
import me.askbible.native_.data.PlanCopy
import me.askbible.native_.data.PlanDates
import me.askbible.native_.data.PlanPlay
import me.askbible.native_.data.PlanPointer
import me.askbible.native_.data.PlanReading
import me.askbible.native_.data.ReadingPlanCatalog
import me.askbible.native_.data.PlanStateJson
import me.askbible.native_.data.ReadingPlanPrefs
import me.askbible.native_.data.ReadingPlanRules
import me.askbible.native_.data.TripleLoop
import me.askbible.native_.data.TripleLoopState
import me.askbible.native_.data.TripleTrack
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.ZonedDateTime

/** 今日读经（对应 TodayReadingPlanPayload + 目录页脚注要显示的那几样） */
data class TodayPlan(val planId: String, val title: String, val dayNumber: Int, val metaLine: String, val readings: List<PlanReading>) {
    /** 逐章队列（RN buildPlanChapterQueue） */
    val queue: List<PlanPointer> get() = readings.flatMap { it.chapters }
}

/**
 * 读经计划的本机状态：偏好 + 三循环进度 + 深读进度 + 已读章。与 iOS 的 ReadingPlanStore 对等。
 * 对应 RN 的 reading-plan-prefs / triple-loop-progress / nt-deep-repeat-progress / read-chapter-completion 四个 store，
 * 落 SharedPreferences；纯逻辑全在 core 的 ReadingPlans.kt，这里只做 IO 与「读出来先对齐日历」。
 */
class ReadingPlanStore(context: Context) {
    private val appContext = context.applicationContext
    private val sp = appContext.getSharedPreferences("reading-plan", Context.MODE_PRIVATE)

    var prefs by mutableStateOf(ReadingPlanPrefs.default()); private set
    var storedPrefs by mutableStateOf<ReadingPlanPrefs?>(null); private set
    var triple by mutableStateOf(TripleLoop.defaultState()); private set
    var nt by mutableStateOf(NtDeepRepeat.defaultState()); private set
    var completed by mutableStateOf<Set<String>>(emptySet()); private set
    var hasUserTriple by mutableStateOf(false); private set
    var hasUserNt by mutableStateOf(false); private set
    /** 播放页点听过的日历日（YYYY-MM-DD），月历标黄；RN plan-play-listened-dates（并入习惯统计 completedDates） */
    var listenedDates by mutableStateOf<Set<String>>(emptySet()); private set

    private val bundles = HashMap<String, List<List<PlanReading>>>()

    init {
        storedPrefs = sp.getString(KEY_PREFS, null)?.let { parsePrefs(it) }
        prefs = storedPrefs ?: ReadingPlanPrefs.default()
        completed = sp.getString(KEY_COMPLETION, null)?.let { raw ->
            try { val a = JSONArray(raw); (0 until a.length()).map { a.getString(it) }.toSet() } catch (_: Exception) { emptySet() }
        } ?: emptySet()
        listenedDates = sp.getString(KEY_LISTENED, null)?.let { raw ->
            try {
                val o = JSONObject(raw)
                if (o.optInt("version") != 1) emptySet() else {
                    val a = o.optJSONArray("dates") ?: JSONArray()
                    (0 until a.length()).map { a.getString(it) }.filter { PlanDates.parseLocalDate(it) != null }.toSet()
                }
            } catch (_: Exception) { emptySet() }
        } ?: emptySet()
        reloadProgress()
    }

    // ---- JSON（规则在 core 的 PlanStateJson，同步合并也用同一份） ----
    private fun parsePrefs(raw: String): ReadingPlanPrefs? = try { PlanStateJson.parsePrefs(JSONObject(raw)) } catch (_: Exception) { null }
    private fun prefsJson(p: ReadingPlanPrefs): String = PlanStateJson.prefsJson(p).toString()
    private fun tripleJson(s: TripleLoopState): String = PlanStateJson.tripleJson(s).toString()
    private fun parseTriple(raw: String): TripleLoopState? = try { PlanStateJson.tripleFrom(JSONObject(raw)) } catch (_: Exception) { null }
    private fun ntJson(s: NtDeepRepeatState): String = PlanStateJson.ntJson(s).toString()
    private fun parseNt(raw: String): NtDeepRepeatState? = try { PlanStateJson.ntFrom(JSONObject(raw)) } catch (_: Exception) { null }

    /** 本机改动通知（会员同步用；应用云端数据期间由 suppressChangeNotify 压住，RN isApplyingRemoteMemberSync） */
    var onLocalChange: ((String) -> Unit)? = null
    var suppressChangeNotify = false
    private fun changed(key: String) { if (!suppressChangeNotify) onLocalChange?.invoke(key) }

    // ---- 会员同步：导出 / 应用（RN readingSyncLocalExport / readingSyncLocalApply） ----

    /** 存过的偏好（JSON，RN 同形）；隐式默认返回 null */
    val storedPrefsJson: JSONObject? get() = storedPrefs?.let { PlanStateJson.prefsJson(it) }
    /** 用户动过的三循环 / 深读进度（没动过 = 没存过 → null，RN hasUserTripleLoopProgress） */
    val tripleJsonOrNull: JSONObject? get() = if (hasUserTriple) PlanStateJson.tripleJson(triple) else null
    val ntJsonOrNull: JSONObject? get() = if (hasUserNt) PlanStateJson.ntJson(nt) else null
    val completedSorted: List<String> get() = completed.sorted()

    /** 云端计划偏好落本机（已按 mergeReadingPlanPrefsValue 合并过） */
    fun applyRemotePrefs(json: JSONObject?) {
        if (json == null) { writePrefs(null); return }
        val p = PlanStateJson.parsePrefs(json) ?: return
        writePrefs(p)
    }
    fun applyRemoteTriple(json: JSONObject) { val s = PlanStateJson.tripleFrom(json) ?: return; persistTriple(TripleLoop.normalize(s)); reloadProgress() }
    fun applyRemoteNt(json: JSONObject) { val s = PlanStateJson.ntFrom(json) ?: return; persistNt(NtDeepRepeat.normalize(s)); reloadProgress() }
    /** RN replaceReadChapterCompletionRecord：整份替换 */
    fun applyRemoteCompleted(keys: List<String>) {
        completed = keys.filter { it.isNotEmpty() }.toSet()
        sp.edit().putString(KEY_COMPLETION, JSONArray(completed.sorted()).toString()).apply()
    }
    /** 换帐号 / 退出：清空计划相关本机数据（RN clearLocalMemberReadingSyncBlobs 的计划部分） */
    fun clearForAccountSwitch() {
        sp.edit().remove(KEY_PREFS).remove(KEY_TRIPLE).remove(KEY_NT).remove(KEY_COMPLETION).remove(KEY_LISTENED).apply()
        completed = emptySet(); listenedDates = emptySet()
        storedPrefs = null; prefs = ReadingPlanPrefs.default()
        reloadProgress()
    }

    // ---- 读出来先对齐日历（readTripleLoopProgress / readNtDeepRepeatProgress） ----

    private fun reloadProgress() {
        val tripleRaw = sp.getString(KEY_TRIPLE, null)?.let { parseTriple(it) }
        hasUserTriple = tripleRaw != null
        val tripleStored = tripleRaw?.let { TripleLoop.normalize(it) } ?: TripleLoop.defaultState()
        val tripleEff = TripleLoop.resolveEffective(tripleStored, tripleRaw != null, LocalDate.now(), prefs.ahead)
        if (tripleRaw != null && !TripleLoop.pointersEqual(tripleStored, tripleEff)) persistTriple(tripleEff)
        triple = tripleEff

        val ntRaw = sp.getString(KEY_NT, null)?.let { parseNt(it) }
        hasUserNt = ntRaw != null
        val ntStored = ntRaw?.let { NtDeepRepeat.normalize(it) } ?: NtDeepRepeat.defaultState()
        val aligned = NtDeepRepeat.alignToCalendar(ntStored, prefs)
        if (ntRaw != null && !NtDeepRepeat.pointersEqual(ntStored, aligned)) persistNt(aligned)
        nt = aligned
    }

    private fun persistTriple(s: TripleLoopState) { sp.edit().putString(KEY_TRIPLE, tripleJson(s)).apply(); triple = s; hasUserTriple = true; changed("tripleLoopProgress") }
    private fun persistNt(s: NtDeepRepeatState) { sp.edit().putString(KEY_NT, ntJson(s)).apply(); nt = s; hasUserNt = true; changed("ntDeepRepeatProgress") }

    private fun writePrefs(p: ReadingPlanPrefs?) {
        sp.edit().apply { if (p == null) remove(KEY_PREFS) else putString(KEY_PREFS, prefsJson(p)) }.apply()
        storedPrefs = p
        prefs = p ?: ReadingPlanPrefs.default()
        reloadProgress()
        changed("readingPlanPrefs")
    }

    // ---- 计划切换（对应 setActiveReadingPlan / activateNtDeepRepeatPlan / ensureTripleLoopPlanPrefs） ----

    fun isActive(planId: String) = prefs.planId == planId

    /** 详情页「今日为第 N 天」：深读按选定日；三循环不显示；日课表按下标 + 1 */
    fun currentPlanDay(planId: String, dayCount: Int): Int? {
        if (!isActive(planId)) return null
        if (prefs.isNtDeepRepeat) return ReadingPlanRules.effectiveEpochDay(prefs)
        if (prefs.isTripleLoop) return null
        return ReadingPlanRules.dayIndex(prefs, dayCount) + 1
    }

    private fun setActive(planId: String, anchor: PlanAnchor, dayCount: Int?, now: LocalDate = LocalDate.now(), pace: Int? = null) {
        val startedOn = when (anchor) {
            PlanAnchor.FROM_TODAY -> PlanDates.localDateString(now)
            PlanAnchor.CALENDAR_EASTER -> PlanDates.EASTER_EPOCH
            PlanAnchor.CALENDAR_JAN1 -> null
        }
        writePrefs(ReadingPlanPrefs(planId, anchor, startedOn, dayCount, ntDeepRepeatPace = pace, chosen = true,
            selectedAt = ZonedDateTime.now().format(DateTimeFormatter.ISO_INSTANT)))
    }

    fun activate(planId: String, dayCount: Int, anchor: PlanAnchor, pace: Int, startDay: Int) {
        val safeStart = maxOf(1, startDay)
        val backDated = LocalDate.now().minusDays((safeStart - 1).toLong())
        when {
            planId == ReadingPlanCatalog.NT_DEEP_REPEAT_ID -> {
                val prev = storedPrefs
                val switching = prev?.planId != planId
                val paceChanged = prev?.planId == planId && prev.ntDeepRepeatPace != pace
                setActive(planId, PlanAnchor.FROM_TODAY, dayCount, backDated, pace)
                if (switching || paceChanged || safeStart > 1) {
                    val fresh = if (safeStart > 1)
                        NtDeepRepeat.stateForPlanDay(safeStart, pace, PlanDates.localDateString(backDated), backDated).copy(startedAt = PlanDates.localDateString(backDated))
                    else NtDeepRepeat.defaultState(pace, backDated)
                    persistNt(fresh)
                    reloadProgress()
                }
            }
            planId == ReadingPlanCatalog.TRIPLE_LOOP_ID -> setActive(planId, PlanAnchor.CALENDAR_EASTER, 1)
            anchor == PlanAnchor.FROM_TODAY -> setActive(planId, anchor, dayCount, backDated)
            else -> setActive(planId, anchor, dayCount)
        }
    }

    fun clearPlan() = writePrefs(null)

    /** 三循环「恢复为默认进度」：回到复活节历元的今日位置，已读章记录保留 */
    fun resetTripleToDefault() {
        setActive(ReadingPlanCatalog.TRIPLE_LOOP_ID, PlanAnchor.CALENDAR_EASTER, 1)
        val s = TripleLoop.stateForPlanDay(PlanDates.daySinceEpoch()).copy(startedAt = PlanDates.EASTER_EPOCH, chaptersReadKeys = triple.chaptersReadKeys)
        persistTriple(TripleLoop.normalize(s))
        sp.edit().remove(KEY_TRIPLE).apply(); hasUserTriple = false
        reloadProgress()
    }

    /** 深读「恢复为默认进度」：从今天第 1 阶第 1 天重来 */
    fun resetNt() {
        sp.edit().remove(KEY_NT).apply()
        persistNt(NtDeepRepeat.defaultState(prefs.ntDeepRepeatPace ?: NtDeepRepeat.DEFAULT_PACE))
        reloadProgress()
    }

    /** 「本节已读，推进 X」：只推进那一轨 */
    fun advanceTriple(track: TripleTrack) {
        var next = TripleLoop.advanceTrack(triple, track)
        if (next.startedAt == null) next = next.copy(startedAt = PlanDates.EASTER_EPOCH)
        persistTriple(next)
    }

    fun advanceNtDay() = persistNt(NtDeepRepeat.advanceNtDay(nt))
    fun advanceNtOt() = persistNt(NtDeepRepeat.advanceOtTrack(nt))

    // ---- 已读章 ----

    fun isCompleted(bookId: String, chapter: Int) = completed.contains(chapterKey(bookId, chapter))

    fun markChapterRead(bookId: String, chapter: Int) {
        completed = completed + chapterKey(bookId, chapter)
        // RN 习惯统计 completedDates：读完 / 听完一章的日子也算「读过」，月历标黄
        markListened(PlanDates.localDateString())
        sp.edit().putString(KEY_COMPLETION, JSONArray(completed.sorted()).toString()).apply()
        changed("chapterCompletion")
        if (prefs.isTripleLoop) persistTriple(TripleLoop.addChapterRead(triple, bookId, chapter))
        if (prefs.isNtDeepRepeat) persistNt(NtDeepRepeat.addChapterRead(nt, bookId, chapter))
    }

    // ---- 播放页（RN plan-play-listened-dates / loadReadingPlanPayloadAtAhead / setReadingPlanAheadDays） ----

    /** 某个日历日在播放页点听过 → 月历那天标黄（换计划后也保留） */
    fun markListened(iso: String) {
        if (PlanDates.parseLocalDate(iso) == null || iso in listenedDates) return
        listenedDates = listenedDates + iso
        val o = JSONObject().put("version", 1).put("dates", JSONArray(listenedDates.sorted()))
        sp.edit().putString(KEY_LISTENED, o.toString()).apply()
        changed("habitStats")
    }

    /**
     * 浏览「相对系统今天偏移 ahead 天」那一天该读什么（不写 prefs）。
     * 三循环永远按日历天算指针；深读 / 日课表在偏移等于已确认的 aheadDays 时就是今日内容。
     */
    fun readings(atContentAhead: Int, now: LocalDate = LocalDate.now()): List<PlanReading> {
        if (prefs.isTripleLoop) return TripleLoop.readings(TripleLoop.stateForPlanDay(maxOf(1, PlanDates.daySinceEpoch(now) + atContentAhead)))
        if (atContentAhead == prefs.ahead) return today.readings
        if (prefs.isNtDeepRepeat) {
            val planDay = maxOf(1, ReadingPlanRules.ntPlanDay(prefs, now) + atContentAhead)
            val pace = prefs.ntDeepRepeatPace ?: NtDeepRepeat.DEFAULT_PACE
            return NtDeepRepeat.readings(NtDeepRepeat.stateForPlanDay(planDay, pace, prefs.startedOn, now))
        }
        val dayCount = ReadingPlanCatalog.plan(prefs.planId)?.dayCount ?: prefs.dayCount ?: 365
        return registryDay(prefs.planId, PlanPlay.registryDayIndex(prefs, dayCount, atContentAhead, now)) ?: emptyList()
    }

    /**
     * 「进度设置为今日」：把日历上选的那天定为今天该读的内容（setReadingPlanAheadDays）。
     * 写 prefs.aheadDays，指针型计划再把指针跳到对应的计划天（保留已读章记录）。
     */
    fun setAheadDays(targetAhead: Int, now: LocalDate = LocalDate.now()) {
        val target = maxOf(0, targetAhead)
        if (target == prefs.ahead) return
        writePrefs(prefs.copy(aheadDays = if (target > 0) target else null, chosen = true))
        when {
            prefs.isNtDeepRepeat -> jumpNt(ReadingPlanRules.ntPlanDay(prefs, now) + target, now)
            prefs.isTripleLoop -> jumpTriple(PlanDates.daySinceEpoch(now) + target)
        }
    }

    private fun jumpTriple(planDay: Int) {
        val s = TripleLoop.stateForPlanDay(maxOf(1, planDay)).copy(startedAt = PlanDates.EASTER_EPOCH, chaptersReadKeys = triple.chaptersReadKeys)
        persistTriple(TripleLoop.normalize(s))
    }

    private fun jumpNt(planDay: Int, now: LocalDate) {
        val pace = prefs.ntDeepRepeatPace ?: NtDeepRepeat.DEFAULT_PACE
        val startedAt = prefs.startedOn?.trim()?.takeIf { it.isNotEmpty() } ?: PlanDates.localDateString(now)
        val s = NtDeepRepeat.stateForPlanDay(maxOf(1, planDay), pace, startedAt, now).copy(pace = pace, startedAt = startedAt, chaptersReadKeys = nt.chaptersReadKeys)
        persistNt(NtDeepRepeat.normalize(s, now))
    }

    /**
     * 深读：把第 index 阶设为今日新约读经（setNtDeepRepeatCurriculumStageAsToday）。
     * 该阶第一天早于日历天 → 把 startedOn 往前挪；晚于 → 记成 aheadDays。
     */
    fun setNtStageAsToday(index: Int, now: LocalDate = LocalDate.now()) {
        val pace = prefs.ntDeepRepeatPace ?: NtDeepRepeat.DEFAULT_PACE
        val safeIndex = index.coerceIn(0, maxOf(1, NtDeepRepeat.STAGE_COUNT) - 1)
        val planDay = safeIndex * pace + 1
        var startedAt = prefs.startedOn?.trim()?.takeIf { it.isNotEmpty() } ?: PlanDates.localDateString(now)
        val calendarDay = ReadingPlanRules.ntPlanDay(prefs.copy(startedOn = startedAt), now)
        val next = if (planDay < calendarDay) {
            startedAt = PlanDates.localDateString(now.minusDays((planDay - 1).toLong()))
            prefs.copy(startedOn = startedAt, aheadDays = null, chosen = true)
        } else {
            val ahead = planDay - calendarDay
            prefs.copy(startedOn = startedAt, aheadDays = if (ahead > 0) ahead else null, chosen = true)
        }
        val s = NtDeepRepeat.stateForPlanDay(planDay, pace, startedAt, now).copy(pace = pace, startedAt = startedAt, chaptersReadKeys = nt.chaptersReadKeys)
        // RN 先写进度再写 prefs；writePrefs 会按新 prefs 重新对齐进度
        persistNt(NtDeepRepeat.normalize(s, now))
        writePrefs(next)
    }

    // ---- 今日读经 ----

    /** 日课表某一天（assets/reading-plans/{planId}.json） */
    fun registryDay(planId: String, dayIndex: Int): List<PlanReading>? {
        if (!bundles.containsKey(planId)) {
            val days = try {
                val raw = appContext.assets.open("reading-plans/$planId.json").bufferedReader().use { it.readText() }
                val arr = JSONObject(raw).getJSONArray("days")
                (0 until arr.length()).map { i ->
                    val rs = arr.getJSONObject(i).optJSONArray("readings") ?: JSONArray()
                    (0 until rs.length()).map { j ->
                        val r = rs.getJSONObject(j)
                        PlanReading(r.getString("bookId"), r.getInt("startChapter"), r.getInt("endChapter"),
                            if (r.has("startVerse")) r.optInt("startVerse") else null, if (r.has("endVerse")) r.optInt("endVerse") else null, r.optString("label", ""))
                    }
                }
            } catch (_: Exception) { return null }
            bundles[planId] = days
        }
        return bundles[planId]?.getOrNull(dayIndex)
    }

    val today: TodayPlan get() {
        val entry = ReadingPlanCatalog.plan(prefs.planId)
        val title = entry?.title ?: prefs.planId
        val aheadLabel = PlanCopy.t("pages.read.todayPlanAheadLabel")
        fun meta(n: Int, anchor: String) = PlanCopy.f("pages.read.todayPlanDayMeta", mapOf("n" to "$n")) + " · " + anchor
        if (prefs.isTripleLoop) {
            val day = ReadingPlanRules.effectiveEpochDay(prefs)
            return TodayPlan(prefs.planId, title, day, meta(day, if (prefs.ahead > 0) aheadLabel else PlanCopy.t("pages.read.todayPlanAnchorEaster")), TripleLoop.readings(triple))
        }
        if (prefs.isNtDeepRepeat) {
            val day = ReadingPlanRules.effectiveEpochDay(prefs)
            return TodayPlan(prefs.planId, title, day, meta(day, if (prefs.ahead > 0) aheadLabel else PlanCopy.t("pages.read.todayPlanAnchorToday")), NtDeepRepeat.readings(nt))
        }
        val dayCount = entry?.dayCount ?: prefs.dayCount ?: 365
        val idx = ReadingPlanRules.effectiveDayIndex(prefs, dayCount)
        val calendarIdx = ReadingPlanRules.dayIndex(prefs, dayCount)
        val anchor = if (prefs.ahead > 0) aheadLabel else if (prefs.anchor == PlanAnchor.CALENDAR_JAN1) PlanCopy.t("pages.read.todayPlanAnchorJan1") else PlanCopy.t("pages.read.todayPlanAnchorToday")
        val n = calendarIdx + 1 + prefs.ahead
        return TodayPlan(prefs.planId, title, n, meta(n, anchor), registryDay(prefs.planId, idx) ?: emptyList())
    }

    companion object {
        private const val KEY_PREFS = "prefs-v1"
        private const val KEY_TRIPLE = "triple-loop-progress-v1"
        private const val KEY_NT = "nt-deep-repeat-progress-v5"
        private const val KEY_COMPLETION = "read-chapter-completion-v1"
        private const val KEY_LISTENED = "askbible-plan-play-listened-dates-v1"
        fun chapterKey(bookId: String, chapter: Int) = "${bookId.uppercase()}:$chapter"
    }
}
