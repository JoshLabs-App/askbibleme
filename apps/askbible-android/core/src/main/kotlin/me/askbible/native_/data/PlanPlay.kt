package me.askbible.native_.data

import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.ceil

/**
 * 读经计划播放页（中央键那页）的纯逻辑，对应 RN ReadPlanPlayScreen / ReadPlanPlayMonthCalendar /
 * lib/read/plan-play-content-ahead。页面状态：viewAhead = 日历上点选的日子相对系统今天的偏移；
 * committedAhead = prefs.aheadDays（用户确认过的「进度超前」天数）；两者相加才是列表要显示的那一天。
 */
object PlanPlay {
    /** resolvePlanPlayContentAhead：黑底永远是系统今天，aheadDays 平移整本日历 */
    fun contentAhead(view: Int, committed: Int): Int = view + maxOf(0, committed)

    /** 日历某天能不能点：指针型计划（三循环 / 深读）任意天都行；日课表要落在 0 until dayCount 内 */
    fun isAheadSelectable(prefs: ReadingPlanPrefs, dayCount: Int?, ahead: Int, now: LocalDate = LocalDate.now()): Boolean {
        if (prefs.isPointerPlan) return true
        val count = dayCount ?: prefs.dayCount ?: 365
        if (count < 1) return false
        val dayIndex = ReadingPlanRules.dayIndex(prefs, count, now) + ahead
        return dayIndex in 0 until count
    }

    /** 列表抬头「第 N 天」：指针型 = 日历第几天 + 偏移；日课表 = 下标 + 1 + 偏移 */
    fun planDayNumber(prefs: ReadingPlanPrefs, dayCount: Int?, contentAhead: Int, now: LocalDate = LocalDate.now()): Int {
        if (prefs.isTripleLoop) return maxOf(1, PlanDates.daySinceEpoch(now) + contentAhead)
        if (prefs.isNtDeepRepeat) return maxOf(1, ReadingPlanRules.ntPlanDay(prefs, now) + contentAhead)
        val count = dayCount ?: prefs.dayCount ?: 365
        return ReadingPlanRules.dayIndex(prefs, count, now) + 1 + contentAhead
    }

    /** 日课表某一天的下标（浏览别的日子时按日历下标 + 偏移，夹在表内） */
    fun registryDayIndex(prefs: ReadingPlanPrefs, dayCount: Int, contentAhead: Int, now: LocalDate = LocalDate.now()): Int {
        if (dayCount < 1) return 0
        val idx = ReadingPlanRules.dayIndex(prefs, dayCount, now) + contentAhead
        return idx.coerceIn(0, dayCount - 1)
    }

    // ---- 月历 ----

    data class CalendarCell(
        /** null = 月首月尾的空格 */
        val day: Int?,
        val ahead: Int,
        val selectable: Boolean,
        val isToday: Boolean,
        val isSelected: Boolean,
        val isListened: Boolean,
        val iso: String,
    )

    val WEEKDAYS_ZH = listOf("日", "一", "二", "三", "四", "五", "六")
    val WEEKDAYS_EN = listOf("Su", "Mo", "Tu", "We", "Th", "Fr", "Sa")

    /** 某年某月的格子，按周分行（周日起）。`today` 是系统今天，`selectable(ahead)` 由计划决定。 */
    fun monthGrid(year: Int, month: Int, today: LocalDate, viewAhead: Int, listened: Set<String>,
                  selectable: (Int) -> Boolean): List<List<CalendarCell>> {
        val todayCivil = PlanDates.daysFromCivil(today.year, today.monthValue, today.dayOfMonth)
        val first = LocalDate.of(year, month, 1)
        // DayOfWeek.value：1 = 周一 … 7 = 周日 → 周日起算的 pad
        val startPad = first.dayOfWeek.value % 7
        val daysInMonth = YearMonth.of(year, month).lengthOfMonth()
        val total = ceil((startPad + daysInMonth) / 7.0).toInt() * 7
        val cells = ArrayList<CalendarCell>(total)
        for (i in 0 until total) {
            val dayNum = i - startPad + 1
            if (dayNum < 1 || dayNum > daysInMonth) {
                cells.add(CalendarCell(null, 0, false, isToday = false, isSelected = false, isListened = false, iso = ""))
                continue
            }
            val ahead = PlanDates.daysFromCivil(year, month, dayNum) - todayCivil
            val iso = "%04d-%02d-%02d".format(year, month, dayNum)
            cells.add(CalendarCell(dayNum, ahead, selectable(ahead), isToday = ahead == 0, isSelected = ahead == viewAhead,
                isListened = iso in listened, iso = iso))
        }
        return cells.chunked(7)
    }

    fun monthLabel(locale: AppLocale, year: Int, month: Int): String {
        if (locale == AppLocale.EN) return LocalDate.of(year, month, 1).format(DateTimeFormatter.ofPattern("MMMM yyyy", Locale.US))
        return locale.zh(PlanCopy.f("pages.read.planPlayCalendarMonth", mapOf("y" to "$year", "m" to "$month")))
    }

    /** 对拍用：一行一个周，格子写成 d:ahead:flags（T 今天 / S 选中 / L 听过 / x 不可选），空格写 _ */
    fun describe(rows: List<List<CalendarCell>>): String = rows.joinToString("|") { row ->
        row.joinToString(",") { c ->
            val d = c.day ?: return@joinToString "_"
            val flags = buildString {
                if (c.isToday) append('T')
                if (c.isSelected) append('S')
                if (c.isListened) append('L')
                if (!c.selectable) append('x')
            }
            "$d:${c.ahead}:$flags"
        }
    }

    fun isoDate(date: LocalDate): String = PlanDates.localDateString(date)
}
