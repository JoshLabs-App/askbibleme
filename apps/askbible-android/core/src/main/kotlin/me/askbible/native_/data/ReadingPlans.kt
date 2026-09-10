package me.askbible.native_.data

import java.time.LocalDate

// 读经计划的纯逻辑，逐行对应共享库 lib/bible/reading-plans/* 与 lib/read/*，与 iOS 的 ReadingPlans.swift 对等：
// 日期与历元、偏好、三循环指针、新约深读 52 阶。全部无 IO，可被对拍 harness 直接跑。

/** 对应 lib/read/reading-plan-epoch.ts + reading-plan-prefs 里的本地日期工具 */
object PlanDates {
    const val EASTER_EPOCH = "2026-04-05"

    fun localDateString(d: LocalDate = LocalDate.now()): String =
        "%04d-%02d-%02d".format(d.year, d.monthValue, d.dayOfMonth)

    /** 对应 parseLocalDate：只校验范围（月 1–12、日 1–31），31 日落在小月会像 JS Date 一样顺延 */
    fun parseLocalDate(s: String): Triple<Int, Int, Int>? {
        val t = s.trim()
        val parts = t.split("-")
        if (parts.size != 3 || parts[0].length != 4 || parts[1].length != 2 || parts[2].length != 2) return null
        val y = parts[0].toIntOrNull() ?: return null
        val m = parts[1].toIntOrNull() ?: return null
        val d = parts[2].toIntOrNull() ?: return null
        if (m < 1 || m > 12 || d < 1 || d > 31) return null
        return Triple(y, m, d)
    }

    /** 公历日序号（Howard Hinnant days_from_civil），d 溢出时线性顺延，与 Date.UTC 行为一致 */
    fun daysFromCivil(y0: Int, m: Int, d: Int): Int {
        val y = if (m <= 2) y0 - 1 else y0
        val era = (if (y >= 0) y else y - 399) / 400
        val yoe = y - era * 400
        val mp = (m + 9) % 12
        val doy = (153 * mp + 2) / 5 + d - 1
        val doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
        return era * 146097 + doe - 719468
    }

    fun daysBetween(from: String, to: String): Int {
        val a = parseLocalDate(from) ?: return 0
        val b = parseLocalDate(to) ?: return 0
        return daysFromCivil(b.first, b.second, b.third) - daysFromCivil(a.first, a.second, a.third)
    }

    fun jan1(year: Int): String = "%04d-01-01".format(year)

    /** 自复活节历元起的第几天（≥ 1） */
    fun daySinceEpoch(now: LocalDate = LocalDate.now()): Int =
        maxOf(1, daysBetween(EASTER_EPOCH, localDateString(now)) + 1)

    fun toLocalDate(s: String): LocalDate? {
        val p = parseLocalDate(s) ?: return null
        // JS Date 的日溢出顺延：用日序号回推
        return LocalDate.ofEpochDay(daysFromCivil(p.first, p.second, p.third).toLong())
    }
}

enum class PlanAnchor(val raw: String) {
    FROM_TODAY("from-today"), CALENDAR_JAN1("calendar-jan1"), CALENDAR_EASTER("calendar-easter");
    companion object { fun from(raw: String?): PlanAnchor? = entries.firstOrNull { it.raw == raw } }
}

