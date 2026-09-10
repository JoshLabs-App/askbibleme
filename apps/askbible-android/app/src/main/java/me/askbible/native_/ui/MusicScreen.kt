package me.askbible.native_.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import me.askbible.native_.audio.ChapterAudioPlayer
import me.askbible.native_.audio.MusicPlayer
import me.askbible.native_.data.MusicAlbumRules
import me.askbible.native_.data.MusicCatalog
import me.askbible.native_.data.MusicRepeatMode
import me.askbible.native_.data.Brand
import me.askbible.native_.data.ShellMetrics
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random



/**
 * 音乐页：专辑舞台（渐变 + 光球 + 各专辑动画，见 MusicSceneViews）+ 底部心境切换与传输控制。
 * 与 iOS 的 MusicView 对等。
 * 播放状态全部来自 MusicPlayer；心境条 = MusicCatalog.albums（与 RN KNOWN_MUSIC_ALBUMS 同序）。
 */
@Composable
fun MusicScreen(player: MusicPlayer, sleepActive: Boolean = false, onSleepTimer: () -> Unit = {}) {
    /** 拖进度条时的预览比例；null = 没在拖 */
    var dragRatio by remember { mutableStateOf<Float?>(null) }
    Box(Modifier.fillMaxSize().background(Color(0xFF0A0908))) {
        // 专辑舞台：渐变 + 光球 + 该专辑的动画层（RN 各专辑各一套：鱼群 / 咖啡豆 / 星月 / 行星）；停播时定格
        MusicAlbumStage(player.album, player.isPlaying)

        // 睡眠定时器
        Box(Modifier.statusBarsPadding().padding(top = 6.dp, end = ShellMetrics.topChromeSideInset.dp)
            .align(Alignment.TopEnd).size(50.dp).clickableNoRipple(onSleepTimer), contentAlignment = Alignment.Center) {
            // RN MusicHomeSleepTimerButton：timer 26，开着 LOGO 黄，否则白
            MaterialIcon(MI.TIMER, 26f, if (sleepActive) Brand.logo.toColor() else Color.White, shadow = true)
        }

        Column(Modifier.fillMaxSize().padding(bottom = (ShellMetrics.tabRowHeight + 30f).dp).navigationBarsPadding()) {
            Spacer(Modifier.weight(1f))

            // 队列窗口：上一曲 / 当前曲 / 下一曲（RN 队列面板滚到当前曲居中的样子）。点上下曲直接切。
            Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp), horizontalAlignment = Alignment.CenterHorizontally,
                   verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(player.previousTrack?.title ?: " ", color = Color(0x57FFFFFF), fontSize = 15.sp, maxLines = 1,
                     overflow = TextOverflow.Ellipsis, modifier = Modifier.clickableNoRipple { player.previous() })
                Text(player.track?.title ?: "\u2014", color = Color.White, fontSize = 23.sp, fontWeight = FontWeight.Bold,
                     maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(player.nextTrack?.title ?: " ", color = Color(0x4DFFFFFF), fontSize = 15.sp, maxLines = 1,
                     overflow = TextOverflow.Ellipsis, modifier = Modifier.clickableNoRipple { player.next() })
            }
            Spacer(Modifier.height(30.dp))

            Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp)) {
                for (album in MusicCatalog.albums) {
                    val on = album == player.album
                    Column(Modifier.weight(1f).clickableNoRipple { player.selectAlbum(album) },
                           horizontalAlignment = Alignment.CenterHorizontally,
                           verticalArrangement = Arrangement.spacedBy(7.dp)) {
                        val g = MusicAlbumGlyph.glyph(album)
                        MaterialIcon(g.first, 24f, if (on) Brand.logo.toColor() else Color.White, community = g.second)
                        Text(MusicAlbumRules.shortLabel(album), color = if (on) Brand.logo.toColor() else Color.White,
                             fontSize = 12.sp, fontWeight = if (on) FontWeight.SemiBold else FontWeight.Normal)
                    }
                }
            }
            Spacer(Modifier.height(22.dp))

            // 进度条：左侧已播、右侧总长（RN 音乐页显示的是总长，不是剩余）；可拖可点
            val ratio = dragRatio ?: player.progress.toFloat()
            val total = player.displayDuration
            Row(Modifier.fillMaxWidth().padding(horizontal = 22.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(ChapterAudioPlayer.timeLabel(ratio * total), color = Color(0x9EFFFFFF), fontSize = 12.sp,
                     modifier = Modifier.width(36.dp))
                Box(Modifier.weight(1f).height(24.dp)
                    .pointerInput(Unit) {
                        detectTapGestures { off -> player.seekRatio((off.x / size.width).toDouble()) }
                    }
                    .pointerInput(Unit) {
                        detectHorizontalDragGestures(
                            onDragStart = { dragRatio = (it.x / size.width).coerceIn(0f, 1f) },
                            onDragEnd = { dragRatio?.let { r -> player.seekRatio(r.toDouble()) }; dragRatio = null },
                            onDragCancel = { dragRatio = null },
                        ) { change, _ -> dragRatio = (change.position.x / size.width).coerceIn(0f, 1f) }
                    }, contentAlignment = Alignment.CenterStart) {
                    Box(Modifier.fillMaxWidth().height(3.dp).clip(CircleShape).background(Color(0x47FFFFFF)))
                    Box(Modifier.fillMaxWidth(ratio.coerceIn(0f, 1f)).height(3.dp).clip(CircleShape).background(Color(0xEBFFFFFF)))
                }
                Text(ChapterAudioPlayer.timeLabel(total), color = Color(0x9EFFFFFF), fontSize = 12.sp,
                     modifier = Modifier.width(36.dp), textAlign = TextAlign.End)
            }
            Spacer(Modifier.height(6.dp))

            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween) {
                // 单曲循环（左）/ 整专辑循环（右）：开着的带圆底，与 RN loopBtnOn 一致
                // RN MusicHomeTransportButtonRow：skip 36 白、播放 64 白底 #1C1410 图标 34、循环自绘 24（开 白 / 关 白 .48）
                LoopButton(one = true, on = player.repeatMode == MusicRepeatMode.ONE) { player.toggleRepeatOne() }
                Box(Modifier.size(48.dp).clickableNoRipple { player.previous() }, contentAlignment = Alignment.Center) {
                    MaterialIcon(MI.SKIP_PREVIOUS, ShellMetrics.skipIconSize, Color.White)
                }
                Box(Modifier.size(ShellMetrics.playButtonSize.dp).clip(CircleShape).background(Color.White).clickableNoRipple { player.toggle() },
                    contentAlignment = Alignment.Center) {
                    if (player.isLoading) {
                        CircularProgressIndicator(color = Color(0xFF1C1410), strokeWidth = 2.dp, modifier = Modifier.size(24.dp))
                    } else {
                        MaterialIcon(if (player.isPlaying) MI.PAUSE else MI.PLAY_ARROW, ShellMetrics.playIconSize, Color(0xFF1C1410),
                                     modifier = Modifier.offset(x = if (player.isPlaying) 0.dp else ShellMetrics.playIconNudge.dp))
                    }
                }
                Box(Modifier.size(48.dp).clickableNoRipple { player.next() }, contentAlignment = Alignment.Center) {
                    MaterialIcon(MI.SKIP_NEXT, ShellMetrics.skipIconSize, Color.White)
                }
                LoopButton(one = false, on = player.repeatMode == MusicRepeatMode.ALL) { player.toggleRepeatAll() }
            }
        }
    }
}

@Composable
private fun LoopButton(one: Boolean, on: Boolean, onClick: () -> Unit) {
    Box(Modifier.size(44.dp).clip(CircleShape).background(if (on) Color(0x24FFFFFF) else Color.Transparent)
        .clickableNoRipple(onClick), contentAlignment = Alignment.Center) {
        RepeatGlyph(one = one, color = if (on) Color.White else Color(0x7AFFFFFF), size = ShellMetrics.loopIconSize)
    }
}
