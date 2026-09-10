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
    theme: Parchment = Parchment.light,
    /** 习惯统计里的已读日（云端同步下来的也在）；月历标黄 = 它 ∪ 播放页点听日（RN habitCompletedDates） */
    habitDates: Set<String> = emptySet(),
) {
    val prefs = store.prefs
    val committedAhead = prefs.ahead
    val contentAhead = PlanPlay.contentAhead(viewAhead, committedAhead)
    val browsingAway = contentAhead != committedAhead
    // 点选今天之后的日期时可确认：把进度调到该日对应内容
    val needsConfirm = browsingAway && viewAhead >= 0
    val dayCount = ReadingPlanCatalog.plan(prefs.planId)?.dayCount ?: prefs.dayCount
    val planName = locale.zh(ReadingPlanCatalog.plan(prefs.planId)?.title ?: PlanCopy.t("pages.read.planPlayTitle"))
    val dayMeta = locale.zh(PlanCopy.f("pages.read.todayPlanDayMeta", mapOf("n" to "${PlanPlay.planDayNumber(prefs, dayCount, contentAhead)}")))
    var stageToConfirm by remember { mutableStateOf<Int?>(null) }
    var lastRowTap by remember { mutableStateOf<Pair<Int, Long>?>(null) }
    val ink = theme.ink.toColor()
    val muted = theme.muted.toColor()
    val faint = theme.faint.toColor()
    val busy = audio.isLoading && audio.wantsPlayback

    // 单击点播；同一行 320ms 内再点 → 进阅读页（RN onRowPress）
    fun rowTapped(index: Int) {
        val now = System.currentTimeMillis()
        val last = lastRowTap
        if (last != null && last.first == index && now - last.second < 320) {
            lastRowTap = null
            onReadChapter(index)
            return
        }
        lastRowTap = index to now
        onPlayChapter(index)
    }

    Box(Modifier.fillMaxSize()) {
        ParchmentBackground(theme = theme)
        val bottom = shellTabBarBottomInset() + (ShellMetrics.tabRowHeight + ShellMetrics.tabBarDockGap + 24f).dp +
            (if (queue.isNotEmpty()) ShellMetrics.dockContentHeight.dp else 0.dp)
        LazyColumn(
            Modifier.fillMaxSize().statusBarsPadding(),
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 8.dp, bottom = bottom),
        ) {
            item {
                // 顶栏：计划名居中 + 齿轮（→ 计划目录）
                Box(Modifier.fillMaxWidth().height(44.dp), contentAlignment = Alignment.Center) {
                    Text(planName, Modifier.padding(horizontal = 44.dp), color = ink, fontSize = 20.sp, fontWeight = FontWeight.Bold,
                         textAlign = TextAlign.Center, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Box(Modifier.align(Alignment.CenterEnd).size(40.dp).clickableNoRipple(onOpenPlans), contentAlignment = Alignment.Center) {
                        MaterialIcon(MI.SETTINGS, 22f, muted)
                    }
                }
            }
            if (queue.isEmpty() && !browsingAway) {
                item {
                    Text(locale.zh(PlanCopy.t("pages.read.todayPlanEmpty")), Modifier.fillMaxWidth().padding(top = 48.dp),
                         color = muted, fontSize = 16.sp, textAlign = TextAlign.Center)
                }
            } else {
                item {
                    PlanMonthCalendar(locale, prefs, dayCount, viewAhead, store.listenedDates + habitDates, theme) { a -> onViewAhead(a); onCursor(0) }
                    if (needsConfirm) {
                        Box(
                            Modifier.fillMaxWidth().padding(top = 12.dp).height(46.dp).clip(RoundedCornerShape(12.dp)).background(ink)
                                .clickableNoRipple(onConfirmDay),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(locale.zh(PlanCopy.t("pages.read.planPlayConfirmDay")), color = Color(0xFFF5EFE4), fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                    // 列表抬头：第 N 天 · 今日读经 · i / n
                    Row(Modifier.fillMaxWidth().padding(top = 18.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(dayMeta, color = muted, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                        Spacer(Modifier.weight(1f))
                        Text(locale.zh(PlanCopy.t("pages.read.todayPlanTitle")), color = ink, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.weight(1f))
                        Text(if (queue.isEmpty()) " " else PlanCopy.f("pages.read.planPlayTrackMeta", mapOf("current" to "${activeIndex + 1}", "total" to "${queue.size}")),
                             color = muted, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                    }
                    Spacer(Modifier.height(8.dp))
                }
                if (queue.isEmpty()) item {
                    Text(locale.zh(PlanCopy.t("pages.read.todayPlanEmpty")), Modifier.fillMaxWidth().padding(vertical = 20.dp),
                         color = muted, fontSize = 15.sp, textAlign = TextAlign.Center)
                }
                items(queue.size) { i ->
                    val p = queue[i]
                    val active = i == activeIndex
                    val title = BibleCatalog.book(p.bookId)?.let { "${bookLabel(it)} ${p.chapter}" } ?: "${p.bookId} ${p.chapter}"
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = if (active) 0.dp else 6.dp).clip(RoundedCornerShape(10.dp))
                            .background(if (active) theme.surface.toColor().copy(alpha = 0.85f) else Color.Transparent)
                            .clickableNoRipple { if (!busy) rowTapped(i) }
                            .padding(start = if (active) 18.dp else 6.dp, end = if (active) 8.dp else 0.dp, top = 6.dp, bottom = 6.dp)
                            .alpha(if (busy && !active) 0.7f else 1f),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Text("%02d".format(i + 1), Modifier.width(26.dp), color = if (active) ink else faint, fontSize = 13.sp,
                             fontWeight = if (active) FontWeight.Bold else FontWeight.Medium, textAlign = TextAlign.End)
                        Text(title, Modifier.weight(1f), color = ink, fontSize = 17.sp,
                             fontWeight = if (active) FontWeight.Bold else FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Box(Modifier.size(36.dp).clickableNoRipple { onReadChapter(i) }, contentAlignment = Alignment.Center) {
                            MaterialIcon(MI.MENU_BOOK, 20f, muted)
                        }
                        Box(Modifier.size(36.dp).alpha(if (busy) 0.35f else 1f).clickableNoRipple { if (!busy) onPlayChapter(i) }, contentAlignment = Alignment.Center) {
                            MaterialIcon(if (active && activePlaying) MI.GRAPHIC_EQ else MI.VOLUME_UP, 20f, muted)
                        }
                    }
                    Spacer(Modifier.height(4.dp))
                }
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
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp))
                            .background(if (isCurrent) Color(0xE6FFECBF) else theme.surface.toColor().copy(alpha = 0.45f))
                            .border(if (isCurrent) 1.dp else 0.5.dp, if (isCurrent) Color(0xB3FFB101) else theme.border.toColor(), RoundedCornerShape(10.dp))
                            .clickableNoRipple { if (!isCurrent) stageToConfirm = i }
                            .padding(horizontal = 12.dp, vertical = 9.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Text(locale.zh(PlanCopy.f("pages.read.ntDeepRepeatStageLabel", mapOf("n" to "${i + 1}"))), Modifier.width(58.dp),
                             color = if (isCurrent) Color(0xFF8A5A00) else faint, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        Text(NtDeepRepeat.stageRange(seg), Modifier.weight(1f), color = ink, fontSize = 16.sp,
                             fontWeight = if (isCurrent) FontWeight.SemiBold else FontWeight.Normal)
                        if (isCurrent) {
                            Text(locale.zh(PlanCopy.f("pages.read.ntDeepRepeatStageCurrent", mapOf("day" to "${s.dayInSegment}", "total" to "${s.segmentDayTarget}"))),
                                 color = Color(0xFF8A5A00), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
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
    theme: Parchment = Parchment.light,
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
                    val todayFill = cell.isToday
                    val accentFill = !todayFill && (cell.isSelected || cell.isListened)
                    val fadeDisabled = disabled && !cell.isListened
                    Box(
                        Modifier.weight(1f).padding(horizontal = 2.dp, vertical = 2.dp).height(40.dp).clip(RoundedCornerShape(7.dp))
                            .background(if (todayFill) ink else if (accentFill) Brand.logo.toColor() else Color.Transparent)
                            .alpha(if (fadeDisabled) 0.35f else 1f)
                            .clickableNoRipple { if (!disabled) onSelectAhead(cell.ahead) },
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("$day", color = if (todayFill) theme.surfaceSolid.toColor() else if (fadeDisabled) theme.faint.toColor() else ink,
                             fontSize = 18.sp, fontWeight = if (todayFill || accentFill) FontWeight.Bold else FontWeight.Medium)
                    }
                }
            }
        }
    }
}