/** 对应 ReadingPlanPrefs（askbible-reading-plan-prefs-v1） */
data class ReadingPlanPrefs(
    val planId: String,
    val anchor: PlanAnchor,
    val startedOn: String? = null,
    val dayCount: Int? = null,
    val aheadDays: Int? = null,
    val ntDeepRepeatPace: Int? = null,
    val chosen: Boolean? = null,
    val selectedAt: String? = null,
) {
    val ahead: Int get() = maxOf(0, aheadDays ?: 0)
    val isTripleLoop: Boolean get() = planId == ReadingPlanCatalog.TRIPLE_LOOP_ID
    val isNtDeepRepeat: Boolean get() = planId == ReadingPlanCatalog.NT_DEEP_REPEAT_ID
    val isPointerPlan: Boolean get() = isTripleLoop || isNtDeepRepeat

    companion object {
        /** 隐式默认：三循环、复活节历元 */
        fun default(): ReadingPlanPrefs =
            ReadingPlanPrefs(ReadingPlanCatalog.TRIPLE_LOOP_ID, PlanAnchor.CALENDAR_EASTER, PlanDates.EASTER_EPOCH, 1)

        /** 对应 parseReadingPlanPrefs 的归一化：非法就整份作废（JSON 解析交给 app 层） */
        fun fromFields(version: Int?, planId: String?, anchorRaw: String?, startedOn: String?, dayCount: Int?,
                       aheadDays: Int?, pace: Int?, chosen: Boolean?, selectedAt: String?): ReadingPlanPrefs? {
            if (version != 1) return null
            val id = planId?.trim().orEmpty(); if (id.isEmpty()) return null
            val anchor = PlanAnchor.from(anchorRaw) ?: return null
            val started = startedOn?.trim()
            if (anchor == PlanAnchor.FROM_TODAY && started.isNullOrEmpty()) return null
            val p = if (pace != null && NtDeepRepeat.PACES.contains(pace)) pace
                    else if (id == ReadingPlanCatalog.NT_DEEP_REPEAT_ID) NtDeepRepeat.DEFAULT_PACE else null
            return ReadingPlanPrefs(
                planId = id, anchor = anchor,
                startedOn = if (anchor == PlanAnchor.CALENDAR_EASTER) PlanDates.EASTER_EPOCH else started?.takeIf { it.isNotEmpty() },
                dayCount = dayCount?.takeIf { it > 0 }, aheadDays = aheadDays?.takeIf { it > 0 },
                ntDeepRepeatPace = p, chosen = if (chosen == true) true else null, selectedAt = selectedAt,
            )
        }
    }
}

object ReadingPlanRules {
    /** 对应 resolveReadingPlanDayIndex：日历类计划今天对应第几天（0 起，封顶 dayCount-1） */
    fun dayIndex(prefs: ReadingPlanPrefs, dayCount: Int, now: LocalDate = LocalDate.now()): Int {
        if (dayCount < 1) return 0
        val today = PlanDates.localDateString(now)
        var offset = when (prefs.anchor) {
            PlanAnchor.CALENDAR_JAN1 -> PlanDates.daysBetween(PlanDates.jan1(now.year), today)
            PlanAnchor.CALENDAR_EASTER -> PlanDates.daysBetween(PlanDates.EASTER_EPOCH, today)
            PlanAnchor.FROM_TODAY -> PlanDates.daysBetween(prefs.startedOn ?: today, today)
        }
        if (offset < 0) offset = 0
        return if (offset >= dayCount) dayCount - 1 else offset
    }

    /** 加上超前天数后的日课下标 */
    fun effectiveDayIndex(prefs: ReadingPlanPrefs, dayCount: Int, now: LocalDate = LocalDate.now()): Int {
        if (dayCount < 1) return 0
        val next = dayIndex(prefs, dayCount, now) + prefs.ahead
        return minOf(maxOf(0, next), dayCount - 1)
    }

    /** 对应 resolveNtDeepRepeatPlanDay：自选定日起第几天 */
    fun ntPlanDay(prefs: ReadingPlanPrefs, now: LocalDate = LocalDate.now()): Int {
        val today = PlanDates.localDateString(now)
        val start = prefs.startedOn?.trim()?.takeIf { it.isNotEmpty() } ?: today
        return maxOf(1, PlanDates.daysBetween(start, today) + 1)
    }

    /** 对应 resolveEffectiveEpochDay：指针类计划显示的「第 N 天」 */
    fun effectiveEpochDay(prefs: ReadingPlanPrefs, now: LocalDate = LocalDate.now()): Int =
        if (prefs.isNtDeepRepeat) ntPlanDay(prefs, now) + prefs.ahead else PlanDates.daySinceEpoch(now) + prefs.ahead
}

data class PlanPointer(val bookId: String, val chapter: Int)

/** 对应 ReadingPlanRange（节号是提示，章链接只用 startChapter） */
data class PlanReading(
    val bookId: String,
    val startChapter: Int,
    val endChapter: Int,
    val startVerse: Int? = null,
    val endVerse: Int? = null,
    val label: String = "",
) {
    /** 对应 formatReadingPlanRange（不带 locale 的那条分支）：「创世记 1」「创世记 1–3」「创世记 1:1–5」 */
    val display: String get() {
        val name = BibleCatalog.book(bookId)?.name(AppLocale.current) ?: bookId
        if (startChapter == endChapter) {
            if (startVerse != null && endVerse != null) {
                return if (startVerse == endVerse) "$name $startChapter:$startVerse" else "$name $startChapter:$startVerse–$endVerse"
            }
            return "$name $startChapter"
        }
        if (startVerse != null && endVerse != null) return "$name $startChapter:$startVerse–$endChapter:$endVerse"
        return "$name $startChapter–$endChapter"
    }

    /** 展开成逐章队列 */
    val chapters: List<PlanPointer> get() {
        val s = maxOf(1, startChapter); val e = maxOf(s, endChapter)
        return (s..e).map { PlanPointer(bookId, it) }
    }
}

