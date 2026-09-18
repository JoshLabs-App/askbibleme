package me.askbible.native_.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.askbible.native_.data.AchievementStore
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.BibleCatalog
import me.askbible.native_.data.MedalCatalog
import me.askbible.native_.data.MedalDef
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.SiteCopy
import me.askbible.native_.data.name

/**
 * 成就页：顶上是等级条和三个数字，中间勋章墙，下面 66 卷书卷印章。
 * 未获得的也全部列出来（压暗 + 进度条）——看得见下一档才有奔头。与 iOS `AchievementsView` 对等。
 */
@Composable
fun AchievementsScreen(
    ach: AchievementStore,
    locale: AppLocale = AppLocale.current,
    theme: Parchment = Parchment.light,
    onBack: () -> Unit = {},
) {
    val insets = WindowInsets.systemBars.asPaddingValues()
    /** 勋章一行 3 枚、印章一行 5 枚：和 iOS 的自适应格子在手机宽度下的结果一致 */
    val medalRows = MedalCatalog.all.chunked(3)
    val sealRows = BibleCatalog.all.chunked(5)

    Box(Modifier.fillMaxSize().background(theme.canvas.toColor())) {
        ParchmentBackground(Modifier.fillMaxSize())
        LazyColumn(
            Modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(
                start = 18.dp, end = 18.dp,
                top = insets.calculateTopPadding() + 56.dp,
                bottom = insets.calculateBottomPadding() + 28.dp,
            ),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item { Header(ach, locale, theme) }

            item {
                SectionTitle(
                    SiteCopy.t("native.medals", locale),
                    SiteCopy.f("native.medalsProgress",
                               mapOf("n" to ach.earned.size.toString(), "total" to MedalCatalog.all.size.toString()), locale),
                    theme,
                )
            }
            items(medalRows.size) { i ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    for (def in medalRows[i]) {
                        Box(Modifier.weight(1f)) {
                            MedalCell(def, ach.earned[def.key]?.tier ?: 0, ach.value(def.metric), locale, theme)
                        }
                    }
                    // 最后一行不足 3 枚：补空位，别把剩下的拉宽
                    repeat(3 - medalRows[i].size) { Spacer(Modifier.weight(1f)) }
                }
            }

            item {
                SectionTitle(
                    SiteCopy.t("native.bookSeals", locale),
                    SiteCopy.f("native.sealsProgress", mapOf("n" to ach.seals.size.toString()), locale),
                    theme,
                )
            }
            items(sealRows.size) { i ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    for (book in sealRows[i]) {
                        val file = MedalCatalog.seals[book.number.coerceIn(1, MedalCatalog.seals.size) - 1]
                        val lit = ach.seals[book.id] != null
                        Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally,
                               verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            MedalIcon(file, if (lit) 1 else 0, 1, 52.dp, theme)
                            Text(book.name(locale), fontSize = 10.sp, maxLines = 1,
                                 textAlign = TextAlign.Center,
                                 color = (if (lit) theme.muted else theme.faint).toColor()
                                     .copy(alpha = if (lit) 1f else 0.55f))
                        }
                    }
                    repeat(5 - sealRows[i].size) { Spacer(Modifier.weight(1f)) }
                }
            }
        }

        // 返回键：浮在顶上，不占内容位
        Box(
            Modifier.padding(top = insets.calculateTopPadding() + 8.dp, start = 10.dp)
                .size(40.dp).clip(CircleShape)
                .background(theme.surface.toColor())
                .clickableNoRipple(onBack),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.ArrowBack, SiteCopy.t("native.closeMenu", locale),
                 Modifier.size(22.dp), tint = theme.ink.toColor())
        }
    }
}

@Composable
private fun Header(ach: AchievementStore, locale: AppLocale, theme: Parchment) {
    Column(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(theme.surfaceSolid.toColor())
            .border(1.dp, theme.border.toColor(), RoundedCornerShape(18.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        XPBar(ach, locale, theme)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Stat(ach.totalXP.toString(), SiteCopy.t("native.totalXP", locale), theme, Modifier.weight(1f))
            VDivider(theme)
            Stat(ach.chaptersReadCount.toString(),
                 SiteCopy.t("native.chaptersReadLabel", locale), theme, Modifier.weight(1f))
            VDivider(theme)
            Stat("×%.2f".format(ach.streakMultiplier),
                 SiteCopy.t("native.streakBonus", locale), theme, Modifier.weight(1f))
        }
    }
}

@Composable
private fun VDivider(theme: Parchment) {
    Box(Modifier.width(1.dp).height(30.dp).background(theme.border.toColor()))
}

@Composable
private fun Stat(value: String, label: String, theme: Parchment, modifier: Modifier = Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally,
           verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(value, color = theme.ink.toColor(), fontSize = 19.sp, fontWeight = FontWeight.ExtraBold)
        Text(label, color = theme.faint.toColor(), fontSize = 11.sp, textAlign = TextAlign.Center)
    }
}

@Composable
private fun SectionTitle(title: String, sub: String, theme: Parchment) {
    Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.Bottom) {
        Text(title, color = theme.ink.toColor(), fontSize = 17.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.weight(1f))
        Text(sub, color = theme.faint.toColor(), fontSize = 12.sp)
    }
}

/** 单枚勋章：图 + 名 + 「离下一档还差多少」的细进度条 */
@Composable
private fun MedalCell(def: MedalDef, tier: Int, current: Int, locale: AppLocale, theme: Parchment) {
    val next = if (tier < def.tiers.size) def.tiers[tier] else null
    val progress = if (next == null) 1f else {
        val from = if (tier > 0) def.tiers[tier - 1] else 0
        ((current - from).toFloat() / maxOf(1, next - from).toFloat()).coerceIn(0f, 1f)
    }
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally,
           verticalArrangement = Arrangement.spacedBy(6.dp)) {
        MedalIcon(def.key, tier, def.tiers.size, 68.dp, theme)
        Text(def.localizedName(locale), fontSize = 12.sp, maxLines = 1, textAlign = TextAlign.Center,
             fontWeight = if (tier > 0) FontWeight.SemiBold else FontWeight.Normal,
             color = (if (tier > 0) theme.ink else theme.faint).toColor())
        if (next != null) {
            Box(Modifier.fillMaxWidth().height(4.dp).clip(CircleShape)
                    .background(theme.border.toColor().copy(alpha = 0.3f))) {
                Box(Modifier.fillMaxWidth(progress.coerceAtLeast(0.02f)).height(4.dp)
                        .clip(CircleShape).background(XPGold.copy(alpha = 0.85f)))
            }
            Text("$current / $next", color = theme.faint.toColor(), fontSize = 10.sp)
        } else {
            Text(def.localizedCondition(tier, locale), color = theme.faint.toColor(),
                 fontSize = 10.sp, maxLines = 1, textAlign = TextAlign.Center)
        }
    }
}
