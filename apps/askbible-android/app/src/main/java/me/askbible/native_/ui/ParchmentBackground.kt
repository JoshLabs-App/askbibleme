package me.askbible.native_.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.composed
import androidx.compose.ui.unit.dp
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import me.askbible.native_.data.Parchment

/**
 * 羊皮卷底。对应 RN `ReadParchmentFillLayer`：canvas 实色打底，羊皮 JPG **整张实图**按屏幕尺寸 stretch 铺满
 * （不是半透明叠纹）。之前这里用 multiply 叠 42%，纹理被压得太淡，Josh 特别指出羊皮卷是重要的底纹。
 * 与 iOS 的 ParchmentBackground 对等；纹理拉伸填满不保持宽高比（保持宽高比会撑大容器，RN 也是 stretch）。
 */
@Composable
fun ParchmentBackground(
    modifier: Modifier = Modifier,
    theme: Parchment = Parchment.light,
    textureAlpha: Float = 1f,
    /**
     * 整屏底传 true；用作某块内容的背景时必须传 false 并配合 matchParentSize()，
     * 否则 fillMaxSize 会把它撑满全屏、盖掉别的内容（iOS 侧踩过同类错误）。
     */
    fillScreen: Boolean = true,
) {
    val texture = rememberAssetImage("parchment.jpg")
    val base = if (fillScreen) modifier.fillMaxSize() else modifier
    Box(base.background(theme.canvas.toColor())) {
        if (texture != null) {
            Canvas(Modifier.fillMaxSize()) {
                drawImage(
                    image = texture,
                    dstOffset = IntOffset.Zero,
                    dstSize = IntSize(size.width.toInt(), size.height.toInt()),
                    alpha = textureAlpha,
                )
            }
        }
    }
}

/**
 * 弹层 / 卡片羊皮底。对应 RN `ParchmentModalCard` / `ReadParchmentBackgroundImage`：
 * 羊皮 JPG 按**整屏尺寸**铺、由圆角卡片裁切（卡片露出的是整图左上角那一块，纹理与页面连续），
 * 外加 hairline 的 border 描边。设置面板 / 章节选择 / 串珠 / 环境音 / 定时器等弹层都用它，不要再写纯色底。
 */
fun Modifier.parchmentCard(cornerRadius: androidx.compose.ui.unit.Dp, theme: Parchment = Parchment.light): Modifier = composed {
    val texture = rememberAssetImage("parchment.jpg")
    val shape = androidx.compose.foundation.shape.RoundedCornerShape(cornerRadius)
    val screen = androidx.compose.ui.platform.LocalConfiguration.current
    val density = androidx.compose.ui.platform.LocalDensity.current
    val w = with(density) { screen.screenWidthDp.dp.toPx() }
    val h = with(density) { screen.screenHeightDp.dp.toPx() }
    this.clip(shape)
        .drawBehind {
            drawRect(theme.canvas.toColor())
            if (texture != null) drawImage(image = texture, dstOffset = IntOffset.Zero, dstSize = IntSize(w.toInt(), h.toInt()))
        }
        .border(0.5.dp, theme.border.toColor(), shape)
}