enum class TripleTrack(val raw: String) { OT("ot"), NT("nt"), WISDOM("wisdom") }

/** 对应 TripleLoopReadingState（归一化后的形态：chaptersRead 永远是列表长度） */
data class TripleLoopState(
    val ot: PlanPointer,
    val nt: PlanPointer,
    val wisdom: PlanPointer,
    val chaptersReadKeys: Map<String, List<String>> = mapOf("ot" to emptyList(), "nt" to emptyList(), "wisdom" to emptyList()),
    val chaptersRead: Map<String, Int> = mapOf("ot" to 0, "nt" to 0, "wisdom" to 0),
    val startedAt: String? = null,
) {
    operator fun get(track: TripleTrack): PlanPointer = when (track) { TripleTrack.OT -> ot; TripleTrack.NT -> nt; TripleTrack.WISDOM -> wisdom }
    fun with(track: TripleTrack, p: PlanPointer): TripleLoopState = when (track) {
        TripleTrack.OT -> copy(ot = p); TripleTrack.NT -> copy(nt = p); TripleTrack.WISDOM -> copy(wisdom = p)
    }
}

object TripleLoop {
    val WISDOM_IDS = listOf("JOB", "PSA", "PRO", "ECC", "SNG")
    private val ntStart = BibleCatalog.all.indexOfFirst { it.id == "MAT" }.let { if (it < 0) BibleCatalog.all.size else it }
    val OT_ORDER: List<String> = BibleCatalog.all.take(ntStart).filter { it.id !in WISDOM_IDS }.map { it.id }
    val NT_ORDER: List<String> = BibleCatalog.all.drop(ntStart).map { it.id }
    val WISDOM_ORDER: List<String> = WISDOM_IDS
    /** 圣经首页今日读经展示顺序：新约 → 智慧诗 → 旧约 */
    val DISPLAY_TRACKS = listOf(TripleTrack.NT, TripleTrack.WISDOM, TripleTrack.OT)

    fun order(track: TripleTrack): List<String> = when (track) { TripleTrack.OT -> OT_ORDER; TripleTrack.NT -> NT_ORDER; TripleTrack.WISDOM -> WISDOM_ORDER }
    fun chapters(bookId: String): Int = BibleCatalog.book(bookId)?.chapterCount ?: 0

    fun defaultState() = TripleLoopState(PlanPointer("GEN", 1), PlanPointer("MAT", 1), PlanPointer("JOB", 1))

    private fun normalizePointer(bookId: String, chapter: Int, order: List<String>): PlanPointer {
        val first = order.firstOrNull() ?: return PlanPointer("GEN", 1)
        val bid = if (bookId in order) bookId else first
        val max = chapters(bid)
        if (max < 1) return PlanPointer(first, 1)
        return PlanPointer(bid, minOf(maxOf(1, chapter), max))
    }

    /** 对应 normalizeTripleLoopChaptersReadKeys：只留含冒号的字符串，去重保序 */
    fun normalizeKeys(raw: Map<String, List<String>>?): Map<String, List<String>> =
        TripleTrack.entries.associate { t -> t.raw to (raw?.get(t.raw) ?: emptyList()).filter { it.contains(":") }.distinct() }

