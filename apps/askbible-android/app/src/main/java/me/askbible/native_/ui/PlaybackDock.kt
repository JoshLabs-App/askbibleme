package me.askbible.native_.ui

import android.graphics.BitmapFactory
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
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
    theme: Parchment = Parchment.light,
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
                     modifier = Modifier.width(ShellMetrics.timeLabelMinWidth.dp))
                // MinimalProgressBar：轨 rgba(92,64,48,.22) / 填充 LOGO 黄，高 3 圆角 1.5
                Box(
                    Modifier.weight(1f).height(3.dp).clip(CircleShape).background(Color(0x385C4030))
                ) {
                    Box(Modifier.fillMaxWidth(audio.progress.toFloat()).height(3.dp)
                        .clip(CircleShape).background(Brand.logo.toColor()))
                }
                Text(total, color = theme.muted.toColor(), fontSize = ShellMetrics.timeFontSize.sp,
                     fontWeight = FontWeight.Medium, textAlign = TextAlign.End,
                     modifier = Modifier.width(ShellMetrics.timeLabelMinWidth.dp))
            }

            // 传输控制（transportMarginTop 2）：左搜索 / 中间 gap 28 三件套 / 右下一章
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
                        SpeedRateImage(audio.rate.toDouble(), ink)
                    }

                    // 停止时 ink 底 / surfaceSolid 图标；播放中翻成 LOGO 黄底 / ink 图标；play-arrow 右挪 3（playIconNudge）
                    Box(
                        Modifier.size(ShellMetrics.playButtonSize.dp).clip(CircleShape)
                            .background(if (audio.isPlaying) Brand.logo.toColor() else ink)
                            .alpha(if (available) 1f else 0.35f)
                            .clickableNoRipple { if (available) { if (onToggle != null) onToggle() else audio.toggle() } },
                        contentAlignment = Alignment.Center,
                    ) {
                        val fg = if (audio.isPlaying) ink else theme.surfaceSolid.toColor()
                        // 只有用户点了播放、还没出声时才转圈；开章预载的 BUFFERING 不转（RN 开章不转）
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
                            .background(if (audio.loopMode != LoopMode.OFF) Color(0x1A5C4030) else Color.Transparent)
                            .clickableNoRipple { audio.cycleLoop() },
                        contentAlignment = Alignment.Center,
                    ) {
                        RepeatGlyph(
                            one = audio.loopMode == LoopMode.CHAPTER,
                            color = if (audio.loopMode == LoopMode.OFF) theme.muted.toColor() else ink,
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

/** 语速档位用 RN 同一套预渲染图（scripture-speed-*.png，56×22，tint 成 ink），不受系统字体大小影响 */
@Composable
fun SpeedRateImage(rate: Double, color: Color) {
    val key = when (Math.round(rate * 100).toInt()) {
        75 -> "075"; 125 -> "125"; 150 -> "15"; 175 -> "175"; 200 -> "2"; else -> "1"
    }
    val context = LocalContext.current
    val bitmap = remember(key) {
        runCatching {
            context.assets.open("images/scripture-speed-$key.png").use { BitmapFactory.decodeStream(it) }
        }.getOrNull()?.asImageBitmap()
    }
    if (bitmap != null) {
        Image(
            bitmap, contentDescription = null,
            modifier = Modifier.size(ShellMetrics.speedButtonSize.dp, 22.dp),
            contentScale = ContentScale.Fit,
            colorFilter = ColorFilter.tint(color),
        )
    } else {
        Text(if (key == "1") "1x" else "${rate}x", color = color, fontSize = 22.sp, fontWeight = FontWeight.Bold)
    }
}

/** RN `MusicRepeatAllIcon` / `MusicRepeatOneIcon`（react-native-svg 手绘）：24 格里两段圆角箭头，描边 1.6 圆头；单章版中间一个 8sp 粗体 "1" */
@Composable
fun RepeatGlyph(one: Boolean, color: Color, size: Float = 24f) {
    val s = size / 24f
    Box(Modifier.size(size.dp), contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(size.dp)) {
            val u = this.size.width / 24f
            val p = Path().apply {
                // M7 7h8a4 4 0 0 1 4 4v1（四分之一圆用三次贝塞尔近似，k = 0.5523 × 4）
                moveTo(7 * u, 7 * u); lineTo(15 * u, 7 * u)
                cubicTo(17.21f * u, 7 * u, 19 * u, 8.79f * u, 19 * u, 11 * u)
                lineTo(19 * u, 12 * u)
                // M17 17H9a4 4 0 0 1-4-4v-1
                moveTo(17 * u, 17 * u); lineTo(9 * u, 17 * u)
                cubicTo(6.79f * u, 17 * u, 5 * u, 15.21f * u, 5 * u, 13 * u)
                lineTo(5 * u, 12 * u)
                // M7 4 4 7l3 3   M17 20l3-3-3-3
                moveTo(7 * u, 4 * u); lineTo(4 * u, 7 * u); lineTo(7 * u, 10 * u)
                moveTo(17 * u, 20 * u); lineTo(20 * u, 17 * u); lineTo(17 * u, 14 * u)
            }
            drawPath(p, color, style = Stroke(width = 1.6f * u, cap = StrokeCap.Round, join = StrokeJoin.Round))
        }
        if (one) {
            Text("1", color = color, fontSize = (8 * s).sp, fontWeight = FontWeight.Bold,
                 modifier = Modifier.offset(y = (0.3f * s).dp))
        }
    }
}
