package me.askbible.native_.ui

import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.SiteCopy
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.askbible.native_.data.NtDeepRepeat
import me.askbible.native_.data.NtTrack
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.PlanAnchor
import me.askbible.native_.data.PlanCopy
import me.askbible.native_.data.PlanDates
import me.askbible.native_.data.PlanPointer
import me.askbible.native_.data.PlanReading
import me.askbible.native_.data.ReadingPlanCatalog
import me.askbible.native_.data.ReadingPlanEntry
import me.askbible.native_.data.ReadingPlanRules
import me.askbible.native_.data.TripleLoop
import me.askbible.native_.data.TripleTrack
import me.askbible.native_.home.ReadingPlanStore
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * 计划详情页（手机版精简排版，与 iOS PlanDetailView 同构）：
 * 徽标 / 标题 / 一句话 / 要点 chips → 今日读经卡 → 开始使用（深读节奏 · 起算方式 · 第几天 · 主按钮）
 * → 怎么读（三条要点）→ 新约 52 阶（进度条 + 可展开）→ 另一条路线 → 了解更多（长版说明、起算日、恢复默认）。
 * 规则（起算 / 推进 / 阶梯）仍在 ReadingPlanStore + ReadingPlans，这里只换排版与文案层级。
 */
@Composable
fun PlanDetailScreen(
    store: ReadingPlanStore, planId: String,
    onBack: () -> Unit, onOpenPlan: (String) -> Unit, onOpenChapter: (PlanPointer) -> Unit, onGoHome: () -> Unit,
    theme: Parchment = Parchment.light,
) {
    val plan = ReadingPlanCatalog.plan(planId)
    val isTriple = planId == ReadingPlanCatalog.TRIPLE_LOOP_ID
    val isNt = planId == ReadingPlanCatalog.NT_DEEP_REPEAT_ID
    val isActive = store.isActive(planId)
    // 隐式默认（三循环没落盘）不给「取消」
    val isImplicitDefault = isTriple && store.storedPrefs == null
    val stored = store.storedPrefs
    var anchor by remember(planId) { mutableStateOf(if (stored?.planId == planId) stored.anchor else if (isTriple) PlanAnchor.CALENDAR_EASTER else PlanAnchor.FROM_TODAY) }
    var pace by remember(planId) { mutableIntStateOf(stored?.ntDeepRepeatPace ?: store.prefs.ntDeepRepeatPace ?: NtDeepRepeat.DEFAULT_PACE) }
    var startDay by remember(planId) { mutableIntStateOf(1) }
    // 轻松循环：今天算第 1 天（从创 1 / 太 1 / 伯 1 起），还是跟着复活节历元的日历位置
    var tripleFromToday by remember(planId) { mutableStateOf(store.tripleStartedFromToday) }
    val maxStartDay = if (isNt) 365 else maxOf(1, plan?.dayCount ?: 1)
    val supportsStartDay = isNt || (!isTriple && anchor == PlanAnchor.FROM_TODAY)
    val currentDay = plan?.let { store.currentPlanDay(planId, it.dayCount) }
    LaunchedEffect(currentDay, supportsStartDay) { if (supportsStartDay && currentDay != null) startDay = currentDay.coerceIn(1, maxStartDay) }
    fun activate(p: ReadingPlanEntry) {
        if (isTriple) {
            // 选的跟现在一样就别重置进度，只把它设成当前计划
            when {
                tripleFromToday == store.tripleStartedFromToday ->
                    store.activate(p.planId, p.dayCount, PlanAnchor.CALENDAR_EASTER, pace, startDay)
                tripleFromToday -> store.startTripleFromToday()
                else -> store.resetTripleToDefault()
            }
            return
        }
        store.activate(p.planId, p.dayCount, anchor, pace, startDay)
    }

    Box(Modifier.fillMaxSize()) {
        PlanPageColumn(theme) {
            item {
                if (plan == null) {
                    Text(PlanCopy.t("pages.read.plansEmpty"), Modifier.fillMaxWidth().padding(top = 40.dp), color = theme.muted.toColor(), fontSize = 15.sp, textAlign = TextAlign.Center)
                    return@item
                }
                // ---- 头部 ----
                Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(plan.badge, color = Color(0xCC4D3522), fontSize = 14.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.8.sp)
                    Text(plan.title, Modifier.padding(top = 8.dp), color = theme.ink.toColor(), fontSize = 28.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                    Text(plan.tagline, Modifier.padding(top = 10.dp), color = theme.muted.toColor(), fontSize = 18.sp, lineHeight = 27.sp, textAlign = TextAlign.Center)
                    Spacer(Modifier.height(16.dp))
                    PlanFactRow(plan.facts, centered = true, theme = theme)
                    if (isActive) {
                        Spacer(Modifier.height(14.dp))
                        PlanStatusPill(PlanText.t("activePill") + (currentDay?.let { " · " + PlanText.f("currentDay", mapOf("n" to "$it")) } ?: ""))
                    }
                }

                // ---- 今日读经 ----
                when {
                    isTriple -> {
                        Spacer(Modifier.height(28.dp))
                        PlanSectionHeader(PlanText.t("todayHeading"), PlanText.t("todayHint"), theme)
                        Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            for (track in TripleTrack.entries) {
                                val p = store.triple[track]
                                PlanTodayCard(track.raw, TripleLoop.trackTitle(track), PlanReading(p.bookId, p.chapter, p.chapter).display,
                                              TripleLoop.formatVerbose(p.bookId, p.chapter), theme = theme) { onOpenChapter(p) }
                            }
                        }
                    }
                    isNt -> {
                        val progress = store.nt
                        val total = NtDeepRepeat.segmentDayTarget(progress)
                        val segment = NtDeepRepeat.currentSegment(progress)
                        Spacer(Modifier.height(28.dp))
                        PlanSectionHeader(PlanText.t("todayHeading"), PlanText.t("todayHint"), theme)
                        Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            val first = segment?.ranges?.firstOrNull()
                            if (segment != null && first != null) {
                                PlanTodayCard("nt", NtDeepRepeat.trackTitle(NtTrack.NT), segment.ranges.joinToString(" · ") { it.display },
                                              PlanText.f("ladderProgress", mapOf("n" to "${progress.curriculumIndex + 1}", "day" to "${progress.dayInSegment}", "total" to "$total")),
                                              progress = if (total > 0) progress.dayInSegment.toDouble() / total else 0.0, theme = theme) {
                                    onOpenChapter(PlanPointer(first.bookId, first.startChapter))
                                }
                            }
                            PlanTodayCard("ot", NtDeepRepeat.trackTitle(NtTrack.OT), PlanReading(progress.ot.bookId, progress.ot.chapter, progress.ot.chapter).display,
                                          NtDeepRepeat.otLine(progress.ot.bookId, progress.ot.chapter), theme = theme) { onOpenChapter(progress.ot) }
                        }
                    }
                    isActive -> {
                        // 经典日课表：只有设为当前计划后才有「今日」可言
                        val today = store.today
                        Spacer(Modifier.height(28.dp))
                        PlanSectionHeader(PlanText.t("todayHeading"), today.metaLine, theme)
                        Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            for (r in today.readings) {
                                val first = r.chapters.firstOrNull() ?: continue
                                PlanTodayCard(null, plan.title, r.display, null, theme = theme) { onOpenChapter(first) }
                            }
                        }
                    }
                }

                // ---- 开始使用 ----
                if (isTriple) {
                    Spacer(Modifier.height(32.dp))
                    PlanSectionHeader(PlanText.t("setupHeading"), theme = theme)
                    Row(Modifier.fillMaxWidth().padding(top = 14.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        PlanChoiceTile(PlanText.t("tripleStartToday"), PlanText.t("tripleStartTodayHint"), tripleFromToday, theme) { tripleFromToday = true }
                        PlanChoiceTile(PlanText.t("tripleStartCalendar"), PlanText.t("tripleStartCalendarHint"), !tripleFromToday, theme) { tripleFromToday = false }
                    }
                    Spacer(Modifier.height(22.dp))
                    PlanPrimaryButton(PlanText.t(if (isActive) "update" else "use"), theme = theme) { activate(plan) }
                    if (isActive && !isImplicitDefault) {
                        Spacer(Modifier.height(14.dp))
                        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { PlanLink(PlanText.t("clear"), theme, size = 15) { store.clearPlan() } }
                    }
                } else {
                    Spacer(Modifier.height(32.dp))
                    PlanSectionHeader(PlanText.t("setupHeading"), theme = theme)
                    if (isNt) {
                        Spacer(Modifier.height(14.dp))
                        Subheading(PlanText.t("paceHeading"), PlanText.t("paceHint"), theme)
                        Row(Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            for (p in NtDeepRepeat.PACES) PlanChoiceTile(SiteCopy.f("native.days", mapOf("n" to "$p")), PlanText.t("pace$p"), pace == p, theme) { pace = p }
                        }
                        // RN NtDeepRepeatPaceSection：toLocaleDateString(en-US / zh-CN)
                        val end = LocalDate.now().plusDays((pace - 1).toLong()).format(
                            if (AppLocale.current == AppLocale.EN) DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US) else DateTimeFormatter.ofPattern("M月d日 EEE", Locale.CHINA))
                        Text(PlanText.f("paceEnd", mapOf("endDate" to end)), Modifier.padding(top = 10.dp), color = theme.muted.toColor(), fontSize = 15.sp)
                    } else {
                        Row(Modifier.fillMaxWidth().padding(top = 14.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            PlanChoiceTile(PlanText.t("anchorToday"), PlanText.t("anchorTodayHint"), anchor == PlanAnchor.FROM_TODAY, theme) { anchor = PlanAnchor.FROM_TODAY }
                            PlanChoiceTile(PlanText.t("anchorJan1"), PlanText.t("anchorJan1Hint"), anchor == PlanAnchor.CALENDAR_JAN1, theme) { anchor = PlanAnchor.CALENDAR_JAN1 }
                        }
                    }
                    if (supportsStartDay) {
                        Spacer(Modifier.height(22.dp))
                        Subheading(PlanText.t("startDayHeading"), PlanText.t("startDayHint"), theme)
                        Spacer(Modifier.height(10.dp))
                        PlanStepper(startDay, 1, maxStartDay, theme) { startDay = it }
                    }
                    Spacer(Modifier.height(22.dp))
                    PlanPrimaryButton(PlanText.t(if (isActive) "update" else "use"), theme = theme) { activate(plan) }
                    if (isActive) {
                        Spacer(Modifier.height(14.dp))
                        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { PlanLink(PlanText.t("clear"), theme, size = 15) { store.clearPlan() } }
                    }
                }

                // ---- 怎么读 ----
                Spacer(Modifier.height(32.dp))
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    PlanSectionHeader(PlanText.t("howHeading"), theme = theme)
                    for (f in plan.how) PlanHowRow(f, theme)
                }

                // ---- 新约 52 阶 ----
                if (isNt) {
                    val progress = store.nt
                    val total = NtDeepRepeat.segmentDayTarget(progress)
                    val current = NtDeepRepeat.currentSegment(progress)
                    Spacer(Modifier.height(32.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        PlanSectionHeader(PlanText.t("ladderHeading"), theme = theme)
                        PlanProgressBar(progress.curriculumIndex.toDouble() / NtDeepRepeat.STAGE_COUNT, Modifier.padding(top = 4.dp), theme)
                        Text(PlanText.f("ladderProgress", mapOf("n" to "${progress.curriculumIndex + 1}", "day" to "${progress.dayInSegment}", "total" to "$total")),
                             color = theme.ink.toColor(), fontSize = 16.sp, fontWeight = FontWeight.Medium)
                        if (current != null) Text(NtDeepRepeat.stageRange(current), color = theme.muted.toColor(), fontSize = 16.sp)
                        PlanDisclosure(PlanText.t("ladderOpen"), PlanText.t("ladderClose"), theme) {
                            Column {
                                NtDeepRepeat.CURRICULUM.forEachIndexed { index, seg ->
                                    val isCurrent = index == progress.curriculumIndex
                                    val isDone = index < progress.curriculumIndex
                                    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(if (isCurrent) Color(0x99FFECBF) else Color.Transparent)
                                        .padding(vertical = 8.dp, horizontal = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                        Text(PlanCopy.f("pages.read.ntDeepRepeatStageLabel", mapOf("n" to "${index + 1}")), Modifier.width(66.dp),
                                             color = if (isCurrent) theme.ink.toColor() else theme.faint.toColor(), fontSize = 15.sp, fontWeight = if (isCurrent) FontWeight.SemiBold else FontWeight.Normal)
                                        Text(NtDeepRepeat.stageRange(seg), Modifier.weight(1f),
                                             color = if (isCurrent) theme.ink.toColor() else if (isDone) theme.muted.toColor() else theme.faint.toColor(), fontSize = 16.sp,
                                             fontWeight = if (isCurrent) FontWeight.SemiBold else FontWeight.Normal)
                                        if (isCurrent) Text(PlanText.t("stageCurrent"), color = Color(0xFF8A5A00), fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                                        else if (isDone) MaterialIcon(MI.CHECK, 18f, theme.faint.toColor())
                                    }
                                }
                            }
                        }
                    }
                }

                // ---- 另一条路线 ----
                if (isTriple) {
                    Spacer(Modifier.height(28.dp))
                    PlanLinkCard(PlanText.t("toDeepTitle"), PlanText.t("toDeepLead"), theme) { onOpenPlan(ReadingPlanCatalog.NT_DEEP_REPEAT_ID) }
                } else if (isNt) {
                    Spacer(Modifier.height(28.dp))
                    PlanLinkCard(PlanText.t("toLightTitle"), PlanText.t("toLightLead"), theme) { onOpenPlan(ReadingPlanCatalog.TRIPLE_LOOP_ID) }
                }

                // ---- 了解更多 ----
                Spacer(Modifier.height(24.dp))
                PlanDisclosure(PlanText.t("moreOpen"), PlanText.t("moreClose"), theme) {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(plan.detail, color = theme.muted.toColor(), fontSize = 16.sp, lineHeight = 24.sp)
                        if (isTriple) {
                            // 自己选了「从今天开始」就报自己的起点与天数，别再说复活节历元
                            val epochLine = if (store.tripleStartedFromToday)
                                PlanText.f("epochTripleSelf", mapOf("date" to dayLabel(store.triple.startedAt ?: ""), "n" to "${store.triplePlanDay()}"))
                            else PlanText.f("epochTriple", mapOf("date" to easterLabel(), "n" to "${store.triplePlanDay()}"))
                            Text(epochLine, color = theme.faint.toColor(), fontSize = 15.sp, lineHeight = 21.sp)
                        } else if (isNt) {
                            Text(PlanText.f("epochNt", mapOf("n" to "${ReadingPlanRules.effectiveEpochDay(store.prefs)}")), color = theme.faint.toColor(), fontSize = 15.sp, lineHeight = 21.sp)
                        }
                        if ((isTriple && store.hasUserTriple) || (isNt && store.hasUserNt)) {
                            PlanLink(PlanText.t("resetDefault"), theme, size = 15) { if (isTriple) store.resetTripleToDefault() else store.resetNt() }
                        }
                    }
                }

                Spacer(Modifier.height(28.dp))
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    PlanLink(PlanText.t("seeHome") + " →", theme, size = 15, onClick = onGoHome)
                }
            }
        }
        PlanBackButton(onBack, theme)
    }
}

@Composable
private fun Subheading(title: String, hint: String, theme: Parchment) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(title, color = theme.ink.toColor(), fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        Text(hint, color = theme.muted.toColor(), fontSize = 15.sp, lineHeight = 21.sp)
    }
}

/** PlanDates.EASTER_EPOCH（2026-04-05）→「2026 年 4 月 5 日」 */
private fun easterLabel(): String = dayLabel(PlanDates.EASTER_EPOCH)

/** yyyy-MM-dd →「2026 年 4 月 5 日」/「April 5, 2026」 */
private fun dayLabel(iso: String): String {
    val parts = iso.split("-").mapNotNull { it.toIntOrNull() }
    if (parts.size != 3) return iso
    if (AppLocale.current == AppLocale.EN) return LocalDate.of(parts[0], parts[1], parts[2]).format(DateTimeFormatter.ofPattern("MMMM d, yyyy", Locale.US))
    return "${parts[0]} 年 ${parts[1]} 月 ${parts[2]} 日"
}
