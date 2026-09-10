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
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.lazy.LazyColumn
import kotlinx.coroutines.delay
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.animation.fadeOut
import androidx.compose.animation.fadeIn
import androidx.compose.animation.AnimatedVisibility
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
fun MusicScreen(player: MusicPlayer, sleepActive: Boolean = false, onSleepTimer: () -> Unit = {},
                /** 睡眠专辑自动隐藏了按钮时通知壳把底栏也藏起来（RN setMusicAutoHideChrome → ShellTabBar） */
                onChromeHidden: (Boolean) -> Unit = {}) {
    /** 拖进度条时的预览比例；null = 没在拖 */
    var dragRatio by remember { mutableStateOf<Float?>(null) }
    // RN useMusicHomeSleepAutoHide：睡眠专辑放着的时候 5 秒没碰屏幕就把按钮 / 曲名 / 定时器都藏起来，碰一下再出现并重新计时
    var uiVisible by remember { mutableStateOf(true) }
    var touchTick by remember { mutableIntStateOf(0) }
    val sleepAutoHide = player.album == "睡眠" && player.isPlaying && player.track != null
    LaunchedEffect(sleepAutoHide, touchTick) {
        uiVisible = true
        if (sleepAutoHide) { delay(5_000); uiVisible = false }
    }
    LaunchedEffect(uiVisible) { onChromeHidden(!uiVisible) }
    DisposableEffect(Unit) { onDispose { onChromeHidden(false) } }
    Box(Modifier.fillMaxSize().background(Color(0xFF0A0908))
        // 任何触碰都算「用户还在」：不吞事件，按钮照常响应（RN root onTouchStart={resetUiAutoHide}）
        .pointerInput(Unit) { awaitEachGesture { awaitFirstDown(requireUnconsumed = false); touchTick += 1 } }) {
        // 专辑舞台：渐变 + 光球 + 该专辑的动画层（RN 各专辑各一套：鱼群 / 咖啡豆 / 星月 / 行星）；停播时定格
        MusicAlbumStage(player.album, player.isPlaying)
        // RN MusicHomeStageTapSurface：视觉大区域点一下暂停、再点一下播放（曲目列表与按钮在上层，不受影响）
        // 只盖舞台上半段（曲目列表以上），列表 / 按钮藏起来后点下半段只算「碰一下回来」
        Box(Modifier.fillMaxWidth().fillMaxHeight(0.42f).clickableNoRipple { if (player.track != null) player.toggle() })

        // 睡眠定时器
        AnimatedVisibility(uiVisible, Modifier.align(Alignment.TopEnd), enter = fadeIn(), exit = fadeOut()) {
        Box(Modifier.statusBarsPadding().padding(top = 6.dp, end = ShellMetrics.topChromeSideInset.dp)
            .size(50.dp).clickableNoRipple(onSleepTimer), contentAlignment = Alignment.Center) {
            // RN MusicHomeSleepTimerButton：timer 26，开着 LOGO 黄，否则白
            MaterialIcon(MI.TIMER, 26f, if (sleepActive) Brand.logo.toColor() else Color.White, shadow = true)
        }
        }

        AnimatedVisibility(uiVisible, enter = fadeIn(), exit = fadeOut()) {
        Column(Modifier.fillMaxSize().padding(bottom = (ShellMetrics.tabRowHeight + 30f).dp).navigationBarsPadding()) {
            Spacer(Modifier.weight(1f))

            // 队列面板（RN MusicHomeQueuePanel）：当前专辑全部曲目可上下滑，40dp 一行、视口 168、首尾留白让任一行能滚到正中，上下 46dp 渐隐；
            // 当前曲 18 号白粗体，其余 14 号白 48%；点哪首就切哪首；切曲后自动滚到正中。
            val queue = player.queue
            val queueState = rememberLazyListState()
            val density = LocalDensity.current
            LaunchedEffect(player.trackIndex, queue) {
                val idx = queue.indexOf(player.trackIndex)
                if (idx >= 0) queueState.animateScrollToItem(idx + 1, with(density) { -((168 - 40) / 2).dp.roundToPx() })
            }
            val fade = 46f / 168f
            LazyColumn(
                state = queueState,
                modifier = Modifier.widthIn(max = 300.dp).fillMaxWidth().height(168.dp).align(Alignment.CenterHorizontally)
                    .graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
                    .drawWithContent {
                        drawContent()
                        drawRect(Brush.verticalGradient(0f to Color.Transparent, fade to Color.Black, 1f - fade to Color.Black, 1f to Color.Transparent),
                                 blendMode = BlendMode.DstIn)
                    },
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                item { Spacer(Modifier.height(((168 - 40) / 2).dp)) }
                items(queue.size, key = { queue[it] }) { pos ->
                    val i = queue[pos]
                    val active = i == player.trackIndex
                    Text(MusicCatalog.tracks[i].title, color = if (active) Color.White else Color(0x7AFFFFFF),
                         fontSize = if (active) 18.sp else 14.sp, fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal,
                         maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center,
                         modifier = Modifier.fillMaxWidth().height(40.dp).padding(horizontal = 4.dp).wrapContentHeight(Alignment.CenterVertically)
                             .clickableNoRipple { player.select(i) })
                }
                item { Spacer(Modifier.height(((168 - 40) / 2).dp)) }
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
}

@Composable
private fun LoopButton(one: Boolean, on: Boolean, onClick: () -> Unit) {
    Box(Modifier.size(44.dp).clip(CircleShape).background(if (on) Color(0x24FFFFFF) else Color.Transparent)
        .clickableNoRipple(onClick), contentAlignment = Alignment.Center) {
        RepeatGlyph(one = one, color = if (on) Color.White else Color(0x7AFFFFFF), size = ShellMetrics.loopIconSize)
    }
}