    /** 对应 normalizeTripleLoopReadingState */
    fun normalize(raw: TripleLoopState?): TripleLoopState {
        val d = defaultState()
        if (raw == null) return d
        val keys = normalizeKeys(raw.chaptersReadKeys)
        val started = raw.startedAt?.trim()?.takeIf { it.isNotEmpty() }
        return TripleLoopState(
            ot = normalizePointer(raw.ot.bookId.ifEmpty { d.ot.bookId }, if (raw.ot.chapter == 0) 1 else raw.ot.chapter, OT_ORDER),
            nt = normalizePointer(raw.nt.bookId.ifEmpty { d.nt.bookId }, if (raw.nt.chapter == 0) 1 else raw.nt.chapter, NT_ORDER),
            wisdom = normalizePointer(raw.wisdom.bookId.ifEmpty { d.wisdom.bookId }, if (raw.wisdom.chapter == 0) 1 else raw.wisdom.chapter, WISDOM_ORDER),
            chaptersReadKeys = keys,
            chaptersRead = keys.mapValues { it.value.size },
            startedAt = started,
        )
    }

    fun advancePointer(p: PlanPointer, order: List<String>): PlanPointer {
        val maxCh = chapters(p.bookId)
        val idx = order.indexOf(p.bookId).let { if (it < 0) 0 else it }
        if (maxCh >= 1 && p.chapter < maxCh) return PlanPointer(p.bookId, p.chapter + 1)
        return PlanPointer(order[(idx + 1) % order.size], 1)
    }

    fun advanceTrack(state: TripleLoopState, track: TripleTrack): TripleLoopState = state.with(track, advancePointer(state[track], order(track)))

    fun advanceOneDay(state: TripleLoopState): TripleLoopState {
        var s = state
        for (t in TripleTrack.entries) s = s.with(t, advancePointer(state[t], order(t)))
        return s
    }

    fun stateForPlanDay(planDay: Int): TripleLoopState {
        var s = defaultState()
        repeat(maxOf(0, planDay - 1)) { s = advanceOneDay(s) }
        return s
    }

    fun pointerProgress(p: PlanPointer, order: List<String>): Int = order.indexOf(p.bookId).let { if (it < 0) 0 else it } * 10_000 + p.chapter

    fun pointersEqual(a: TripleLoopState, b: TripleLoopState): Boolean = TripleTrack.entries.all { a[it] == b[it] }

    /** 对应 snapTripleLoopStateToPlanDay：任一轨落后于日历位置就抬到日历位置 */
    fun snapToPlanDay(state: TripleLoopState, planDay: Int): TripleLoopState {
        val floor = stateForPlanDay(planDay)
        var next = state
        for (t in TripleTrack.entries) {
            val o = order(t)
            next = next.with(t, if (pointerProgress(state[t], o) >= pointerProgress(floor[t], o)) state[t] else floor[t])
        }
        return normalize(next.copy(chaptersReadKeys = state.chaptersReadKeys, startedAt = state.startedAt))
    }

    /** 对应 clipCoordinatedTripleLoopAheadToPlanDay：三轨齐齐超前（多半是超前天数回退了）才整体拉回 */
    fun clipCoordinatedAhead(state: TripleLoopState, planDay: Int): TripleLoopState {
        val floor = stateForPlanDay(planDay)
        val allAhead = TripleTrack.entries.all { pointerProgress(state[it], order(it)) > pointerProgress(floor[it], order(it)) }
        if (!allAhead) return state
        return normalize(floor.copy(chaptersReadKeys = state.chaptersReadKeys, startedAt = state.startedAt))
    }

    /** 对应 resolveEffectiveTripleLoopProgress */
    fun resolveEffective(stored: TripleLoopState, hasSaved: Boolean, now: LocalDate = LocalDate.now(), aheadDays: Int = 0): TripleLoopState {
        val planDay = maxOf(1, PlanDates.daySinceEpoch(now) + maxOf(0, aheadDays))
        val base = if (hasSaved) stored else stateForPlanDay(PlanDates.daySinceEpoch(now)).copy(startedAt = PlanDates.EASTER_EPOCH)
        return clipCoordinatedAhead(snapToPlanDay(base, planDay), planDay)
    }

    fun trackFor(bookId: String): TripleTrack? = when {
        bookId in OT_ORDER -> TripleTrack.OT
        bookId in NT_ORDER -> TripleTrack.NT
        bookId in WISDOM_ORDER -> TripleTrack.WISDOM
        else -> null
    }

    fun chapterKey(bookId: String, chapter: Int): String = "${bookId.trim().uppercase()}:$chapter"

    /** 对应 addUserChapterReadToState */
    fun addChapterRead(state: TripleLoopState, bookId: String, chapter: Int): TripleLoopState {
        val track = trackFor(bookId) ?: return state
        val key = chapterKey(bookId, chapter)
        val keys = normalizeKeys(state.chaptersReadKeys).toMutableMap()
        if (key in keys[track.raw]!!) return state
        keys[track.raw] = keys[track.raw]!! + key
        return state.copy(chaptersReadKeys = keys, chaptersRead = keys.mapValues { it.value.size })
    }

