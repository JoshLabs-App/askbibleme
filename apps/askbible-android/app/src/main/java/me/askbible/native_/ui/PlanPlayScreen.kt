package me.askbible.native_.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.askbible.native_.data.BookRef
import me.askbible.native_.audio.ChapterAudioPlayer
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.BibleCatalog
import me.askbible.native_.data.Brand
import me.askbible.native_.data.NtDeepRepeat
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.PlanCopy
import me.askbible.native_.data.PlanDates
import me.askbible.native_.data.PlanPlay
import me.askbible.native_.data.PlanPointer
import me.askbible.native_.data.ReadChrome
import me.askbible.native_.data.ReadingPlanCatalog
import me.askbible.native_.data.ReadingPlanPrefs
import me.askbible.native_.data.ShellMetrics
import me.askbible.native_.data.name
import me.askbible.native_.home.ReadingPlanStore
import java.time.LocalDate

/**
 * 读经计划播放页（底栏中央键那页，主页级页面，底栏照常）。对应 RN ReadPlanPlayScreen：
 * 计划名 + 齿轮 → 月历（黑底 = 系统今天，黄底 = 选中 / 听过）→ 「进度设置为今日」→ 今日读经逐章列表
 * （单击点播、双击进阅读页、行尾「阅读」「声音」）→ 深读的 52 阶（点选设为今日）。底部播放坞由 MainActivity 挂。
 * 队列 / 正在播的下标由宿主算好传进来：本页只管「看哪天」（viewAhead）和「选中哪章」（cursor）。
 */
