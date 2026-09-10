package me.askbible.native_.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
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
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.askbible.native_.data.Brand
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.PlanCopy
import me.askbible.native_.data.PlanFact

/**
 * 读经计划页的手机版视觉件（两端同构，iOS 见 Read/PlanWidgets.swift）。
 * Josh 2026-09-09：介绍与内容要为手机看优化 —— 字不小于 13，段落改成要点，能点的做成卡片，整体简短、可视。
 * 文案来自 data/bible-reading-plans/mobile-brief.zh-CN.json（PlanText = PlanCopy 的 mobile.* 键）。
 */
object PlanText {
    fun t(key: String): String = PlanCopy.t("mobile.$key")
    fun f(key: String, args: Map<String, String>): String = PlanCopy.f("mobile.$key", args)
}

/** mobile-brief 里的图标名 → Material 字形 */
fun planIconGlyph(name: String): String = when (name) {
    "today" -> MI.TODAY
    "loop" -> MI.LOOP
    "swap" -> MI.SWAP_HORIZ
    "stairs" -> MI.STAIRS
    "repeat" -> MI.REPEAT
    "book" -> MI.MENU_BOOK
    "sync" -> MI.SYNC
    "spa" -> MI.SPA
    "replay" -> MI.REPLAY
    "calendar" -> MI.CALENDAR_MONTH
    "layers" -> MI.LAYERS
    else -> MI.TODAY
}

/** 轨道图标与色：旧约蓝 / 新约橙 / 智慧书绿（目录页的约别配色） */
fun planTrackStyle(id: String): Pair<String, Color> = when (id) {
    "ot" -> Pair(MI.HISTORY_EDU, Color(0xFF2E5E8C))
    "nt" -> Pair(MI.AUTO_STORIES, Color(0xFFB8611E))
    else -> Pair(MI.LIGHTBULB, Color(0xFF3F7A4A))
}

/** 子页左上返回键（RN ShellSystemBackButton），与 iOS 的 PlanBackButton 对等 */
@Composable
fun PlanBackButton(onBack: () -> Unit, theme: Parchment = Parchment.light) {
    Box(Modifier.statusBarsPadding().padding(start = 12.dp, top = 8.dp).size(44.dp).clickableNoRipple(onBack), contentAlignment = Alignment.Center) {
        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null, tint = theme.ink.toColor(), modifier = Modifier.size(26.dp))
    }
}

/** 羊皮卷子页的滚动容器：顶部留出返回键；独立页没有底栏，底部只留导航条 + 24 */
@Composable
fun PlanPageColumn(theme: Parchment = Parchment.light, content: LazyListScope.() -> Unit) {
    val navBottom = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    Box(Modifier.fillMaxSize()) {
        ParchmentBackground(theme = theme)
        LazyColumn(
            Modifier.fillMaxSize().statusBarsPadding(),
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 64.dp, bottom = navBottom + 24.dp),
            content = content,
        )
    }
}

/** 下划线小链接 */
@Composable
fun PlanLink(text: String, theme: Parchment = Parchment.light, size: Int = 14, color: Color = theme.muted.toColor(), modifier: Modifier = Modifier, onClick: () -> Unit) {
    Text(text, modifier.clickableNoRipple(onClick), color = color, fontSize = size.sp, textDecoration = TextDecoration.Underline)
}

