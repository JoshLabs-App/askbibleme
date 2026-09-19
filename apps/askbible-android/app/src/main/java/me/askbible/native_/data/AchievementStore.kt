package me.askbible.native_.data

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import me.askbible.native_.home.ReadingPlanStore
import org.json.JSONArray
import org.json.JSONObject
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.WeekFields

/**
 * 成就系统的数据层，与 iOS `Model/AchievementStore.swift` 逐条对等（DECISIONS「成就系统」「XP 要一直在涨」）。
 *
 * 只存一份 ledger：读过哪些章、读过多少节、每天的晨 / 夜标记、以及已获得的勋章档位。
 * 勋章、书卷印章、等级全部**现算**——云端同步进来新数据，下次评估就把漏发的补上。
 *
 * XP 分两半：基础 XP 由 ledger 现算（只增不减）；加成 XP（连续天数乘区 + 连读 combo）在动作发生的当下算出来累加落盘，
 * 否则断签后倍率掉回 1.0，历史 XP 会跟着缩水。
 */
class AchievementStore(context: Context) {
    companion object {
        const val LEDGER_KEY = "askbible-achievements-ledger-v1"
        const val MONTH_ANCHOR_KEY = "askbible-achievements-month-anchor"
        const val MONTH_TAG_KEY = "askbible-achievements-month-tag"
    }

    data class Earned(val tier: Int, val at: Double)

    /** 一次评估产生的新事件，给飘字 / 弹层用 */
    sealed class Event {
        data class Xp(val amount: Int, val reason: String) : Event()
        data class ChapterRead(val bookId: String, val chapter: Int) : Event()
        data class SealEarned(val bookId: String) : Event()
        data class Medal(val key: String, val tier: Int) : Event()
        data class LevelUp(val level: Int) : Event()
    }

    /** 落盘的 ledger（字段名与 iOS Snapshot / 同步 JSON 一致） */
    private data class Snapshot(
        /** "GEN:1" → 首次读完的时间戳（秒） */
        var chaptersRead: MutableMap<String, Double> = mutableMapOf(),
        /** 打开过（没读完也算）的章，只用来发「初次翻开」 */
        var chaptersOpened: Int = 0,
        /** 累计读过的经节次数（微反馈 XP 的来源，重读也算） */
        var versesRead: Int = 0,
        /** 累计听读的计时片数（每 listenTickSeconds 一片） */
        var listenTicks: Int = 0,
        var morningDates: MutableList<String> = mutableListOf(),
        var nightDates: MutableList<String> = mutableListOf(),
        /** 已获得的勋章 → 最高档 */
        var earned: MutableMap<String, Earned> = mutableMapOf(),
        /** 点亮的书卷印章 → 时间 */
        var seals: MutableMap<String, Double> = mutableMapOf(),
        /** 连续天数乘区 / combo 在当下算出来的加成，累加落盘 */
        var bonusXP: Int = 0,
        /** 连读同一卷的计数（用来算 combo 和「一路读下去」） */
        var comboBookId: String = "",
        var comboCount: Int = 0,
        /** 一天只发一次的「今天第一次打开」 */
        var lastOpenDay: String = "",
        /** 历史最长连续天数：倍率只升不降（Josh 2026-09-18 A 方案） */
        var bestStreakDays: Int = 0,
        /** 当前在听的那一章，以及这一章已经给过几片听读 XP（防挂机刷分） */
        var listenChapterKey: String = "",
        var listenChapterTicks: Int = 0,
    )

    private val sp = context.applicationContext.getSharedPreferences("achievements", Context.MODE_PRIVATE)

    var totalXP by mutableStateOf(0); private set
    var level by mutableStateOf(1); private set
    var earned by mutableStateOf<Map<String, Earned>>(emptyMap()); private set
    var seals by mutableStateOf<Map<String, Double>>(emptyMap()); private set
    var chaptersReadCount by mutableStateOf(0); private set
    /** 待展示的事件队列（飘字 / 弹层消费一条 consume 一条） */
    var pending by mutableStateOf<List<Event>>(emptyList()); private set

    /** 本机改动通知（会员同步） */
    var onLocalChange: ((String) -> Unit)? = null
    var suppressChangeNotify = false