    fun trackTitle(track: TripleTrack): String = when (track) { TripleTrack.OT -> PlanCopy.t("pages.read.tripleLoopTrackOt"); TripleTrack.NT -> PlanCopy.t("pages.read.tripleLoopTrackNt"); TripleTrack.WISDOM -> PlanCopy.t("pages.read.tripleLoopTrackWisdom") }

    /** 「创世记 第 1 章」「诗篇 第 23 篇」 */
    fun formatVerbose(bookId: String, chapter: Int): String {
        val name = BibleCatalog.book(bookId)?.name(AppLocale.current) ?: bookId
        return PlanCopy.f("pages.read.tripleLoopReadingLine", mapOf("name" to name, "chapter" to "$chapter", "unit" to PlanCopy.t(if (bookId == "PSA") "pages.read.tripleLoopPsalmUnit" else "pages.read.tripleLoopChapterUnit")))
    }

    fun trackChapterTotal(track: TripleTrack): Int = order(track).sumOf { chapters(it) }

    fun chaptersBefore(track: TripleTrack, p: PlanPointer): Int {
        val o = order(track)
        val idx = o.indexOf(p.bookId); if (idx < 0) return 0
        val before = o.take(idx).sumOf { chapters(it) }
        val maxCh = maxOf(1, chapters(p.bookId))
        return before + minOf(maxOf(1, p.chapter), maxCh) - 1
    }

    /** 对应 computeTripleLoopTrackBarProgress */
    fun barProgress(state: TripleLoopState, track: TripleTrack, currentChapterFraction: Double = 0.0): Double {
        val total = trackChapterTotal(track); if (total <= 0) return 0.0
        val frac = currentChapterFraction.coerceIn(0.0, 1.0)
        return ((chaptersBefore(track, state[track]) + frac) / total).coerceIn(0.0, 1.0)
    }

    /** 对应 buildTripleLoopReadingPlanDay：新约 → 智慧诗 → 旧约 */
    fun readings(state: TripleLoopState): List<PlanReading> = DISPLAY_TRACKS.map { t ->
        val p = state[t]
        PlanReading(p.bookId, p.chapter, p.chapter, label = "${trackTitle(t)}：${formatVerbose(p.bookId, p.chapter)}")
    }
}

data class NtSegment(val ranges: List<PlanReading>) {
    val key: String get() = ranges.joinToString("|") { "${it.bookId}:${it.startChapter}-${it.endChapter}" }
    val primary: PlanReading get() = ranges[0]
    fun includes(bookId: String, chapter: Int): Boolean {
        val id = bookId.trim().uppercase()
        return ranges.any { it.bookId == id && chapter >= it.startChapter && chapter <= it.endChapter }
    }
}

/** 对应 NtDeepRepeatReadingState */
data class NtDeepRepeatState(
    val ot: PlanPointer,
    val curriculumIndex: Int,
    val dayInSegment: Int,
    val pace: Int,
    val segmentDayTarget: Int,
    val chaptersReadKeys: Map<String, List<String>> = mapOf("ot" to emptyList(), "nt" to emptyList()),
    val chaptersRead: Map<String, Int> = mapOf("ot" to 0, "nt" to 0),
    val startedAt: String? = null,
)

enum class NtTrack(val raw: String) { OT("ot"), NT("nt") }