/** 要点胶囊：图标 16 + 文字 14/600 */
@Composable
fun PlanFactChip(fact: PlanFact, theme: Parchment = Parchment.light) {
    Row(
        Modifier.clip(CircleShape).background(theme.surface.toColor().copy(alpha = 0.85f)).border(0.5.dp, theme.border.toColor(), CircleShape)
            .padding(horizontal = 12.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        MaterialIcon(planIconGlyph(fact.icon), 18f, theme.muted.toColor())
        Text(fact.text, color = theme.ink.toColor(), fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
    }
}

/** 要点 chips 一行，放不下就折行（卡片里三颗 chip 曾被挤得每颗都换行） */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun PlanFactRow(facts: List<PlanFact>, centered: Boolean = false, theme: Parchment = Parchment.light) {
    FlowRow(
        Modifier.fillMaxWidth(),
        horizontalArrangement = if (centered) Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally) else Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        for (f in facts) PlanFactChip(f, theme)
    }
}

/** 「怎么读」一行：金色圆底图标 + 16/500 短句 */
@Composable
fun PlanHowRow(fact: PlanFact, theme: Parchment = Parchment.light) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(Modifier.size(36.dp).clip(CircleShape).background(Brand.logo.toColor().copy(alpha = 0.2f)), contentAlignment = Alignment.Center) {
            MaterialIcon(planIconGlyph(fact.icon), 20f, theme.ink.toColor())
        }
        Text(fact.text, Modifier.weight(1f), color = theme.inkSoft.toColor(), fontSize = 17.sp, lineHeight = 25.sp, fontWeight = FontWeight.Medium)
    }
}

/** 今日读经卡：轨道图标 / 轨道名 13 / 书章 22/700 / 说明 14 / 可选进度条；整卡可点进章 */
@Composable
fun PlanTodayCard(track: String?, label: String, title: String, subtitle: String?, progress: Double? = null, theme: Parchment = Parchment.light, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color(0xB8FFFCF5)).border(0.5.dp, theme.border.toColor(), RoundedCornerShape(14.dp))
            .clickableNoRipple(onClick).padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        if (track != null) {
            val (glyph, color) = planTrackStyle(track)
            Box(Modifier.size(46.dp).clip(CircleShape).background(color.copy(alpha = 0.14f)), contentAlignment = Alignment.Center) {
                MaterialIcon(glyph, 24f, color)
            }
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(label, color = theme.faint.toColor(), fontSize = 14.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.6.sp)
            Text(title, color = theme.ink.toColor(), fontSize = 22.sp, lineHeight = 28.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            if (subtitle != null) Text(subtitle, color = theme.muted.toColor(), fontSize = 15.sp)
            if (progress != null) PlanProgressBar(progress, Modifier.padding(top = 4.dp), theme)
        }
        MaterialIcon(MI.CHEVRON_RIGHT, 26f, theme.faint.toColor())
    }
}

@Composable
fun PlanProgressBar(value: Double, modifier: Modifier = Modifier, theme: Parchment = Parchment.light) {
    Box(modifier.fillMaxWidth().height(5.dp).clip(CircleShape).background(theme.border.toColor())) {
        Box(Modifier.fillMaxWidth(value.coerceIn(0.0, 1.0).toFloat()).height(5.dp).clip(CircleShape).background(Brand.logo.toColor()))
    }
}