    private var s: Snapshot = Snapshot()
    private var activity: ReadingActivityStore? = null
    private var plans: ReadingPlanStore? = null
    private var bookmarks: VerseBookmarkStore? = null
    private var highlights: VerseHighlightStore? = null
    /** 测试可替换的时钟（秒） */
    var nowSeconds: () -> Double = { System.currentTimeMillis() / 1000.0 }
    var today: () -> LocalDate = { LocalDate.now() }
    /** App 是否在前台：听读 XP 只在前台给（后台播着不算，A 方案的防刷约束之一） */
    var foreground = true

    init {
        s = parse(sp.getString(LEDGER_KEY, null)) ?: Snapshot()
    }

    fun attach(
        activity: ReadingActivityStore,
        plans: ReadingPlanStore,
        bookmarks: VerseBookmarkStore,
        highlights: VerseHighlightStore,
    ) {
        this.activity = activity
        this.plans = plans
        this.bookmarks = bookmarks
        this.highlights = highlights
        refresh()
    }

    // ---- 落盘 ----

    private fun parse(raw: String?): Snapshot? {
        val o = try { if (raw.isNullOrBlank()) null else JSONObject(raw) } catch (_: Exception) { null } ?: return null
        val snap = Snapshot()
        (o.opt("chaptersRead") as? JSONObject)?.let { m ->
            for (k in m.keys()) snap.chaptersRead[k] = MemberReadingSyncRules.num(m.opt(k)) ?: 0.0
        }
        snap.chaptersOpened = (MemberReadingSyncRules.num(o.opt("chaptersOpened")) ?: 0.0).toInt()
        snap.versesRead = (MemberReadingSyncRules.num(o.opt("versesRead")) ?: 0.0).toInt()
        snap.listenTicks = (MemberReadingSyncRules.num(o.opt("listenTicks")) ?: 0.0).toInt()
        snap.morningDates = MemberReadingSyncRules.stringArray(o.opt("morningDates")).toMutableList()
        snap.nightDates = MemberReadingSyncRules.stringArray(o.opt("nightDates")).toMutableList()
        (o.opt("earned") as? JSONObject)?.let { m ->
            for (k in m.keys()) {
                val e = m.optJSONObject(k) ?: continue
                val tier = (MemberReadingSyncRules.num(e.opt("tier")) ?: 0.0).toInt()
                if (tier < 1) continue
                snap.earned[k] = Earned(tier, MemberReadingSyncRules.num(e.opt("at")) ?: 0.0)
            }
        }
        (o.opt("seals") as? JSONObject)?.let { m ->
            for (k in m.keys()) snap.seals[k] = MemberReadingSyncRules.num(m.opt(k)) ?: 0.0
        }
        snap.bonusXP = (MemberReadingSyncRules.num(o.opt("bonusXP")) ?: 0.0).toInt()
        snap.comboBookId = (o.opt("comboBookId") as? String).orEmpty()
        snap.comboCount = (MemberReadingSyncRules.num(o.opt("comboCount")) ?: 0.0).toInt()
        snap.lastOpenDay = (o.opt("lastOpenDay") as? String).orEmpty()
        snap.bestStreakDays = (MemberReadingSyncRules.num(o.opt("bestStreakDays")) ?: 0.0).toInt()
        snap.listenChapterKey = (o.opt("listenChapterKey") as? String).orEmpty()
        snap.listenChapterTicks = (MemberReadingSyncRules.num(o.opt("listenChapterTicks")) ?: 0.0).toInt()
        return snap
    }

    private fun snapshotJson(): JSONObject {
        val chapters = JSONObject()
        for ((k, v) in s.chaptersRead) chapters.put(k, v.toLong())
        val earnedJson = JSONObject()
        for ((k, e) in s.earned) earnedJson.put(k, JSONObject().put("tier", e.tier).put("at", e.at.toLong()))
        val sealsJson = JSONObject()
        for ((k, v) in s.seals) sealsJson.put(k, v.toLong())
        return JSONObject()
            .put("version", 1)
            .put("chaptersRead", chapters)
            .put("chaptersOpened", s.chaptersOpened)
            .put("versesRead", s.versesRead)
            .put("listenTicks", s.listenTicks)
            .put("morningDates", JSONArray(s.morningDates))
            .put("nightDates", JSONArray(s.nightDates))
            .put("earned", earnedJson)
            .put("seals", sealsJson)
            .put("bonusXP", s.bonusXP)
            .put("comboBookId", s.comboBookId)
            .put("comboCount", s.comboCount)
            .put("lastOpenDay", s.lastOpenDay)
            .put("bestStreakDays", s.bestStreakDays)
            .put("listenChapterKey", s.listenChapterKey)
            .put("listenChapterTicks", s.listenChapterTicks)
    }