object NtDeepRepeat {
    val PACES = listOf(7, 14, 28)
    const val DEFAULT_PACE = 7
    /** 与 nt-deep-repeat-curriculum.ts 的 CURRICULUM_UNITS 同：单元内按章累计切分 */
    val UNITS: List<Pair<List<String>, List<Int>>> = listOf(
        listOf("1JN") to listOf(5), listOf("JHN") to listOf(5, 5, 5, 6), listOf("PHP", "COL") to listOf(4, 4),
        listOf("MAT") to listOf(4, 4, 4, 4, 4, 4, 4), listOf("ACT") to listOf(4, 4, 4, 4, 4, 4, 4), listOf("MRK") to listOf(5, 5, 6),
        listOf("ROM") to listOf(5, 5, 6), listOf("GAL") to listOf(6), listOf("EPH") to listOf(6), listOf("1TH", "2TH") to listOf(5, 3),
        listOf("1CO") to listOf(5, 5, 6), listOf("2CO") to listOf(5, 5, 3), listOf("1TI") to listOf(6), listOf("2TI", "TIT", "PHM") to listOf(4, 4),
        listOf("HEB") to listOf(5, 5, 3), listOf("1PE", "2PE") to listOf(5, 3), listOf("JAS", "2JN", "3JN", "JUD") to listOf(5, 3),
        listOf("REV") to listOf(5, 5, 5, 4, 3),
    )
    val NT_BOOK_IDS: List<String> = UNITS.flatMap { it.first }.distinct()
    private val ntStart = BibleCatalog.all.indexOfFirst { it.id == "MAT" }.let { if (it < 0) BibleCatalog.all.size else it }
    val OT_ORDER: List<String> = BibleCatalog.all.take(ntStart).map { it.id }

    val CURRICULUM: List<NtSegment> = buildList {
        for ((bookIds, sizes) in UNITS) {
            val total = bookIds.sumOf { TripleLoop.chapters(it) }
            check(sizes.sum() == total) { "nt-deep-repeat curriculum: $bookIds sizes != chapters" }
            var absStart = 1
            for (size in sizes) {
                val absEnd = absStart + size - 1
                val ranges = ArrayList<PlanReading>()
                var offset = 0
                for (b in bookIds) {
                    val ch = TripleLoop.chapters(b)
                    val bookStart = offset + 1; val bookEnd = offset + ch
                    val s = maxOf(absStart, bookStart); val e = minOf(absEnd, bookEnd)
                    if (s <= e) ranges.add(PlanReading(b, s - offset, e - offset))
                    offset += ch
                }
                add(NtSegment(ranges))
                absStart = absEnd + 1
            }
        }
        check(size == 52) { "nt-deep-repeat curriculum: expected 52 stages" }
    }
    val STAGE_COUNT: Int get() = CURRICULUM.size

    fun segment(index: Int): NtSegment? {
        if (CURRICULUM.isEmpty()) return null
        val n = CURRICULUM.size
        return CURRICULUM[((index % n) + n) % n]
    }

    fun isPace(v: Int?): Boolean = v != null && v in PACES
    fun oneCycleDays(pace: Int): Int = STAGE_COUNT * pace

    fun formatApproxDurationZh(days: Int): String {
        if (days < 60) return SiteCopy.f("native.durationDays", mapOf("n" to "$days"))
        val months = days / 30.44
        if (months < 18) return SiteCopy.f("native.durationMonths", mapOf("n" to "${Math.round(months)}"))
        return SiteCopy.f("native.durationYears", mapOf("n" to "%.1f".format(days / 365.25)))
    }

    fun defaultState(pace: Int = DEFAULT_PACE, now: LocalDate = LocalDate.now()): NtDeepRepeatState =
        NtDeepRepeatState(PlanPointer("GEN", 1), 0, 1, pace, pace, startedAt = PlanDates.localDateString(now))

    private fun normalizePointer(bookId: String, chapter: Int): PlanPointer {
        val first = OT_ORDER.firstOrNull() ?: return PlanPointer("GEN", 1)
        val bid = if (bookId in OT_ORDER) bookId else first
        val max = TripleLoop.chapters(bid)
        if (max < 1) return PlanPointer(bid, 1)
        return PlanPointer(bid, minOf(maxOf(1, chapter), max))
    }

    fun normalizeKeys(raw: Map<String, List<String>>?): Map<String, List<String>> =
        mapOf("ot" to (raw?.get("ot") ?: emptyList()).filter { it.isNotEmpty() }, "nt" to (raw?.get("nt") ?: emptyList()).filter { it.isNotEmpty() })

    fun segmentDayTarget(state: NtDeepRepeatState): Int = if (state.segmentDayTarget > 0) state.segmentDayTarget else state.pace

