package me.askbible.native_.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.Brand
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.ShellMetrics

enum class ShellTab { HOME, MAP, MUSIC, PLAN, READ, EXPLORE }

@Composable
fun shellTabBarBottomInset(): Dp {
    val nav = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    return maxOf(nav, ShellMetrics.tabBarMinBottomInset.dp)
}

/**
 * 底部五栏导航胶囊，与 iOS ShellTabBar 对齐：
 * 「首页 · 全景 · 今日 · 圣经 · 书房」等权对称图标 + 10.5sp 中文标签，选中态暖琥珀圆角胶囊。
 */
@Composable
fun ShellTabBar(
    selected: ShellTab,
    locale: AppLocale = AppLocale.current,
    onSelect: (ShellTab) -> Unit,
    modifier: Modifier = Modifier,
    parchmentScrim: Boolean = false,
    onCenterTap: () -> Unit = {},
) {
    val dark = isSystemInDarkTheme()
    val onHomeSurface = selected == ShellTab.HOME || selected == ShellTab.MUSIC
    val theme = if (dark) Parchment.dark else Parchment.light
    val pillBg = when {
        onHomeSurface -> Color(0xB8DDE6E4).let { if (dark) Color(0xC21D1A16) else it }
        dark -> Color(0xEB262019)
        else -> Color(0xEBEADEC8)
    }
    val pillBorder = when {
        onHomeSurface -> Color.White.copy(alpha = if (dark) 0.16f else 0.45f)
        else -> theme.borderStrong.toColor()
    }
    val activeInk = if (dark) Brand.logo.toColor() else Color(0xFFB55D08)
    val inactiveInk = when {
        onHomeSurface && !dark -> Color(0xFF1F2726)
        dark -> Color(0xFFE6DAC6).copy(alpha = 0.78f)
        else -> theme.ink.toColor().copy(alpha = 0.82f)
    }

    Box(modifier.fillMaxWidth().padding(horizontal = 16.dp), contentAlignment = Alignment.Center) {
        if (parchmentScrim) ParchmentBackground(fillScreen = false, modifier = Modifier.matchParentSize())
        Row(
            Modifier
                .widthIn(max = ShellMetrics.tabRowMaxWidth.dp)
                .fillMaxWidth()
                .height(58.dp)
                .clip(CircleShape)
                .background(pillBg)
                .border(0.8.dp, pillBorder, CircleShape)
                .padding(horizontal = 6.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            TabPillItem(
                glyph = MI.HOME,
                label = AppLocale.pick("首页", "Home", locale),
                active = selected == ShellTab.HOME || selected == ShellTab.MUSIC,
                activeInk = activeInk,
                inactiveInk = inactiveInk,
                dark = dark,
                modifier = Modifier.weight(1f),
            ) { onSelect(ShellTab.HOME) }

            TabPillItem(
                glyph = MI.LAYERS,
                label = AppLocale.pick("全景", "Story", locale),
                active = selected == ShellTab.MAP,
                activeInk = activeInk,
                inactiveInk = inactiveInk,
                dark = dark,
                modifier = Modifier.weight(1f),
            ) { onSelect(ShellTab.MAP) }

            TabPillItem(
                glyph = MI.TODAY,
                label = AppLocale.pick("今日", "Today", locale),
                active = selected == ShellTab.PLAN,
                activeInk = activeInk,
                inactiveInk = inactiveInk,
                dark = dark,
                modifier = Modifier.weight(1f),
            ) { onCenterTap() }

            TabPillItem(
                glyph = MI.MENU_BOOK,
                label = AppLocale.pick("圣经", "Bible", locale),
                active = selected == ShellTab.READ,
                activeInk = activeInk,
                inactiveInk = inactiveInk,
                dark = dark,
                modifier = Modifier.weight(1f),
            ) { onSelect(ShellTab.READ) }

            TabPillItem(
                glyph = MI.AUTO_STORIES,
                label = AppLocale.pick("书房", "Study", locale),
                active = selected == ShellTab.EXPLORE,
                activeInk = activeInk,
                inactiveInk = inactiveInk,
                dark = dark,
                modifier = Modifier.weight(1f),
            ) { onSelect(ShellTab.EXPLORE) }
        }
    }
}

@Composable
private fun TabPillItem(
    glyph: String,
    label: String,
    active: Boolean,
    activeInk: Color,
    inactiveInk: Color,
    dark: Boolean,
    modifier: Modifier,
    onClick: () -> Unit,
) {
    val activeFill = if (dark) Brand.logo.toColor().copy(alpha = 0.16f) else Color(0x2EB55D08)
    Column(
        modifier
            .height(50.dp)
            .clip(RoundedCornerShape(999.dp))
            .background(if (active) activeFill else Color.Transparent)
            .semantics { contentDescription = label }
            .clickableNoRipple(onClick),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        MaterialIcon(glyph, 22f, if (active) activeInk else inactiveInk)
        Text(
            label,
            color = if (active) activeInk else inactiveInk,
            fontSize = 10.5.sp,
            lineHeight = 12.sp,
            fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
            maxLines = 1,
        )
    }
}