    /** 有没有需要落盘的改动（iOS 那边靠 Snapshot 的 didSet，Kotlin 显式标记） */
    private var dirty = false

    private fun persist() {
        dirty = false
        sp.edit().putString(LEDGER_KEY, snapshotJson().toString()).apply()
        if (!suppressChangeNotify) onLocalChange?.invoke("achievements")
    }

    // ---- 统计口径（勋章判定都走这里） ----

    val readingDays: Int get() = activity?.readDays ?: 0
    val streakDays: Int get() = activity?.streakDays ?: 0
    val listenSeconds: Double get() = activity?.listenTotalSec ?: 0.0
    val favoritesCount: Int get() = bookmarks?.store?.size ?: 0
    val highlightsCount: Int get() = highlights?.store?.values?.sumOf { it.size } ?: 0
    val planDays: Int get() = plans?.completed?.size ?: 0

    /** 读完的章按卷归拢 */
    private val readByBook: Map<String, Set<Int>>
        get() {
            val out = HashMap<String, MutableSet<Int>>()
            for (key in s.chaptersRead.keys) {
                val parts = key.split(":")
                if (parts.size != 2) continue
                val ch = parts[1].toIntOrNull() ?: continue
                out.getOrPut(parts[0]) { mutableSetOf() }.add(ch)
            }
            return out
        }

    /** 整卷读完的卷 id */
    val completedBookIds: Set<String>
        get() {
            val byBook = readByBook
            return BibleCatalog.all.filter { (byBook[it.id]?.size ?: 0) >= it.chapterCount }.map { it.id }.toSet()
        }

    val otBooksCompleted: Int
        get() = completedBookIds.mapNotNull { id -> BibleCatalog.book(id)?.number }
            .count { it <= BibleCatalog.OLD_TESTAMENT_MAX }
    val ntBooksCompleted: Int
        get() = completedBookIds.mapNotNull { id -> BibleCatalog.book(id)?.number }
            .count { it > BibleCatalog.OLD_TESTAMENT_MAX }

    /** 完整的一周（周一起算）每天都读经的周数 */
    val fullWeeks: Int
        get() {
            val dates = activity?.completedDateSet ?: return 0
            if (dates.isEmpty()) return 0
            val fields = WeekFields.of(DayOfWeek.MONDAY, 7)
            val seen = HashSet<Int>()
            var weeks = 0
            for (d in dates) {
                val p = PlanDates.parseLocalDate(d) ?: continue
                val day = try { LocalDate.of(p.first, p.second, p.third) } catch (_: Exception) { continue }
                val y = day.get(fields.weekBasedYear())
                val w = day.get(fields.weekOfWeekBasedYear())
                val tag = y * 100 + w
                if (!seen.add(tag)) continue
                val start = day.with(fields.dayOfWeek(), 1)
                if ((0..6).all { PlanDates.localDateString(start.plusDays(it.toLong())) in dates }) weeks += 1
            }
            return weeks
        }

    /** 本月听读小时（本机只有总数，用「本月新增」近似：见 monthAnchor） */
    val listenHoursThisMonth: Int
        get() {
            val anchor = sp.getFloat(MONTH_ANCHOR_KEY, 0f).toDouble()
            return (maxOf(0.0, listenSeconds - anchor)).toInt() / 3600
        }

    private fun monthTag(): String {
        val d = today()
        return "%04d-%02d".format(d.year, d.monthValue)
    }

    private fun rollMonthAnchorIfNeeded() {
        val tag = monthTag()
        if (sp.getString(MONTH_TAG_KEY, null) != tag) {
            sp.edit().putString(MONTH_TAG_KEY, tag).putFloat(MONTH_ANCHOR_KEY, listenSeconds.toFloat()).apply()
        }
    }

