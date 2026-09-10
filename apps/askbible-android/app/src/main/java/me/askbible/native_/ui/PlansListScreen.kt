package me.askbible.native_.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.PlanCopy
import me.askbible.native_.data.ReadingPlanCatalog
import me.askbible.native_.data.ReadingPlanEntry
import me.askbible.native_.home.ReadingPlanStore

/**
 * 读经计划目录页（手机版精简排版，与 iOS PlansListView 同构）：
 * 标题 + 一句引言，两张主推卡（徽标 / 标题 / 一句话 / 要点 chips），下面是经典日课表。
 * 原来照 RN 搬的长段导语与 blurb 都收进详情页的「了解更多」。
 */
@Composable
fun PlansListScreen(
    store: ReadingPlanStore, onOpenPlan: (String) -> Unit, onBack: () -> Unit,
    /** 正式研读卡上的「背景与原理见 麦克阿瑟的研经方法 →」（RN ReadPlansFeaturedPlanCard → 探索文章） */
    onOpenArticle: (String) -> Unit = {},
    theme: Parchment = Parchment.light,
) {
    Box(Modifier.fillMaxSize()) {
        PlanPageColumn(theme) {
            item {
                Text(PlanCopy.t("pages.read.plansTitle"), Modifier.fillMaxWidth(), color = theme.ink.toColor(), fontSize = 30.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                Text(PlanText.t("plansIntro"), Modifier.fillMaxWidth().padding(top = 10.dp), color = theme.muted.toColor(), fontSize = 17.sp, textAlign = TextAlign.Center)
                Spacer(Modifier.height(24.dp))
            }
            items(ReadingPlanCatalog.featured.size) { i ->
                val plan = ReadingPlanCatalog.featured[i]
                FeaturedPlanCard(plan, store.isActive(plan.planId), theme, onOpenArticle) { onOpenPlan(plan.planId) }
                Spacer(Modifier.height(14.dp))
            }
            item {
                Spacer(Modifier.height(18.dp))
                PlanSectionHeader(PlanText.t("plansOtherHeading"), PlanText.t("plansOtherLead"), theme)
                Spacer(Modifier.height(14.dp))
            }
            items(ReadingPlanCatalog.others.size) { i ->
                val plan = ReadingPlanCatalog.others[i]
                ClassicPlanCard(plan, store.isActive(plan.planId), theme) { onOpenPlan(plan.planId) }
                Spacer(Modifier.height(12.dp))
            }
        }
        PlanBackButton(onBack, theme)
    }
}

/** RN NT_DEEP_REPEAT_EXPLORE_ARTICLE_SLUG */
const val NT_DEEP_ARTICLE_SLUG = "a-macarthur-lifelong-bible-reading"

/** 主推卡：两张同底（米白），正式研读多一枚「推荐」小标；徽标 / 标题 24 / 一句话 16 / 要点 chips / 查看 › */
@Composable
fun FeaturedPlanCard(plan: ReadingPlanEntry, isActive: Boolean, theme: Parchment, onOpenArticle: (String) -> Unit = {}, onPress: () -> Unit) {
    val isNtDeep = plan.planId == ReadingPlanCatalog.NT_DEEP_REPEAT_ID
    // 两张主推卡同一个底色：正式研读原来是金底 + 金边，看着像「已选中」，
    // 而真正在用的那张只有右上角徽标，容易读反（Josh 2026-09-10）
    val border = if (isActive) Color(0x6B452D1C) else Color(0x3378350F)
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp))
            .background(Color(0xB8FFFCF5))
            .border(if (isActive) 1.5.dp else 0.5.dp, border, RoundedCornerShape(14.dp))
            .clickableNoRipple(onPress).padding(horizontal = 16.dp, vertical = 16.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(plan.badge, color = Color(0xCC4D3522), fontSize = 14.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.8.sp)
            if (isNtDeep) {
                Text(PlanCopy.t("pages.read.plansFeaturedNtDeepPromo"), Modifier.clip(CircleShape).background(Color(0x47FFB101)).padding(horizontal = 8.dp, vertical = 3.dp),
                     color = Color(0xE04D3522), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.weight(1f))
            if (isActive) PlanStatusPill(PlanText.t("activePill"))
        }
        Text(plan.title, Modifier.padding(top = 8.dp), color = theme.ink.toColor(), fontSize = 24.sp, fontWeight = FontWeight.Bold)
        Text(plan.tagline, Modifier.padding(top = 6.dp), color = Color(0xD62B1D15), fontSize = 17.sp, lineHeight = 25.sp)
        Spacer(Modifier.height(14.dp))
        PlanFactRow(plan.facts, theme = theme)
        if (isNtDeep) {
            PlanLink(PlanCopy.t("pages.read.plansMethodPath2Reference") + " " + PlanCopy.t("pages.read.plansMethodPath2ArticleLink") + " →",
                     theme, size = 14, color = Color(0xB84D3522), modifier = Modifier.padding(top = 10.dp)) { onOpenArticle(NT_DEEP_ARTICLE_SLUG) }
        }
        Row(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.End) {
            Text(PlanText.t("open") + " ›", color = theme.muted.toColor(), fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

/** 经典日课表卡：标题 18 / 英文表名 13 / 一句话 15（最多两行）/ 天数 · 单日段数 chips */
@Composable
private fun ClassicPlanCard(plan: ReadingPlanEntry, isActive: Boolean, theme: Parchment, onPress: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(theme.surface.toColor().copy(alpha = 0.5f))
            .border(if (isActive) 1.dp else 0.5.dp, if (isActive) Color(0x6B452D1C) else theme.border.toColor(), RoundedCornerShape(12.dp))
            .clickableNoRipple(onPress).padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(plan.title, color = theme.ink.toColor(), fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                if (isActive) PlanStatusPill(PlanText.t("activePill"))
            }
            if (plan.subtitle.isNotEmpty()) Text(plan.subtitle, Modifier.padding(top = 3.dp), color = theme.faint.toColor(), fontSize = 14.sp)
            Text(plan.tagline, Modifier.padding(top = 6.dp), color = theme.muted.toColor(), fontSize = 16.sp, lineHeight = 23.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(10.dp))
            PlanFactRow(plan.facts, theme = theme)
        }
        MaterialIcon(MI.CHEVRON_RIGHT, 26f, theme.faint.toColor())
    }
}