@Composable
fun PlanPlayScreen(
    store: ReadingPlanStore,
    audio: ChapterAudioPlayer,
    locale: AppLocale,
    queue: List<PlanPointer>,
    activeIndex: Int,
    activePlaying: Boolean,
    viewAhead: Int,
    onViewAhead: (Int) -> Unit,
    cursor: Int,
    onCursor: (Int) -> Unit,
    onPlayChapter: (Int) -> Unit,
    onReadChapter: (Int) -> Unit,
    onOpenPlans: () -> Unit,
    /** 书卷名：跟当前版本（点这一行进去读的就是它）；默认退回目录里的中英名 */
    bookLabel: (BookRef) -> String = { it.name(AppLocale.current) },
    onConfirmDay: () -> Unit,
    onStageSet: () -> Unit,
    theme: Parchment = LocalParchment.current,
    /** 习惯统计里的已读日（云端同步下来的也在）；月历标黄 = 它 ∪ 播放页点听日（RN habitCompletedDates） */
    habitDates: Set<String> = emptySet(),
    /** 每日灵修卡片（D-7：入口只在计划页；只在中文界面，壳里决定 show） */
    autoReadDevotional: Boolean = false,
    onAutoReadDevotional: (Boolean) -> Unit = {},
    showDevotional: Boolean = false,
    devotionalPlayer: me.askbible.native_.audio.DevotionalPlayer? = null,
    onOpenDevotional: (java.time.LocalDate) -> Unit = {},
    onRetryDevotional: () -> Unit = {},
) {
    val prefs = store.prefs
    val committedAhead = prefs.ahead
    val contentAhead = PlanPlay.contentAhead(viewAhead, committedAhead)
    val browsingAway = contentAhead != committedAhead
    // 点选今天之后的日期时可确认：把进度调到该日对应内容
    val needsConfirm = browsingAway && viewAhead >= 0
    val dayCount = ReadingPlanCatalog.plan(prefs.planId)?.dayCount ?: prefs.dayCount
    val planName = locale.zh(ReadingPlanCatalog.plan(prefs.planId)?.title ?: PlanCopy.t("pages.read.planPlayTitle"))
    val dayMeta = locale.zh(me.askbible.native_.data.SiteCopy.f("native.planDayMeta", mapOf("n" to "${PlanPlay.planDayNumber(prefs, dayCount, contentAhead, tripleBaseDay = store.triplePlanDay())}"), locale))
    var stageToConfirm by remember { mutableStateOf<Int?>(null) }
    var monthExpanded by remember { mutableStateOf(false) }
    val ink = theme.ink.toColor()
    val muted = theme.muted.toColor()
    val faint = theme.faint.toColor()
    val accent = theme.accentOt.toColor()
    val busy = audio.isLoading && audio.wantsPlayback
    val allReadDates = store.listenedDates + habitDates

    Box(Modifier.fillMaxSize()) {
        ParchmentBackground(theme = theme)
        val bottom = shellTabBarBottomInset() + (ShellMetrics.tabRowHeight + ShellMetrics.tabBarDockGap + 24f).dp +
            (if (queue.isNotEmpty()) ShellMetrics.dockContentHeight.dp else 0.dp)
        LazyColumn(
            Modifier.fillMaxSize().statusBarsPadding(),
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 16.dp, bottom = bottom),
        ) {
            item {
                // 顶栏：「今日同行」+「换计划」胶囊（与 iOS PlanPlayView 对齐）
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            AppLocale.pick("今日同行", "Today's Walk", locale),
                            color = ink,
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            "$planName · $dayMeta",
                            color = muted,
                            fontSize = 13.5.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.padding(top = 3.dp),
                        )
                    }
                    Row(
                        Modifier
                            .clip(RoundedCornerShape(999.dp))
                            .background(theme.surface.toColor())
                            .border(1.dp, theme.border.toColor(), RoundedCornerShape(999.dp))
                            .clickableNoRipple(onOpenPlans)
                            .padding(horizontal = 13.dp, vertical = 7.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(AppLocale.pick("换计划", "Plans", locale), color = ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
                Spacer(Modifier.height(16.dp))
            }
            if (queue.isEmpty() && !browsingAway) {
                item {
                    Text(locale.zh(PlanCopy.t("pages.read.todayPlanEmpty")), Modifier.fillMaxWidth().padding(top = 48.dp),
                         color = muted, fontSize = 16.sp, textAlign = TextAlign.Center)
                }
            } else {
                item {
                    // 默认 7 日温和周视图条；点击月份展开完整月历
                    PlanGentleWeekCard(
                        locale = locale,
                        prefs = prefs,
                        dayCount = dayCount,
                        viewAhead = viewAhead,
                        listened = allReadDates,
                        monthExpanded = monthExpanded,
                        onToggleMonth = { monthExpanded = !monthExpanded },
                        theme = theme,
                    ) { a -> onViewAhead(a); onCursor(0) }

                    if (needsConfirm) {
                        Box(
                            Modifier.fillMaxWidth().padding(top = 12.dp).height(44.dp).clip(RoundedCornerShape(12.dp)).background(accent)
                                .clickableNoRipple(onConfirmDay),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(locale.zh(PlanCopy.t("pages.read.planPlayConfirmDay")), color = Color(0xFFFFFBF4), fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }

                    // 列表抬头：「今日读经」+「▶ 连播今日」主胶囊
                    Row(Modifier.fillMaxWidth().padding(top = 20.dp, bottom = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(locale.zh(PlanCopy.t("pages.read.todayPlanTitle")), color = ink, fontSize = 18.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                        if (queue.isNotEmpty()) {
                            Row(
                                Modifier
                                    .clip(RoundedCornerShape(999.dp))
                                    .background(accent)
                                    .clickableNoRipple { if (!busy) onPlayChapter(activeIndex.coerceIn(0, queue.lastIndex)) }
                                    .padding(horizontal = 14.dp, vertical = 7.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp),
                            ) {
                                MaterialIcon(if (activePlaying) MI.PAUSE else MI.PLAY_ARROW, 16f, Color(0xFFFFFBF4))
                                Text(
                                    if (activePlaying) AppLocale.pick("正在连播", "Playing", locale) else AppLocale.pick("连播今日", "Play today", locale),
                                    color = Color(0xFFFFFBF4),
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold,
                                )
                            }
                        }
                    }
                }
                if (queue.isEmpty()) item {
                    Text(locale.zh(PlanCopy.t("pages.read.todayPlanEmpty")), Modifier.fillMaxWidth().padding(vertical = 20.dp),
                         color = muted, fontSize = 15.sp, textAlign = TextAlign.Center)
                }
                items(queue.size) { i ->
                    val p = queue[i]
                    val active = i == activeIndex
                    val book = BibleCatalog.book(p.bookId)
                    val title = book?.let { ReadChrome.chapterTitle(bookLabel(it), p.chapter, locale) } ?: "${p.bookId} ${p.chapter}"
                    val introSnippet = book?.let { me.askbible.native_.data.BibleBookIntroductions.get(it.id).text(locale) }.orEmpty()
                    // 彻底消除 320ms 单双击陷阱：点行主体 = 进阅读页；点右侧 44dp 圆形按钮 = 播放本章
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(if (active) theme.surface.toColor() else theme.surface.toColor().copy(alpha = 0.62f))
                            .border(
                                if (active) 1.dp else 0.75.dp,
                                if (active) accent.copy(alpha = 0.55f) else theme.border.toColor(),
                                RoundedCornerShape(16.dp),
                            )
                            .clickableNoRipple { onReadChapter(i) }
                            .padding(horizontal = 14.dp, vertical = 12.dp)
                            .alpha(if (busy && !active) 0.75f else 1f),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Text(
                            "%02d".format(i + 1),
                            Modifier.width(26.dp),
                            color = if (active) ink else faint,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(
                                title,
                                color = ink,
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            if (introSnippet.isNotEmpty()) {
                                Text(
                                    introSnippet,
                                    color = muted,
                                    fontSize = 12.5.sp,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                        }
                        Box(
                            Modifier
                                .size(42.dp)
                                .clip(RoundedCornerShape(999.dp))
                                .background(if (active && activePlaying) accent else accent.copy(alpha = 0.14f))
                                .alpha(if (busy) 0.4f else 1f)
                                .clickableNoRipple { if (!busy) onPlayChapter(i) },
                            contentAlignment = Alignment.Center,
                        ) {
                            MaterialIcon(
                                if (active && activePlaying) MI.GRAPHIC_EQ else MI.PLAY_ARROW,
                                20f,
                                if (active && activePlaying) Color(0xFFFFFBF4) else accent,
                            )
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                }
            }
            if (showDevotional && devotionalPlayer != null) item {
                // 跟日历选中的那天走（今天 + 往前 / 往后翻的天数）
                val date = java.time.LocalDate.now().plusDays(viewAhead.toLong())
                DevotionalCard(me.askbible.native_.data.SolidJoys.day(date), devotionalPlayer, theme,
                               onOpen = { onOpenDevotional(date) }, onRetry = onRetryDevotional,
                               autoRead = autoReadDevotional, onAutoRead = onAutoReadDevotional)
            }
            if (prefs.isNtDeepRepeat) {
                // 深读 52 阶（RN ReadNtDeepRepeatStagesBelowToday）：点选某阶设为今日
                val s = store.nt
                val stages = NtDeepRepeat.CURRICULUM
                item {
                    Spacer(Modifier.height(30.dp))
                    Text(locale.zh(PlanCopy.t("pages.read.ntDeepRepeatLadderTitle")), color = ink, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    Text(locale.zh(PlanCopy.f("pages.read.ntDeepRepeatLadderLead", mapOf("stages" to "${stages.size}", "days" to "${s.pace}", "cycle" to "${NtDeepRepeat.oneCycleDays(s.pace)}"))),
                         Modifier.padding(top = 6.dp), color = muted, fontSize = 15.sp, lineHeight = 22.sp)
                    Text(locale.zh(PlanCopy.t("pages.read.ntDeepRepeatStagesBelowHint")), Modifier.padding(top = 4.dp), color = faint, fontSize = 14.sp)
                    Spacer(Modifier.height(12.dp))
                }
                items(stages.size) { i ->
                    val seg = stages[i]
                    val isCurrent = i == s.curriculumIndex
                    val done = i < s.curriculumIndex
                    val isDark = theme == Parchment.dark
                    val currentBg = if (isDark) Brand.logo.toColor().copy(alpha = 0.18f) else Color(0xE6FFECBF)
                    val currentAccent = if (isDark) Brand.logo.toColor() else Color(0xFF8A5A00)
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp))
                            .background(if (isCurrent) currentBg else theme.surface.toColor().copy(alpha = 0.45f))
                            .border(if (isCurrent) 1.dp else 0.5.dp, if (isCurrent) Color(0xB3FFB101) else theme.border.toColor(), RoundedCornerShape(10.dp))
                            .clickableNoRipple { if (!isCurrent || s.dayInSegment > 1) stageToConfirm = i } // 当前阶也能点：本阶从第 1 天重来
                            .padding(horizontal = 12.dp, vertical = 9.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Text(locale.zh(PlanCopy.f("pages.read.ntDeepRepeatStageLabel", mapOf("n" to "${i + 1}"))), Modifier.width(58.dp),
                             color = if (isCurrent) currentAccent else faint, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        Text(NtDeepRepeat.stageRange(seg), Modifier.weight(1f), color = ink, fontSize = 16.sp,
                             fontWeight = if (isCurrent) FontWeight.SemiBold else FontWeight.Normal)
                        if (isCurrent) {
                            Text(locale.zh(PlanCopy.f("pages.read.ntDeepRepeatStageCurrent", mapOf("day" to "${s.dayInSegment}", "total" to "${s.segmentDayTarget}"))),
                                 color = currentAccent, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        } else if (done) {
                            Text(locale.zh(PlanCopy.t("pages.read.ntDeepRepeatStageDone")), color = faint, fontSize = 12.sp)
                        }
                    }
                    Spacer(Modifier.height(6.dp))
                }
            }
        }
    }

    stageToConfirm?.let { i ->
        val seg = NtDeepRepeat.segment(i)
        AlertDialog(
            onDismissRequest = { stageToConfirm = null },
            title = { Text(locale.zh(PlanCopy.t("pages.read.ntDeepRepeatSetStageAsTodayTitle"))) },
            text = { Text(locale.zh(PlanCopy.f("pages.read.ntDeepRepeatSetStageAsTodayBody", mapOf("n" to "${i + 1}", "range" to (seg?.let { NtDeepRepeat.stageRange(it) } ?: ""))))) },
            confirmButton = {
                TextButton(onClick = { store.setNtStageAsToday(i); stageToConfirm = null; onStageSet() }) {
                    Text(locale.zh(PlanCopy.t("pages.read.ntDeepRepeatSetStageAsTodayConfirm")))
                }
            },
            dismissButton = {
                TextButton(onClick = { stageToConfirm = null }) { Text(locale.zh(PlanCopy.t("pages.read.ntDeepRepeatSetStageAsTodayCancel"))) }
            },
        )
    }
}

@Composable
private fun PlanGentleWeekCard(
    locale: AppLocale,
    prefs: ReadingPlanPrefs,
    dayCount: Int?,
    viewAhead: Int,
    listened: Set<String>,
    monthExpanded: Boolean,
    onToggleMonth: () -> Unit,
    theme: Parchment,
    onSelectAhead: (Int) -> Unit,
) {
    val today = LocalDate.now()
    val selected = today.plusDays(viewAhead.toLong())
    val dowOffset = selected.dayOfWeek.value - 1 // 周一 = 0 .. 周日 = 6
    val monday = selected.minusDays(dowOffset.toLong())
    val weekDays = (0..6).map { monday.plusDays(it.toLong()) }
    val weekReadCount = weekDays.count { PlanPlay.isoDate(it) in listened || it == today }
    val weekdaysShort = if (locale == AppLocale.EN) listOf("M", "T", "W", "T", "F", "S", "S") else listOf("一", "二", "三", "四", "五", "六", "日")
    val ink = theme.ink.toColor()
    val muted = theme.muted.toColor()
    val accent = theme.accentOt.toColor()

    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(theme.surface.toColor())
            .border(1.dp, theme.border.toColor(), RoundedCornerShape(18.dp))
            .padding(14.dp),
    ) {
        Row(
            Modifier.fillMaxWidth().clickableNoRipple(onToggleMonth),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                PlanPlay.monthLabel(locale, selected.year, selected.monthValue),
                color = ink,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
            )
            MaterialIcon(if (monthExpanded) MI.EXPAND_LESS else MI.EXPAND_MORE, 18f, accent)
            Spacer(Modifier.weight(1f))
            Text(
                AppLocale.pick("本周相伴 $weekReadCount 天", "$weekReadCount days this week", locale),
                color = muted,
                fontSize = 12.5.sp,
                fontWeight = FontWeight.Medium,
            )
        }

        if (monthExpanded) {
            Spacer(Modifier.height(6.dp))
            PlanMonthCalendar(locale, prefs, dayCount, viewAhead, listened, theme, onSelectAhead)
        } else {
            Spacer(Modifier.height(10.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                weekDays.forEachIndexed { idx, d ->
                    val ahead = java.time.temporal.ChronoUnit.DAYS.between(today, d).toInt()
                    val isToday = d == today
                    val isSelected = ahead == viewAhead
                    val isRead = PlanPlay.isoDate(d) in listened
                    val selectable = PlanPlay.isAheadSelectable(prefs, dayCount, ahead)
                    Column(
                        Modifier
                            .weight(1f)
                            .alpha(if (!selectable && !isRead) 0.38f else 1f)
                            .clickableNoRipple { if (selectable) onSelectAhead(ahead) }
                            .padding(vertical = 4.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(5.dp),
                    ) {
                        Text(
                            weekdaysShort[idx],
                            color = if (isSelected) accent else muted,
                            fontSize = 11.sp,
                            fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Medium,
                        )
                        Box(
                            Modifier
                                .size(width = 34.dp, height = 30.dp)
                                .clip(RoundedCornerShape(999.dp))
                                .background(
                                    when {
                                        isSelected -> accent
                                        isToday -> accent.copy(alpha = 0.16f)
                                        else -> Color.Transparent
                                    },
                                )
                                .then(
                                    if (!isSelected && isToday) {
                                        Modifier.border(1.dp, accent.copy(alpha = 0.45f), RoundedCornerShape(999.dp))
                                    } else {
                                        Modifier
                                    },
                                ),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                "${d.dayOfMonth}",
                                color = if (isSelected) Color(0xFFFFFBF4) else ink,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                        Box(
                            Modifier
                                .size(4.5.dp)
                                .clip(RoundedCornerShape(999.dp))
                                .background(
                                    if (isRead || isToday) {
                                        Brand.logo.toColor()
                                    } else {
                                        Color.Transparent
                                    },
                                ),
                        )
                    }
                }
            }
        }
    }
}

/**
 * 月历（RN ReadPlanPlayMonthCalendar）：黑底 = 系统今天（不随「进度设置为今日」移动）；黄底 = 选中浏览日或听过的日子；
 * 计划外的日子淡显不可点，但听过的日子仍保留黄标。
 */
@Composable
fun PlanMonthCalendar(
    locale: AppLocale,
    prefs: ReadingPlanPrefs,
    dayCount: Int?,
    viewAhead: Int,
    listened: Set<String>,
    theme: Parchment = LocalParchment.current,
    onSelectAhead: (Int) -> Unit,
) {
    val today = LocalDate.now()
    val selected = today.plusDays(viewAhead.toLong())
    var cursorYear by remember { mutableIntStateOf(selected.year) }
    var cursorMonth by remember { mutableIntStateOf(selected.monthValue) }
    LaunchedEffect(selected.year, selected.monthValue) { cursorYear = selected.year; cursorMonth = selected.monthValue }
    val rows = PlanPlay.monthGrid(cursorYear, cursorMonth, today, viewAhead, listened) { ahead -> PlanPlay.isAheadSelectable(prefs, dayCount, ahead) }
    val weekdays = if (locale == AppLocale.EN) PlanPlay.WEEKDAYS_EN else PlanPlay.WEEKDAYS_ZH
    val ink = theme.ink.toColor()
    val accent = theme.accentOt.toColor()
    fun move(delta: Int) {
        var m = cursorMonth + delta; var y = cursorYear
        if (m < 1) { m = 12; y -= 1 }
        if (m > 12) { m = 1; y += 1 }
        cursorYear = y; cursorMonth = m
    }
    Column(Modifier.fillMaxWidth().padding(top = 8.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(40.dp).clickableNoRipple { move(-1) }, contentAlignment = Alignment.Center) { MaterialIcon(MI.CHEVRON_LEFT, 28f, ink) }
            Spacer(Modifier.weight(1f))
            Text(PlanPlay.monthLabel(locale, cursorYear, cursorMonth), color = ink, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.weight(1f))
            Box(Modifier.size(40.dp).clickableNoRipple { move(1) }, contentAlignment = Alignment.Center) { MaterialIcon(MI.CHEVRON_RIGHT, 28f, ink) }
        }
        Row(Modifier.fillMaxWidth().padding(top = 8.dp)) {
            for (w in weekdays) Text(w, Modifier.weight(1f), color = theme.muted.toColor(), fontSize = 15.sp, fontWeight = FontWeight.Medium, textAlign = TextAlign.Center)
        }
        for (row in rows) {
            Row(Modifier.fillMaxWidth()) {
                for (cell in row) {
                    val day = cell.day
                    if (day == null) { Spacer(Modifier.weight(1f).height(44.dp)); continue }
                    val disabled = !cell.selectable
                    // 颜色只各管一件事（D-8）：琥珀 = 今天，金黄 = 已读（固定深棕字），描边 = 正在看的那天
                    val todayFill = cell.isToday
                    val accentFill = !todayFill && cell.isListened
                    val viewing = cell.isSelected && !todayFill
                    val fadeDisabled = disabled && !cell.isListened
                    val dayTextColor = when {
                        todayFill -> Color(0xFFFFFBF4)
                        accentFill -> Color(0xFF1C1410)
                        fadeDisabled -> theme.faint.toColor()
                        else -> ink
                    }
                    Box(
                        Modifier.weight(1f).padding(horizontal = 2.dp, vertical = 2.dp).height(40.dp).clip(RoundedCornerShape(7.dp))
                            .background(if (todayFill) accent else if (accentFill) Brand.logo.toColor() else Color.Transparent)
                            .then(if (viewing) Modifier.border(2.dp, accent, RoundedCornerShape(7.dp)) else Modifier)
                            .alpha(if (fadeDisabled) 0.35f else 1f)
                            .clickableNoRipple { if (!disabled) onSelectAhead(cell.ahead) },
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("$day", color = dayTextColor,
                             fontSize = 18.sp, fontWeight = if (todayFill || accentFill || viewing) FontWeight.Bold else FontWeight.Medium)
                    }
                }
            }
        }
        // 图例：三种标记各是什么意思
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            val muted = theme.muted.toColor()
            @Composable fun Legend(mod: Modifier, key: String) {
                Box(Modifier.size(12.dp).clip(RoundedCornerShape(3.dp)).then(mod))
                Text(locale.zh(me.askbible.native_.data.SiteCopy.t("native.$key", locale)), Modifier.padding(start = 5.dp, end = 16.dp), color = muted, fontSize = 13.sp)
            }
            Legend(Modifier.background(accent), "planLegendToday")
            Legend(Modifier.background(Brand.logo.toColor()), "planLegendRead")
            Legend(Modifier.border(1.5.dp, accent, RoundedCornerShape(3.dp)), "planLegendViewing")
        }
    }
}