    fun value(metric: MedalMetric): Int = when (metric) {
        MedalMetric.CHAPTERS_OPENED -> s.chaptersOpened
        MedalMetric.CHAPTERS_READ -> s.chaptersRead.size
        MedalMetric.READING_DAYS -> readingDays
        MedalMetric.STREAK_DAYS -> streakDays
        MedalMetric.FAVORITES -> favoritesCount
        MedalMetric.SAME_BOOK_STREAK -> s.comboCount
        MedalMetric.LISTEN_HOURS -> listenSeconds.toInt() / 3600
        MedalMetric.LISTEN_HOURS_THIS_MONTH -> listenHoursThisMonth
        MedalMetric.MORNING_DAYS -> s.morningDates.size
        MedalMetric.NIGHT_DAYS -> s.nightDates.size
        MedalMetric.BOOKS_COMPLETED -> completedBookIds.size
        MedalMetric.OT_BOOKS_COMPLETED -> otBooksCompleted
        MedalMetric.NT_BOOKS_COMPLETED -> ntBooksCompleted
        MedalMetric.BOTH_TESTAMENTS -> minOf(otBooksCompleted, ntBooksCompleted)
        MedalMetric.FULL_WEEKS -> fullWeeks
        MedalMetric.PLAN_DAYS -> planDays
    }

    // ---- XP ----

    /**
     * 连续天数带来的倍率。取「当前连续天数」与「历史最长」的较大者——断签后倍率不掉回去
     * （Josh 2026-09-18 拍板 A 方案：爽感保留，「一天没读就全毁了」的负反馈去掉）。
     */
    val streakMultiplier: Double
        get() = minOf(1 + maxOf(streakDays, s.bestStreakDays) * MedalXP.streakPerDay, MedalXP.streakCap)

    /** 基础 XP：完全由 ledger 推出来，只增不减 */
    val baseXP: Int
        get() {
            var xp = 0
            xp += s.versesRead * MedalXP.perVerseRead
            xp += s.listenTicks * MedalXP.perListenTick
            xp += s.chaptersRead.size * MedalXP.perChapterRead
            xp += completedBookIds.size * MedalXP.perBookCompleted
            xp += readingDays * MedalXP.perReadingDay
            xp += favoritesCount * MedalXP.perFavorite
            xp += highlightsCount * MedalXP.perHighlight
            xp += planDays * MedalXP.perPlanDay
            xp += s.earned.values.sumOf { it.tier } * MedalXP.perMedalTier
            xp += s.seals.size * MedalXP.perSeal
            return xp
        }

    val xpInLevel: Int get() = totalXP - MedalLevels.floor(level)
    val xpForLevel: Int get() = maxOf(1, MedalLevels.ceiling(level) - MedalLevels.floor(level))
    val levelProgress: Float get() = (xpInLevel.toFloat() / xpForLevel.toFloat()).coerceIn(0f, 1f)

    /** 把「当下」的加成记进去（倍率高于 1 的那部分才算加成，基础部分已在 baseXP 里） */
    private fun addBonus(base: Int): Int {
        val bonus = Math.round(base * (streakMultiplier - 1)).toInt()
        if (bonus > 0) s.bonusXP += bonus
        return bonus
    }

    // ---- 上报 ----

    /** 打开了某一章 */
    fun noteChapterOpened(bookId: String, chapter: Int) {
        rollMonthAnchorIfNeeded()
        dirty = true
        s.chaptersOpened += 1
        val day = PlanDates.localDateString(today())
        if (s.lastOpenDay != day) {
            s.lastOpenDay = day
            emit(Event.Xp(MedalXP.firstOpenOfDay + addBonus(MedalXP.firstOpenOfDay), "firstOpenOfDay"))
        }
        refresh()
    }

    /** 读过 n 节经文（滚动经过即算，微反馈） */
    fun noteVersesRead(n: Int) {
        if (n <= 0) return
        dirty = true
        s.versesRead += n
        val base = n * MedalXP.perVerseRead
        emit(Event.Xp(base + addBonus(base), "verses"))
        refresh()
    }

