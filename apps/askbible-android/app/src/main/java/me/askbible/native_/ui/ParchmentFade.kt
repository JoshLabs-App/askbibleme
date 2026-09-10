package me.askbible.native_.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import me.askbible.native_.data.Parchment

/**
 * 羊皮卷滚动页的顶 / 底渐隐。逐值搬自 RN `readParchmentScrollMask.tsx`，与 iOS 的 ParchmentFade 对等：
 * - TABBAR（目录 / 探索等主 Tab 页）：顶 70、底 120，贴近底栏 80 处只剩 3% —— 正文从透明的底栏下面滑过去，看不到硬边；
 * - CHAPTER（章页正文）：只保留顶部 70 的渐隐，底部由播放坞遮挡（坞后面铺的是与页面同一张、钉在屏幕底的羊皮图）。
 * 内容要按 RN `readParchmentFadeSafePadding` 多留顶 70 / 底 120 的边，免得头尾被淡掉。
 */
enum class ParchmentFadePreset(val edgeFadeTop: Float, val edgeFadeBottom: Float, val tabNear: Float, val topTabNear: Float, val tabMaskOpacity: Float) {
    TABBAR(70f, 120f, 80f, 30f, 0.03f),
    CHAPTER(70f, 0f, 0f, 30f, 0.03f);

    /** RN maskStops：按视口高度（px）算出的渐变停靠点（0 = 顶） */
    fun stops(viewportPx: Float, density: Float): Array<Pair<Float, Color>> {
        val h = maxOf(viewportPx, 1f)
        val topTab = minOf(0.4f, topTabNear * density / h)
        val topEnd = minOf(0.48f, maxOf(topTab + 0.02f, edgeFadeTop * density / h))
        val topBlend = topTab + (topEnd - topTab) * 0.45f
        val top = arrayOf(
            0f to Color.Black.copy(alpha = 0f),
            topTab to Color.Black.copy(alpha = tabMaskOpacity),
            topBlend to Color.Black.copy(alpha = 0.42f),
            topEnd to Color.Black,
        )
        if (edgeFadeBottom <= 0f) return top + arrayOf(1f to Color.Black)
        val fadeStart = maxOf(topEnd + 0.02f, 1f - edgeFadeBottom * density / h)
        val tabNearLoc = minOf(0.999f, maxOf(fadeStart + 0.02f, 1f - tabNear * density / h))
        val bottomBlend = fadeStart + (tabNearLoc - fadeStart) * 0.45f
        return top + arrayOf(
            fadeStart to Color.Black,
            bottomBlend to Color.Black.copy(alpha = 0.42f),
            tabNearLoc to Color.Black.copy(alpha = tabMaskOpacity),
            1f to Color.Black.copy(alpha = 0f),
        )
    }
}

/** 给滚动容器套上顶 / 底渐隐（DstIn：内容乘以遮罩的 alpha） */
fun Modifier.parchmentFade(preset: ParchmentFadePreset): Modifier =
    this.graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
        .drawWithContent {
            drawContent()
            drawRect(
                brush = Brush.verticalGradient(*preset.stops(size.height, density), startY = 0f, endY = size.height),
                blendMode = BlendMode.DstIn,
            )
        }

/** RN SHELL_TAB_BAR_CLEARANCE：主 Tab 滚动页内容底部至少留这么多给底栏（再加导航栏与渐隐区） */
const val TAB_BAR_CLEARANCE = 72f

/**
 * 坞 + 底栏后面的羊皮底：与页面同一张羊皮图、按整个窗口尺寸钉在屏幕底再裁到宿主高度，
 * 像素与页面底图完全重合，所以看不出接缝（RN `scriptureDockParchmentHost` + `ReadParchmentFillLayer pinBottom`）。
 * 与 iOS 的 ParchmentPinnedBottom 对等。
 */
@Composable
fun ParchmentPinnedBottom(modifier: Modifier = Modifier, theme: Parchment = Parchment.light) {
    val texture = rememberAssetImage("parchment.jpg")
    val view = LocalView.current
    // Canvas 默认不裁切：整窗口大的 drawImage 会画到宿主外面、盖住上面的正文（实测章页整页被盖成空羊皮），必须 clipToBounds
    Box(modifier.fillMaxWidth().clipToBounds()) {
        Canvas(Modifier.matchParentSize().clipToBounds()) {
            drawRect(theme.canvas.toColor())
            if (texture != null) {
                val w = view.width.takeIf { it > 0 } ?: size.width.toInt()
                val h = view.height.takeIf { it > 0 } ?: size.height.toInt()
                drawImage(image = texture, dstOffset = IntOffset(0, size.height.toInt() - h), dstSize = IntSize(w, h))
            }
        }
    }
}