    /** 对应 normalizeNtDeepRepeatReadingState */
    fun normalize(raw: NtDeepRepeatState?, now: LocalDate = LocalDate.now()): NtDeepRepeatState {
        val pace = if (isPace(raw?.pace)) raw!!.pace else DEFAULT_PACE
        val startedAt = raw?.startedAt?.trim()?.takeIf { it.isNotEmpty() } ?: PlanDates.localDateString(now)
        val d = defaultState(pace, now).copy(startedAt = startedAt)
        if (raw == null) return d
        val idx = maxOf(0, raw.curriculumIndex)
        val target = if (raw.segmentDayTarget > 0) raw.segmentDayTarget else pace
        val day = minOf(target, maxOf(1, raw.dayInSegment))
        val keys = normalizeKeys(raw.chaptersReadKeys)
        return NtDeepRepeatState(
            ot = normalizePointer(raw.ot.bookId.ifEmpty { "GEN" }, if (raw.ot.chapter == 0) 1 else raw.ot.chapter),
            curriculumIndex = idx, dayInSegment = day, pace = pace, segmentDayTarget = target,
            chaptersReadKeys = keys, chaptersRead = keys.mapValues { it.value.size }, startedAt = startedAt,
        )
    }

    fun currentSegment(state: NtDeepRepeatState): NtSegment? = segment(state.curriculumIndex)

    fun trackFor(bookId: String): NtTrack? {
        val id = bookId.trim().uppercase()
        return when { id in OT_ORDER -> NtTrack.OT; id in NT_BOOK_IDS -> NtTrack.NT; else -> null }
    }

    fun chapterKey(bookId: String, chapter: Int): String = "${bookId.trim().uppercase()}:${maxOf(1, chapter)}"

    fun addChapterRead(state: NtDeepRepeatState, bookId: String, chapter: Int, track: NtTrack? = null): NtDeepRepeatState {
        val t = track ?: trackFor(bookId) ?: return state
        val key = chapterKey(bookId, chapter)
        val keys = normalizeKeys(state.chaptersReadKeys).toMutableMap()
        if (key in keys[t.raw]!!) return state
        keys[t.raw] = keys[t.raw]!! + key
        return state.copy(chaptersReadKeys = keys, chaptersRead = keys.mapValues { it.value.size })
    }

    fun advanceOtPointer(p: PlanPointer): PlanPointer {
        val maxCh = TripleLoop.chapters(p.bookId)
        val idx = OT_ORDER.indexOf(p.bookId).let { if (it < 0) 0 else it }
        if (maxCh >= 1 && p.chapter < maxCh) return PlanPointer(p.bookId, p.chapter + 1)
        return PlanPointer(OT_ORDER[(idx + 1) % OT_ORDER.size], 1)
    }

    fun advanceOtTrack(state: NtDeepRepeatState): NtDeepRepeatState {
        val s = addChapterRead(state, state.ot.bookId, state.ot.chapter, NtTrack.OT)
        return s.copy(ot = advanceOtPointer(s.ot))
    }

    private fun stepSegment(state: NtDeepRepeatState): Triple<Int, Int, Int> {
        val target = segmentDayTarget(state)
        var day = state.dayInSegment + 1; var idx = state.curriculumIndex; var next = target
        if (day > target) { day = 1; idx = (state.curriculumIndex + 1) % maxOf(1, CURRICULUM.size); next = state.pace }
        return Triple(idx, day, next)
    }

    /** 只推进新约：本阶读满就换段，并把本阶各章记为已读；旧约不动 */
    fun advanceNtDay(state: NtDeepRepeatState): NtDeepRepeatState {
        val seg = currentSegment(state)
        val (idx, day, target) = stepSegment(state)
        var s = state.copy(curriculumIndex = idx, dayInSegment = day, segmentDayTarget = target)
        if (seg != null) for (r in seg.ranges) for (ch in r.startChapter..maxOf(r.startChapter, r.endChapter)) s = addChapterRead(s, r.bookId, ch, NtTrack.NT)
        return s
    }

    fun advanceOneDay(state: NtDeepRepeatState): NtDeepRepeatState {
        val (idx, day, target) = stepSegment(state)
        return state.copy(ot = advanceOtPointer(state.ot), curriculumIndex = idx, dayInSegment = day, segmentDayTarget = target)
    }

    /** 对应 ntDeepRepeatStateForPlanDay */
    fun stateForPlanDay(planDay: Int, pace: Int = DEFAULT_PACE, startedAt: String? = null, now: LocalDate = LocalDate.now()): NtDeepRepeatState {
        val start = startedAt?.let { PlanDates.toLocalDate(it) } ?: now
        var s = defaultState(pace, start)
        if (startedAt != null) s = s.copy(startedAt = startedAt)
        for (i in 1 until maxOf(1, planDay)) s = advanceOneDay(s)
        return s
    }