    /**
     * 听读又过了一片（由播放器每 listenTickSeconds 调一次）。
     * 三重约束（A 方案）：App 在前台、确实在播、且同一章最多给 listenTicksPerChapterCap 片——挂机放整夜刷不出 XP。
     */
    fun noteListenTick(bookId: String, chapter: Int) {
        if (!foreground) return
        val key = "${bookId.uppercase()}:$chapter"
        if (s.listenChapterKey != key) { s.listenChapterKey = key; s.listenChapterTicks = 0 }
        if (s.listenChapterTicks >= MedalXP.listenTicksPerChapterCap) return
        dirty = true
        s.listenChapterTicks += 1
        s.listenTicks += 1
        val base = MedalXP.perListenTick
        emit(Event.Xp(base + addBonus(base), "listen"))
        refresh()
    }

    /** 读完一章：唯一会点亮书卷印章的入口 */
    fun noteChapterRead(bookId: String, chapter: Int) {
        val id = bookId.uppercase()
        val key = "$id:$chapter"
        if (s.chaptersRead[key] != null) return   // 重读不重复给
        dirty = true
        s.chaptersRead[key] = nowSeconds()

        // combo：连着读同一卷
        if (s.comboBookId == id) s.comboCount += 1 else { s.comboBookId = id; s.comboCount = 1 }
        val combo = if (s.comboCount >= 2) minOf((s.comboCount - 1) * MedalXP.comboStep, MedalXP.comboCap) else 0
        if (combo > 0) s.bonusXP += combo

        val base = MedalXP.perChapterRead
        emit(Event.Xp(base + addBonus(base) + combo, "chapter"))
        emit(Event.ChapterRead(id, chapter))

        // 晨 / 夜标记
        val hour = java.time.LocalTime.now().hour
        val day = PlanDates.localDateString(today())
        if (hour in 5..8 && day !in s.morningDates) s.morningDates.add(day)
        if ((hour >= 21 || hour < 2) && day !in s.nightDates) s.nightDates.add(day)

        // 整卷读完 → 点亮印章
        val book = BibleCatalog.book(id)
        if (book != null && (readByBook[id]?.size ?: 0) >= book.chapterCount && s.seals[id] == null) {
            s.seals[id] = nowSeconds()
            emit(Event.SealEarned(id))
            emit(Event.Xp(MedalXP.perSeal + MedalXP.perBookCompleted, "book"))
        }
        refresh()
    }

    // ---- 评估 + 刷新 ----

    /** 重算勋章 / XP / 等级；新达成的档位入队。云端同步进来也调一次，漏发的在这里补上。 */
    fun refresh(): List<Event> {
        val beforeLevel = level
        val events = ArrayList<Event>()
        for (def in MedalCatalog.all) {
            val v = value(def.metric)
            var top = 0
            for ((i, t) in def.tiers.withIndex()) if (v >= t) top = i + 1
            if (top == 0) continue
            val had = s.earned[def.key]?.tier ?: 0
            if (top > had) {
                s.earned[def.key] = Earned(top, nowSeconds())
                events.add(Event.Medal(def.key, top))
            }
        }
        // 连续天数的历史峰值：只升不降
        if (streakDays > s.bestStreakDays) { s.bestStreakDays = streakDays; dirty = true }
        earned = HashMap(s.earned)
        seals = HashMap(s.seals)
        chaptersReadCount = s.chaptersRead.size
        totalXP = baseXP + s.bonusXP
        level = MedalLevels.level(totalXP)
        if (level > beforeLevel) events.add(Event.LevelUp(level))
        for (e in events) emit(e)
        if (events.any { it is Event.Medal }) dirty = true
        if (dirty) persist()
        return events
    }

    private fun emit(e: Event) {
        // 飘字合并：连着来的 +XP 合成一条，免得刷屏
        val last = pending.lastOrNull()
        if (e is Event.Xp && last is Event.Xp && last.reason == e.reason) {
            pending = pending.dropLast(1) + Event.Xp(last.amount + e.amount, e.reason)
            return
        }
        val next = pending + e
        pending = if (next.size > 24) next.takeLast(24) else next
    }

    fun consume() { if (pending.isNotEmpty()) pending = pending.drop(1) }

    /** 丢到指定事件（含它本身），给弹层「点一下提前关」用 */
    fun consumeThrough(e: Event) {
        val i = pending.indexOf(e)
        pending = if (i < 0) pending else pending.drop(i + 1)
    }

    // ---- 会员同步 ----

