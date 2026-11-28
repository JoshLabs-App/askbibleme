package me.askbible.native_.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.ShellMetrics

/**
 * AskBible.me 全站唯一羊皮卷页面骨架与原子组件真源（Android）：
 * - 除首页（全屏场景图）外，所有业务页面（今日、全景、圣经、探索、搜索、藏书票、设置等）
 *   一律复用本文件定义的骨架、页头、卡片、胶囊按钮与检索框，严禁各页面单元各自造轮子。
 * - 所有视觉令牌全部来自 [Parchment]（单一色彩与羊皮卷真源），零野生色值、零毛玻璃。
 */
object ParchmentMetrics {
    val HorizontalPadding = 20.dp
    val TopPadding = 16.dp
    val CardRadius = 16.dp
    val SubCardRadius = 12.dp
    val PillRadius = 999.dp
}

/** 唯一非首页页面壳：锁死纹理羊皮卷底 + 状态栏安全区 + 统一左右留白与底部底栏避让。 */
@Composable
fun ParchmentScreenScaffold(
    theme: Parchment = LocalParchment.current,
    extraBottomPadding: Dp = 0.dp,
    listState: LazyListState = rememberLazyListState(),
    content: LazyListScope.() -> Unit,
) {
    val bottom = shellTabBarBottomInset() +
        (ShellMetrics.tabRowHeight + ShellMetrics.tabBarDockGap + 24f).dp +
        extraBottomPadding

    Box(Modifier.fillMaxSize()) {
        ParchmentBackground(theme = theme)
        LazyColumn(
            state = listState,
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding(),
            contentPadding = PaddingValues(
                start = ParchmentMetrics.HorizontalPadding,
                end = ParchmentMetrics.HorizontalPadding,
                top = ParchmentMetrics.TopPadding,
                bottom = bottom,
            ),
            content = content,
        )
    }
}

/** 唯一页面大标题行（28.sp Bold + 13.5.sp 副标题 + 可选右侧胶囊动作，与「今日同行」完全一致）。 */
@Composable
fun ParchmentPageHeader(
    title: String,
    subtitle: String? = null,
    theme: Parchment = LocalParchment.current,
    trailing: (@Composable () -> Unit)? = null,
) {
    val ink = theme.ink.toColor()
    val muted = theme.muted.toColor()
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(
                title,
                color = ink,
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (!subtitle.isNullOrBlank()) {
                Text(
                    subtitle,
                    color = muted,
                    fontSize = 13.5.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 3.dp),
                )
            }
        }
        if (trailing != null) {
            trailing()
        }
    }
}

/** 唯一分组抬头（18.sp Bold + 可选右侧辅助信息或主按钮）。 */
@Composable
fun ParchmentSectionHeader(
    title: String,
    modifier: Modifier = Modifier,
    theme: Parchment = LocalParchment.current,
    trailing: (@Composable () -> Unit)? = null,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            title,
            color = theme.ink.toColor(),
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.weight(1f),
        )
        if (trailing != null) {
            trailing()
        }
    }
}

/** 唯一胶囊按钮（白底边框 / 琥珀主色两种唯一语义）。 */
@Composable
fun ParchmentPillButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    primary: Boolean = false,
    theme: Parchment = LocalParchment.current,
    leading: (@Composable RowScope.() -> Unit)? = null,
) {
    val accent = theme.accentOt.toColor()
    val bg = if (primary) accent else theme.surface.toColor()
    val fg = if (primary) Color(0xFFFFFBF4) else theme.ink.toColor()
    val base = modifier
        .clip(RoundedCornerShape(ParchmentMetrics.PillRadius))
        .background(bg)
        .let {
            if (primary) it else it.border(1.dp, theme.border.toColor(), RoundedCornerShape(ParchmentMetrics.PillRadius))
        }
        .clickableNoRipple(onClick)
        .padding(horizontal = if (primary) 14.dp else 12.dp, vertical = if (primary) 7.dp else 6.dp)

    Row(
        modifier = base,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        if (leading != null) leading()
        Text(
            label,
            color = fg,
            fontSize = if (primary) 13.sp else 12.5.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

/** 唯一羊皮纸内容卡片容器（锁死 16.dp 圆角、纸面透明度与高亮边框）。 */
@Composable
fun ParchmentCard(
    modifier: Modifier = Modifier,
    active: Boolean = false,
    theme: Parchment = LocalParchment.current,
    contentPadding: PaddingValues = PaddingValues(horizontal = 14.dp, vertical = 12.dp),
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val surface = theme.surface.toColor()
    val accent = theme.accentOt.toColor()
    val shape = RoundedCornerShape(ParchmentMetrics.CardRadius)
    val base = modifier
        .fillMaxWidth()
        .clip(shape)
        .background(if (active) surface else surface.copy(alpha = 0.62f))
        .border(
            if (active) 1.dp else 0.75.dp,
            if (active) accent.copy(alpha = 0.55f) else theme.border.toColor(),
            shape,
        )
        .let { if (onClick != null) it.clickableNoRipple(onClick) else it }
        .padding(contentPadding)

    Column(modifier = base, content = content)
}

/** 唯一羊皮纸检索框。 */
@Composable
fun ParchmentSearchBar(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    clearLabel: String,
    modifier: Modifier = Modifier,
    theme: Parchment = LocalParchment.current,
) {
    val ink = theme.ink.toColor()
    val muted = theme.muted.toColor()
    val faint = theme.faint.toColor()
    val accent = theme.accentOt.toColor()
    val shape = RoundedCornerShape(ParchmentMetrics.CardRadius)

    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(shape)
            .background(theme.surface.toColor().copy(alpha = 0.78f))
            .border(0.75.dp, theme.border.toColor(), shape)
            .padding(horizontal = 14.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        MaterialIcon(MI.SEARCH, 18f, muted)
        Box(Modifier.weight(1f)) {
            if (value.isEmpty()) {
                Text(placeholder, color = faint, fontSize = 14.sp)
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                singleLine = true,
                textStyle = TextStyle(color = ink, fontSize = 14.sp),
                cursorBrush = SolidColor(accent),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (value.isNotEmpty()) {
            Text(
                clearLabel,
                color = muted,
                fontSize = 12.5.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.clickableNoRipple { onValueChange("") },
            )
        }
    }
}