    fun score(s: NtDeepRepeatState): Int = s.curriculumIndex * 1000 + s.dayInSegment

    /** 对应 inferNtDeepRepeatPlanDayFromProgress */
    fun inferPlanDay(raw: NtDeepRepeatState?, startedOn: String): Int {
        val target = normalize(raw)
        val targetScore = score(target)
        var best = 1
        for (d in 1..4000) {
            val implied = stateForPlanDay(d, target.pace, startedOn)
            if (score(implied) <= targetScore) best = d else break
        }
        return best
    }

    fun pointersEqual(a: NtDeepRepeatState, b: NtDeepRepeatState): Boolean =
        a.ot == b.ot && a.curriculumIndex == b.curriculumIndex && a.dayInSegment == b.dayInSegment && a.segmentDayTarget == b.segmentDayTarget

    /** 对应 alignNtDeepRepeatProgressToCalendar */
    fun alignToCalendar(stored: NtDeepRepeatState, prefs: ReadingPlanPrefs, now: LocalDate = LocalDate.now()): NtDeepRepeatState {
        if (!prefs.isNtDeepRepeat) return stored
        val startedAt = listOf(prefs.startedOn, stored.startedAt).mapNotNull { it?.trim() }.firstOrNull { it.isNotEmpty() } ?: PlanDates.localDateString(now)
        val pace = prefs.ntDeepRepeatPace ?: stored.pace
        val calendarPlanDay = ReadingPlanRules.ntPlanDay(prefs, now) + prefs.ahead
        val calendarState = stateForPlanDay(calendarPlanDay, pace, startedAt, now)
        val storedPlanDay = inferPlanDay(stored, startedAt)
        val keys = normalizeKeys(stored.chaptersReadKeys)
        val base = if (storedPlanDay > calendarPlanDay) stored.copy(ot = calendarState.ot) else calendarState
        return normalize(base.copy(pace = pace, startedAt = startedAt, chaptersReadKeys = keys), now)
    }

    /** 对应 buildNtDeepRepeatReadingPlanDay：本阶各段，再加旧约一章 */
    fun readings(state: NtDeepRepeatState): List<PlanReading> =
        (currentSegment(state)?.ranges ?: emptyList()) + PlanReading(state.ot.bookId, state.ot.chapter, state.ot.chapter)

    fun trackTitle(track: NtTrack): String =
        if (track == NtTrack.OT) PlanCopy.t("pages.read.ntDeepRepeatTrackOt") else PlanCopy.t("pages.read.ntDeepRepeatTrackNt")

    /** 「约翰福音 第 1–5 章」/「约翰一书 第 5 章」 */
    fun rangeLine(r: PlanReading): String {
        val name = BibleCatalog.book(r.bookId)?.name(AppLocale.current) ?: r.bookId
        return if (r.startChapter == r.endChapter)
            PlanCopy.f("pages.read.ntDeepRepeatStageBookSingle", mapOf("name" to name, "chapter" to "${r.startChapter}"))
        else PlanCopy.f("pages.read.ntDeepRepeatStageBookRange", mapOf("name" to name, "start" to "${r.startChapter}", "end" to "${r.endChapter}"))
    }

    fun stageRange(seg: NtSegment): String = seg.ranges.joinToString(PlanCopy.t("pages.read.ntDeepRepeatLabelSep")) { rangeLine(it) }

    fun segmentLabel(seg: NtSegment, day: Int, total: Int): String =
        PlanCopy.f("pages.read.ntDeepRepeatSegmentLabel", mapOf("day" to "$day", "total" to "$total", "segment" to stageRange(seg)))

    /** 「创世记 第 1 章」/「诗篇 第 23 篇」（formatNtDeepRepeatOtLine） */
    fun otLine(bookId: String, chapter: Int): String {
        val name = BibleCatalog.book(bookId)?.name(AppLocale.current) ?: bookId
        val unit = if (bookId == "PSA") PlanCopy.t("pages.read.tripleLoopPsalmUnit") else PlanCopy.t("pages.read.tripleLoopChapterUnit")
        return PlanCopy.f("pages.read.tripleLoopReadingLine", mapOf("name" to name, "chapter" to "$chapter", "unit" to unit))
    }
}
