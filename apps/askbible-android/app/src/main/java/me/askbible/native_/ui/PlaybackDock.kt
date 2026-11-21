package me.askbible.native_.ui

import android.graphics.BitmapFactory
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.askbible.native_.audio.ChapterAudioPlayer
import me.askbible.native_.audio.LoopMode
import me.askbible.native_.data.Brand
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.ShellMetrics

/**
 * 读经播放坞。几何逐值来自 core 的 ShellMetrics（已三端对拍），图标与 RN `ReadScripturePlaybackDock` 同源：
 * 进度行 minHeight 23 / 时间 12sp 500 minWidth 36；下一行分三段，
 * 左 search 24（框 44），中段 gap 28 装「语速图 56×22 + 播放 64（图标 34）+ 循环 44（自绘 24）」，右 skip-next 36（框 48）。
 */
@Composable
fun PlaybackDock(
    audio: ChapterAudioPlayer,
    available: Boolean,
    modifier: Modifier = Modifier,
    theme: Parchment = LocalParchment.current,
    onSearch: () -> Unit = {},
    onSkipNext: () -> Unit = {},
    /** 播放键的自定义动作（计划播放页：没建池时从选中章起播）；null 走 audio.toggle() */
    onToggle: (() -> Unit)? = null,
) {
    val elapsed = ChapterAudioPlayer.timeLabel(audio.currentTime)
    // RN 右侧显示总时长（formatClock(durationSec)），没有时长时是 "—:—"
    val total = if (audio.duration > 0) ChapterAudioPlayer.timeLabel(audio.duration) else "—:—"
    val ink = theme.ink.toColor()

    // 底色由 MainActivity 连坞带底栏一起铺（bottomScrim）；这里不再单独铺一层，两层羊皮纹错位会在坞底露出一条接缝
    Column(modifier.fillMaxWidth()) {
        // RN wrap.borderTop 是 hairline（1 物理像素）的 border 色 —— 在羊皮纹上几乎看不见
        Box(Modifier.fillMaxWidth().height(0.5.dp).background(theme.border.toColor()))

        Column(
            Modifier.padding(
                top = ShellMetrics.dockPaddingTop.dp,
                start = ShellMetrics.dockPaddingH.dp,
                end = ShellMetrics.dockPaddingH.dp,
                bottom = ShellMetrics.dockMarginBottom.dp,
            )
        ) {
            audio.errorMessage?.let {
                Text(it, color = theme.divineSpeech.toColor(), fontSize = 11.sp, maxLines = 1)
            }

            // 进度行（scrubberMarginBottom 2）
            Row(
                Modifier.fillMaxWidth()
                    .defaultMinSize(minHeight = ShellMetrics.scrubberRowHeight.dp)
                    .padding(start = 4.dp, end = 4.dp, bottom = ShellMetrics.dockMarginBottom.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(ShellMetrics.scrubberTimeGap.dp),
            ) {
                Text(elapsed, color = theme.muted.toColor(), fontSize = ShellMetrics.timeFontSize.sp,
                     fontWeight = FontWeight.Medium,
                     softWrap = false, modifier = Modifier.widthIn(min = ShellMetrics.timeLabelMinWidth.dp * androidx.compose.ui.platform.LocalDensity.current.fontScale))
                // MinimalProgressBar：轨 rgba(92,64,48,.22) / 填充 LOGO 黄，高 3 圆角 1.5
                // 可拖动（Josh 2026-09-19「播放条需要可以拉动」）：轨道只有 3dp 点不中，
                // 外面套一个 44dp 高的透明触控框；拖动中显示本地值，避免松手时先弹回旧位置。
                var dragFraction by remember { mutableStateOf<Float?>(null) }
                var trackWidthPx by remember { mutableStateOf(0f) }
                val fraction = dragFraction ?: audio.progress.toFloat().coerceIn(0f, 1f)
                fun seekTo(x: Float) {
                    if (audio.duration > 0 && trackWidthPx > 0f) {
                        audio.seekTo((x / trackWidthPx).coerceIn(0f, 1f) * audio.duration)
                    }
                }
                Box(
                    Modifier.weight(1f).height(44.dp)
                        .onSizeChanged { trackWidthPx = it.width.toFloat() }
                        .pointerInput(Unit) {
                            detectHorizontalDragGestures(
                                onDragStart = { dragFraction = (it.x / size.width).coerceIn(0f, 1f) },
                                onDragEnd = {
                                    dragFraction?.let { f -> seekTo(f * trackWidthPx) }
                                    dragFraction = null
                                },
                                onDragCancel = { dragFraction = null },
                            ) { change, _ ->
                                dragFraction = (change.position.x / size.width).coerceIn(0f, 1f)
                            }
                        }
                        .pointerInput(Unit) {
                            detectTapGestures { seekTo(it.x) }
                        },
                    contentAlignment = Alignment.CenterStart,
                ) {
                    Box(
                        Modifier.fillMaxWidth().height(3.dp).clip(CircleShape)
                            .background(if (theme == Parchment.dark) Color(0x47EDE2CF) else Color(0x385C4030))
                    ) {
                        Box(Modifier.fillMaxWidth(fraction).height(3.dp)
                            .clip(CircleShape).background(Brand.logo.toColor()))
                    }
                }
                Text(total, color = theme.muted.toColor(), fontSize = ShellMetrics.timeFontSize.sp,
                     fontWeight = FontWeight.Medium, textAlign = TextAlign.End,
                     softWrap = false, modifier = Modifier.widthIn(min = ShellMetrics.timeLabelMinWidth.dp * androidx.compose.ui.platform.LocalDensity.current.fontScale))
            }

            // 传输控制：经典 5 键对称布局（左：搜索 · 语速 | 正中：播放 | 右：循环 · 下一章）
            Row(
                Modifier.fillMaxWidth().padding(start = 4.dp, end = 4.dp, top = ShellMetrics.dockMarginBottom.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                GlyphBox(ShellMetrics.loopButtonSize, ShellMetrics.loopIconSize, MI.SEARCH, ink, onSearch)

                Spacer(Modifier.weight(1f))

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(ShellMetrics.transportMainGap.dp),
                ) {
                    Box(
                        Modifier.defaultMinSize(minWidth = ShellMetrics.speedButtonSize.dp,
                                                minHeight = ShellMetrics.transportButtonSize.dp)
                            .clickableNoRipple { audio.cycleRate() },
                        contentAlignment = Alignment.Center,
                    ) {
                        SpeedRateImage(audio.rate.toDouble(), ink, theme.accentOt.toColor())
                    }

                    Box(
                        Modifier.size(ShellMetrics.playButtonSize.dp).clip(CircleShape)
                            .background(if (audio.isPlaying) Brand.logo.toColor() else ink)
                            .alpha(if (available) 1f else 0.35f)
                            .clickableNoRipple { if (available) { if (onToggle != null) onToggle() else audio.toggle() } },
                        contentAlignment = Alignment.Center,
                    ) {
                        val fg = if (audio.isPlaying) ink else theme.surfaceSolid.toColor()
                        if (audio.isLoading && audio.wantsPlayback) {
                            CircularProgressIndicator(color = fg, strokeWidth = 2.dp, modifier = Modifier.size(24.dp))
                        } else {
                            MaterialIcon(
                                if (audio.isPlaying) MI.PAUSE else MI.PLAY_ARROW,
                                ShellMetrics.playIconSize, fg,
                                modifier = Modifier.offset(x = if (audio.isPlaying) 0.dp else ShellMetrics.playIconNudge.dp),
                            )
                        }
                    }

                    Box(
                        Modifier.size(ShellMetrics.loopButtonSize.dp).clip(CircleShape)
                            .background(
                                if (audio.loopMode != LoopMode.FORWARD)
                                    theme.accentOt.toColor().copy(alpha = 0.15f)
                                else Color.Transparent
                            )
                            .clickableNoRipple { audio.cycleLoop() },
                        contentAlignment = Alignment.Center,
                    ) {
                        RepeatGlyph(
                            badge = if (audio.loopMode == LoopMode.CHAPTER) "1" else null,
                            color = if (audio.loopMode == LoopMode.FORWARD) theme.muted.toColor().copy(alpha = 0.85f) else theme.accentOt.toColor(),
                            size = ShellMetrics.loopIconSize,
                        )
                    }
                }

                Spacer(Modifier.weight(1f))

                Box(Modifier.alpha(if (available) 1f else 0.35f)) {
                    GlyphBox(ShellMetrics.transportButtonSize, ShellMetrics.skipIconSize, MI.SKIP_NEXT, ink) {
                        if (available) onSkipNext()
                    }
                }
            }
        }
    }
}

@Composable
private fun GlyphBox(box: Float, icon: Float, glyph: String, tint: Color, onClick: () -> Unit) {
    Box(Modifier.size(box.dp).clickableNoRipple(onClick), contentAlignment = Alignment.Center) {
        MaterialIcon(glyph, icon, tint)
    }
}

/** 圆角线框倍速徽章（1.0x / 1.25x / 1.5x / 2.0x），与循环、跳章保持同一描边粗细与视觉高度 */
@Composable
fun SpeedRateImage(rate: Double, color: Color, accent: Color = Color(0xFFC1660B)) {
    val label = when (Math.round(rate * 100).toInt()) {
        75 -> "0.75x"; 125 -> "1.25x"; 150 -> "1.5x"; 175 -> "1.75x"; 200 -> "2.0x"; else -> "1.0x"
    }
    val active = kotlin.math.abs(rate - 1.0) > 0.01
    val shape = RoundedCornerShape(7.dp)
    Box(
        Modifier
            .defaultMinSize(minWidth = 38.dp, minHeight = 22.dp)
            .clip(shape)
            .background(if (active) accent.copy(alpha = 0.15f) else Color.Transparent)
            .border(1.55.dp, if (active) accent else color.copy(alpha = 0.55f), shape)
            .padding(horizontal = 6.dp, vertical = 2.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            color = if (active) accent else color,
            fontSize = 11.5.sp,
            fontWeight = FontWeight.Bold,
            softWrap = false,
        )
    }
}

/** 对称圆角循环轨（单章循环正中显 "1"，整卷循环与关闭态不塞杂乱细线） */
@Composable
fun RepeatGlyph(badge: String?, color: Color, size: Float = 24f) {
    val s = size / 24f
    Box(Modifier.size(size.dp), contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(size.dp)) {
            val u = this.size.width / 24f
            val p = Path().apply {
                moveTo(17f * u, 3f * u); lineTo(20.5f * u, 6.5f * u); lineTo(17f * u, 10f * u)
                moveTo(3.5f * u, 11f * u); lineTo(3.5f * u, 9.5f * u)
                cubicTo(3.5f * u, 7.84f * u, 4.84f * u, 6.5f * u, 6.5f * u, 6.5f * u)
                lineTo(20.5f * u, 6.5f * u)

                moveTo(7f * u, 21f * u); lineTo(3.5f * u, 17.5f * u); lineTo(7f * u, 14f * u)
                moveTo(20.5f * u, 13f * u); lineTo(20.5f * u, 14.5f * u)
                cubicTo(20.5f * u, 16.16f * u, 19.16f * u, 17.5f * u, 17.5f * u, 17.5f * u)
                lineTo(3.5f * u, 17.5f * u)
            }
            drawPath(p, color, style = Stroke(width = 1.8f * u, cap = StrokeCap.Round, join = StrokeJoin.Round))
        }
        if (badge != null) {
            Text(badge, color = color, fontSize = (8.5f * s).sp, fontWeight = FontWeight.Bold,
                 modifier = Modifier.offset(y = (0.1f * s).dp))
        }
    }
}