/** 整宽主按钮 52 高：filled = 墨底米字；否则米底墨字（次要） */
@Composable
fun PlanPrimaryButton(title: String, filled: Boolean = true, theme: Parchment = Parchment.light, onClick: () -> Unit) {
    Box(
        Modifier.fillMaxWidth().height(52.dp).clip(RoundedCornerShape(14.dp))
            .background(if (filled) theme.ink.toColor() else theme.surface.toColor())
            .border(1.dp, if (filled) Color.Transparent else theme.ink.toColor().copy(alpha = 0.35f), RoundedCornerShape(14.dp))
            .clickableNoRipple(onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(title, color = if (filled) Color(0xFFF5EFE4) else theme.ink.toColor(), fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun PlanSectionHeader(title: String, hint: String? = null, theme: Parchment = Parchment.light) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(title, color = theme.ink.toColor(), fontSize = 20.sp, fontWeight = FontWeight.Bold)
        if (hint != null) Text(hint, color = theme.muted.toColor(), fontSize = 15.sp)
    }
}

/** 「✓ 当前计划 · 第 N 天」金色胶囊 */
@Composable
fun PlanStatusPill(text: String) {
    Row(
        Modifier.clip(CircleShape).background(Brand.logo.toColor().copy(alpha = 0.26f)).padding(horizontal = 12.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        MaterialIcon(MI.CHECK_CIRCLE, 18f, Color(0xFF8A5A00))
        Text(text, color = Color(0xFF5B3A00), fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
    }
}

/** 单选格（深读节奏 / 起算方式）：标题 18/700 + 副题 13，选中金底金边 */
@Composable
fun RowScope.PlanChoiceTile(title: String, subtitle: String, on: Boolean, theme: Parchment = Parchment.light, onClick: () -> Unit) {
    Column(
        Modifier.weight(1f).clip(RoundedCornerShape(12.dp))
            .background(if (on) Brand.logo.toColor().copy(alpha = 0.28f) else theme.surface.toColor().copy(alpha = 0.6f))
            .border(if (on) 1.5.dp else 0.5.dp, if (on) Brand.logo.toColor() else theme.border.toColor(), RoundedCornerShape(12.dp))
            .clickableNoRipple(onClick).padding(vertical = 12.dp, horizontal = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(title, color = theme.ink.toColor(), fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Text(subtitle, color = theme.muted.toColor(), fontSize = 14.sp, fontWeight = FontWeight.Medium, textAlign = TextAlign.Center)
    }
}

/** 第几天步进器：44 触控键 + 24/700 数字 */
@Composable
fun PlanStepper(value: Int, min: Int, max: Int, theme: Parchment = Parchment.light, onChange: (Int) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        PlanStepButton(MI.REMOVE, value > min, theme) { onChange(maxOf(min, value - 1)) }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("第", color = theme.muted.toColor(), fontSize = 16.sp)
            Text("$value", Modifier.width(44.dp), color = theme.ink.toColor(), fontSize = 24.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
            Text("天", color = theme.muted.toColor(), fontSize = 16.sp)
        }
        PlanStepButton(MI.ADD, value < max, theme) { onChange(minOf(max, value + 1)) }
    }
}

@Composable
private fun PlanStepButton(glyph: String, enabled: Boolean, theme: Parchment, onClick: () -> Unit) {
    Box(
        Modifier.size(44.dp).alpha(if (enabled) 1f else 0.4f).clip(RoundedCornerShape(10.dp)).background(theme.surface.toColor())
            .border(0.5.dp, theme.border.toColor(), RoundedCornerShape(10.dp)).clickableNoRipple { if (enabled) onClick() },
        contentAlignment = Alignment.Center,
    ) { MaterialIcon(glyph, 22f, theme.ink.toColor()) }
}

/** 展开 / 收起（「了解更多」「展开全部 52 阶」） */
@Composable
fun PlanDisclosure(openTitle: String, closeTitle: String, theme: Parchment = Parchment.light, content: @Composable () -> Unit) {
    var open by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(Modifier.heightIn(min = 44.dp).clickableNoRipple { open = !open }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(if (open) closeTitle else openTitle, color = theme.muted.toColor(), fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            MaterialIcon(if (open) MI.EXPAND_LESS else MI.EXPAND_MORE, 22f, theme.muted.toColor())
        }
        AnimatedVisibility(open) { content() }
    }
}

/** 跳到另一条路线的卡：标题 17/600 + 一句 14 + 右箭头 */
@Composable
fun PlanLinkCard(title: String, lead: String, theme: Parchment = Parchment.light, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(theme.surface.toColor().copy(alpha = 0.6f))
            .border(0.5.dp, theme.border.toColor(), RoundedCornerShape(14.dp)).clickableNoRipple(onClick).padding(16.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, color = theme.ink.toColor(), fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
            Text(lead, color = theme.muted.toColor(), fontSize = 15.sp)
        }
        MaterialIcon(MI.ARROW_FORWARD, 24f, theme.ink.toColor())
    }
}