    /** 账本里有没有值得上云的东西（空账本不推，免得覆盖别的设备） */
    val hasProgress: Boolean
        get() = s.chaptersRead.isNotEmpty() || s.earned.isNotEmpty() || s.seals.isNotEmpty() ||
            s.versesRead > 0 || s.listenTicks > 0 || s.chaptersOpened > 0 || s.bonusXP > 0 ||
            s.morningDates.isNotEmpty() || s.nightDates.isNotEmpty()

    fun syncJson(): JSONObject {
        val chapters = JSONObject()
        for ((k, v) in s.chaptersRead) chapters.put(k, v.toLong())
        val earnedJson = JSONObject()
        for ((k, e) in s.earned) earnedJson.put(k, JSONObject().put("tier", e.tier).put("at", e.at.toLong()))
        val sealsJson = JSONObject()
        for ((k, v) in s.seals) sealsJson.put(k, v.toLong())
        return JSONObject()
            .put("version", 1)
            .put("chaptersRead", chapters)
            .put("versesRead", s.versesRead)
            .put("listenTicks", s.listenTicks)
            .put("chaptersOpened", s.chaptersOpened)
            .put("morningDates", JSONArray(s.morningDates))
            .put("nightDates", JSONArray(s.nightDates))
            .put("bonusXP", s.bonusXP)
            .put("bestStreakDays", s.bestStreakDays)
            .put("earned", earnedJson)
            .put("seals", sealsJson)
    }

    /** 云端并入本机：所有计数取较大值，集合取并集，勋章取更高档——合并后绝不回退 */
    fun mergeRemote(json: JSONObject) {
        suppressChangeNotify = true
        try {
            (json.opt("chaptersRead") as? JSONObject)?.let { m ->
                for (k in m.keys()) {
                    val at = MemberReadingSyncRules.num(m.opt(k)) ?: 0.0
                    val cur = s.chaptersRead[k]
                    // 首次读完的时间取较早那个
                    s.chaptersRead[k] = if (cur != null) (if (at > 0) minOf(cur, at) else cur) else at
                }
            }
            s.versesRead = maxOf(s.versesRead, (MemberReadingSyncRules.num(json.opt("versesRead")) ?: 0.0).toInt())
            s.listenTicks = maxOf(s.listenTicks, (MemberReadingSyncRules.num(json.opt("listenTicks")) ?: 0.0).toInt())
            s.chaptersOpened = maxOf(s.chaptersOpened, (MemberReadingSyncRules.num(json.opt("chaptersOpened")) ?: 0.0).toInt())
            s.bonusXP = maxOf(s.bonusXP, (MemberReadingSyncRules.num(json.opt("bonusXP")) ?: 0.0).toInt())
            s.bestStreakDays = maxOf(s.bestStreakDays, (MemberReadingSyncRules.num(json.opt("bestStreakDays")) ?: 0.0).toInt())
            s.morningDates = MemberReadingSyncRules
                .normalizeDates(s.morningDates + MemberReadingSyncRules.stringArray(json.opt("morningDates"))).toMutableList()
            s.nightDates = MemberReadingSyncRules
                .normalizeDates(s.nightDates + MemberReadingSyncRules.stringArray(json.opt("nightDates"))).toMutableList()
            (json.opt("earned") as? JSONObject)?.let { m ->
                for (k in m.keys()) {
                    val o = m.optJSONObject(k) ?: continue
                    val tier = (MemberReadingSyncRules.num(o.opt("tier")) ?: 0.0).toInt()
                    if (tier < 1) continue
                    val at = MemberReadingSyncRules.num(o.opt("at")) ?: 0.0
                    if ((s.earned[k]?.tier ?: 0) >= tier) continue
                    s.earned[k] = Earned(tier, at)
                }
            }
            (json.opt("seals") as? JSONObject)?.let { m ->
                for (k in m.keys()) if (s.seals[k] == null) s.seals[k] = MemberReadingSyncRules.num(m.opt(k)) ?: 0.0
            }
        } finally {
            suppressChangeNotify = false
        }
        dirty = true
        refresh()
    }

    /** 换帐号 / 退出：成就跟着帐号走，清空本机 */
    fun clearForAccountSwitch() {
        suppressChangeNotify = true
        s = Snapshot()
        dirty = true
        suppressChangeNotify = false
        pending = emptyList()
        refresh()
    }
}
