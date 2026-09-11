package me.askbible.native_.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import me.askbible.native_.data.Brand
import me.askbible.native_.data.ShellMetrics

/**
 * PLAN 是底栏中央键那页（读经计划播放页）：与首页平级的主页面，底栏照常；
 * Josh 2026-09-09「中间计划与旁边的圣经，要直接就切换过来」
 */
enum class ShellTab { HOME, MUSIC, PLAN, READ, EXPLORE }

/** RN `paddingBottom: Math.max(insets.bottom, 8)`：取最大值，不是「导航栏 + 8」叠加 */
@Composable
fun shellTabBarBottomInset(): Dp {
    val nav = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    return maxOf(nav, ShellMetrics.tabBarMinBottomInset.dp)
}

/**
 * 底栏。几何逐值来自 core 的 ShellMetrics（已被 check:tokens 锁住）：
 * row maxWidth 400 / paddingH 12，左右两组各 weight 2 且 SpaceBetween，
 * 中间 account-voice FAB 60×60 marginH 8，tabBtn 高 52，图标 36。
 */
@Composable
fun ShellTabBar(
    selected: ShellTab,
    onSelect: (ShellTab) -> Unit,
    modifier: Modifier = Modifier,
    /** 羊皮卷各页要铺不透明底挡住滚过的内容；整屏视觉的页面透出背景 */
    parchmentScrim: Boolean = false,
    onCenterTap: () -> Unit = {},
) {
    Box(modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        if (parchmentScrim) ParchmentBackground(fillScreen = false, modifier = Modifier.matchParentSize())
        Row(
            Modifier
                .widthIn(max = ShellMetrics.tabRowMaxWidth.dp)
                .fillMaxWidth()
                .padding(horizontal = ShellMetrics.tabRowPaddingH.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(Modifier.weight(2f), horizontalArrangement = Arrangement.SpaceBetween) {
                TabButton(MI.HOME, selected == ShellTab.HOME, Modifier.weight(1f)) { onSelect(ShellTab.HOME) }
                TabButton(MI.MUSIC_NOTE, selected == ShellTab.MUSIC, Modifier.weight(1f)) { onSelect(ShellTab.MUSIC) }
            }

            Box(
                Modifier
                    .padding(horizontal = ShellMetrics.fabMarginH.dp)
                    .size(ShellMetrics.fabSize.dp)
                    .clickableNoRipple(onCenterTap),
                contentAlignment = Alignment.Center,
            ) {
                // RN ShellScripturePlayFab：MaterialCommunityIcons account-voice 30，白 .92
                // 停在计划页时同其它 Tab 一样点亮 LOGO 黄
                MaterialIcon(MCI.ACCOUNT_VOICE, ShellMetrics.fabIconSize,
                             if (selected == ShellTab.PLAN) Brand.logo.toColor() else Color.White.copy(alpha = 0.92f),
                             community = true, shadow = true)
            }

            Row(Modifier.weight(2f), horizontalArrangement = Arrangement.SpaceBetween) {
                TabButton(MI.MENU_BOOK, selected == ShellTab.READ, Modifier.weight(1f)) { onSelect(ShellTab.READ) }
                TabButton(MI.EXPLORE, selected == ShellTab.EXPLORE, Modifier.weight(1f)) { onSelect(ShellTab.EXPLORE) }
            }
        }
    }
}

@Composable
private fun TabButton(glyph: String, active: Boolean, modifier: Modifier, onClick: () -> Unit) {
    Box(
        modifier.height(ShellMetrics.tabButtonHeight.dp).clickableNoRipple(onClick),
        contentAlignment = Alignment.Center,
    ) {
        // 选中 LOGO 黄，未选中白 —— 与 shellTabBarHelpers 一致；字形同 RN 的 MaterialIcons
        MaterialIcon(glyph, ShellMetrics.tabIconSize,
                     if (active) Brand.logo.toColor() else Brand.tabBarIcon.toColor(), shadow = true)
    }
}
