package me.askbible.native_.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineBreak
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.askbible.native_.audio.DevotionalPlayer
import me.askbible.native_.data.Brand
import me.askbible.native_.data.DevotionalDay
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.ReadSize
import me.askbible.native_.data.ShellMetrics
import me.askbible.native_.data.SolidJoys
import java.time.LocalDate

// 灵修页的配色：按 ChatGPT 建议（D-8）把层级拉开——书名 / 日期偏浅，标题最深，正文深棕不用纯黑
private val ACCENT = Color(0xFF8C5A2A)      // 「今日灵修」、出处、回到今天
private val META = Color(0xFF6B5545)        // 书名、日期箭头、播放条文字
private val TITLE = Color(0xFF241F1B)
private val BODY = Color(0xFF2D2722)
private val CREDIT = Color(0xFF765E4C)
private val CREDIT_LINK = Color(0xFF5C3F28)
private val CREDIT_RULE = Color(0x99BFAF9C)
private val ON_DARK = Color(0xFFF5EFE4)

/** 固定文案跟界面语言（繁体界面转繁）；灵修正文本身已按界面语言下载对应的一份 */
private fun zh(text: String) = me.askbible.native_.data.AppLocale.current.zh(text)

/** 「约 3 分钟」 */
private fun minutesLabel(sec: Int?) = sec?.let { zh("约 ${maxOf(1, Math.round(it / 60f))} 分钟") }

/**
 * 读经计划页章节列表下面的「今日灵修」卡片（D-7：入口只在计划页）。
 * 跟着日历选中的那天走；点卡片进灵修页，点右下角「▶ 约 N 分钟」直接听。
 * 版式按 D-8：身份行（今日灵修 · 日期）→ 标题 → 经文摘要 → 右下角播放。
 */
@Composable
fun DevotionalCard(
    day: DevotionalDay?,
    player: DevotionalPlayer,
    theme: Parchment,
    onOpen: () -> Unit,
    onRetry: () -> Unit,
) {
    val state = SolidJoys.state
    val muted = theme.muted.toColor()
    val shape = RoundedCornerShape(18.dp)
    Column(
        Modifier.fillMaxWidth().padding(top = 24.dp).clip(shape).background(theme.surface.toColor().copy(alpha = 0.85f))
            .border(0.5.dp, theme.border.toColor(), shape)
            .clickableNoRipple { if (day != null) onOpen() else if (state is SolidJoys.State.Failed) onRetry() }
            .padding(horizontal = 18.dp, vertical = 16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(zh("今日灵修"), color = ACCENT, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            if (day != null) Text("  ·  ${day.dateLabel}", color = META, fontSize = 14.sp)
        }
        when {
            day != null -> {
                Text(day.title, Modifier.padding(top = 6.dp), color = TITLE, fontSize = 19.sp, lineHeight = 26.sp,
                     fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                if (day.verse.isNotEmpty()) {
                    Text(day.verse, Modifier.padding(top = 6.dp), color = muted, fontSize = 15.sp, lineHeight = 22.sp,
                         maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
                if (day.audio != null) {
                    val mine = player.currentKey == day.md
                    val playing = mine && player.isPlaying
                    Row(Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.End) {
                        Row(
                            Modifier.clip(RoundedCornerShape(20.dp)).border(1.dp, theme.border.toColor(), RoundedCornerShape(20.dp))
                                .clickableNoRipple { if (playing) player.pause() else player.play(day.md, day.audio, "${day.dateLabel} ${day.title}") }
                                .padding(start = 10.dp, end = 14.dp, top = 6.dp, bottom = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            if (mine && player.isLoading) CircularProgressIndicator(Modifier.size(18.dp), color = META, strokeWidth = 2.dp)
                            else MaterialIcon(if (playing) MI.PAUSE else MI.PLAY_ARROW, 22f, TITLE)
                            Text(if (playing) zh("正在播放") else minutesLabel(day.audioSec) ?: zh("收听"),
                                 Modifier.padding(start = 4.dp), color = META, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                        }
                    }
                }
            }
            state is SolidJoys.State.Failed -> Text(zh("灵修没有载入，点这里重试"), Modifier.padding(top = 6.dp), color = muted, fontSize = 15.sp)
            else -> Text(zh("正在准备今日灵修…"), Modifier.padding(top = 6.dp), color = muted, fontSize = 15.sp)
        }
    }
}

/**
 * 灵修页：书名 → ‹ 日期 › → 标题 → 当天经文（出处可点进那一章）→ 朗读条 → 正文 → 署名 → 已读完。
 * 左右滑动换前一天 / 后一天（淡入，不做分页动画）。
 * 署名是授权条件（DG：原作 John Piper / Desiring God；八福：译文与音频署「忠信福音事工」+ befaithful.net），不许拿掉、不许缩小。
 */
@Composable
fun DevotionalScreen(
    date: LocalDate,
    onDate: (LocalDate) -> Unit,
    player: DevotionalPlayer,
    size: ReadSize,
    theme: Parchment,
    onBack: () -> Unit,
    onOpenChapter: (bookId: String, chapter: Int) -> Unit,
) {
    val context = LocalContext.current
    val day = SolidJoys.day(date)
    val muted = theme.muted.toColor(); val faint = theme.faint.toColor()
    // 跟 App 的字号设置走（默认 16 → 1.0）
    val scale = (size.metrics.verseFontSize / 16f).coerceIn(0.85f, 2.2f)
    val listState = rememberLazyListState()
    val fade = remember { Animatable(1f) }
    LaunchedEffect(date) { listState.scrollToItem(0); fade.snapTo(0.35f); fade.animateTo(1f, tween(220)) }
    val swipePx = with(LocalDensity.current) { 90.dp.toPx() }

    Box(
        Modifier.fillMaxSize().pointerInput(date) {
            var dx = 0f
            detectHorizontalDragGestures(
                onDragStart = { dx = 0f },
                onDragEnd = { if (dx <= -swipePx) onDate(date.plusDays(1)) else if (dx >= swipePx) onDate(date.minusDays(1)) },
            ) { _, amount -> dx += amount }
        }
    ) {
        ParchmentBackground(theme = theme)
        LazyColumn(
            Modifier.fillMaxSize().statusBarsPadding().graphicsLayer { alpha = fade.value }, state = listState,
            contentPadding = PaddingValues(start = 24.dp, end = 24.dp, top = 8.dp, bottom = 120.dp),
        ) {
            item {
                // ① 页面身份：返回 · 书名（浅、小）
                Box(Modifier.fillMaxWidth().height(44.dp), contentAlignment = Alignment.Center) {
                    Box(Modifier.align(Alignment.CenterStart).size(44.dp).clickableNoRipple(onBack), contentAlignment = Alignment.CenterStart) {
                        MaterialIcon(MI.ARROW_BACK, 24f, TITLE)
                    }
                    Text(zh(SolidJoys.TITLE), color = META, fontSize = 16.sp, fontWeight = FontWeight.Medium)
                }
                // ② 日期：‹ 9月30日 ›，箭头 48dp 好点；离开今天时下面出「回到今天」
                Row(Modifier.fillMaxWidth().padding(top = 20.dp), verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center) {
                    Box(Modifier.size(48.dp).clickableNoRipple { onDate(date.minusDays(1)) }, contentAlignment = Alignment.Center) {
                        MaterialIcon(MI.CHEVRON_LEFT, 28f, META)
                    }
                    Text("${date.monthValue}月${date.dayOfMonth}日", Modifier.padding(horizontal = 32.dp), color = TITLE,
                         fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                    Box(Modifier.size(48.dp).clickableNoRipple { onDate(date.plusDays(1)) }, contentAlignment = Alignment.Center) {
                        MaterialIcon(MI.CHEVRON_RIGHT, 28f, META)
                    }
                }
                Box(Modifier.fillMaxWidth().height(22.dp), contentAlignment = Alignment.Center) {
                    if (date != LocalDate.now()) {
                        Text(zh("回到今天"), Modifier.clickableNoRipple { onDate(LocalDate.now()) },
                             color = ACCENT, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                    }
                }
            }
            if (day == null) {
                item {
                    Text(zh(if (SolidJoys.state is SolidJoys.State.Failed) "灵修没有载入，请检查网络后返回重试" else "正在准备今日灵修…"),
                         Modifier.fillMaxWidth().padding(top = 60.dp), color = muted, fontSize = 15.sp, textAlign = TextAlign.Center)
                }
                return@LazyColumn
            }
            item {
                // ③ 当日标题：最大最深；均衡断行，不让最后一行只剩一两个字
                Text(day.title, Modifier.fillMaxWidth().padding(top = 18.dp, bottom = 24.dp),
                     style = TextStyle(color = TITLE, fontSize = (30 * scale).sp, lineHeight = (40 * scale).sp, fontWeight = FontWeight.Bold,
                                       textAlign = TextAlign.Center, lineBreak = LineBreak.Heading))
                if (day.verse.isNotEmpty()) {
                    // ④ 当天经文：赭色竖线引文块，正常字重；均衡断行防止「乐。」孤字掉行
                    Row(Modifier.fillMaxWidth().padding(bottom = 22.dp).height(androidx.compose.foundation.layout.IntrinsicSize.Min)) {
                        Box(Modifier.width(3.dp).fillMaxHeight().background(ACCENT.copy(alpha = 0.5f)))
                        Column(Modifier.padding(start = 14.dp)) {
                            Text(day.verse, style = TextStyle(color = TITLE, fontSize = (19 * scale).sp, lineHeight = (32 * scale).sp,
                                                              lineBreak = LineBreak.Heading))
                            val book = day.refBook; val ch = day.refChapter
                            Text("（${day.ref}）", Modifier.padding(top = 10.dp).then(
                                if (book != null && ch != null) Modifier.clickableNoRipple { onOpenChapter(book, ch) } else Modifier),
                                 color = if (book != null) ACCENT else muted, fontSize = (15 * scale).sp, fontWeight = FontWeight.Medium)
                        }
                    }
                }
                if (day.audio != null) DevotionalAudioBar(day, player, theme)
            }
            items(day.paragraphs.size) { i ->
                Text(day.paragraphs[i], Modifier.fillMaxWidth().padding(top = if (i == 0) 28.dp else 0.dp, bottom = (24 * scale).dp),
                     style = TextStyle(color = BODY, fontSize = (18 * scale).sp, lineHeight = (33 * scale).sp, lineBreak = LineBreak.Paragraph))
            }
            item {
                // 署名：出版信息块（授权条件，14sp 清楚可读）
                Box(Modifier.fillMaxWidth().padding(top = 20.dp).height(1.dp).background(CREDIT_RULE))
                Column(Modifier.fillMaxWidth().padding(top = 16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(zh("原作：") + SolidJoys.CREDIT_AUTHOR, color = CREDIT, fontSize = 14.sp, lineHeight = 22.sp)
                    Text(zh("译文与音频：${SolidJoys.CREDIT_TRANSLATION}"), color = CREDIT, fontSize = 14.sp, lineHeight = 22.sp)
                    Text("befaithful.net", Modifier.clickableNoRipple {
                        runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(SolidJoys.CREDIT_LINK))) }
                    }, color = CREDIT_LINK, fontSize = 14.sp, lineHeight = 22.sp, fontWeight = FontWeight.Medium,
                         textDecoration = TextDecoration.Underline)
                }
                // 读完了：一行小字收尾，不打卡、不计数（D-8：完成感要有，但不游戏化）
                Text(zh("✓ 已读完"), Modifier.fillMaxWidth().padding(top = 44.dp), color = faint, fontSize = 14.sp, textAlign = TextAlign.Center)
            }
        }
    }
}

/** 朗读条：整条都能点（播放 / 暂停），进度条可拖；只放「灵修朗读」、进度、时间，不加倍速 / 下载等 */
@Composable
private fun DevotionalAudioBar(day: DevotionalDay, player: DevotionalPlayer, theme: Parchment) {
    val mine = player.currentKey == day.md
    val playing = mine && player.isPlaying
    val dur = if (mine && player.durationMs > 0) player.durationMs else (day.audioSec ?: 0) * 1000L
    val pos = if (mine) player.positionMs else 0L
    val shape = RoundedCornerShape(16.dp)
    val toggle = { if (playing) player.pause() else player.play(day.md, day.audio!!, "${day.dateLabel} ${day.title}") }
    Row(
        Modifier.fillMaxWidth().heightIn(min = 72.dp).clip(shape).background(theme.surface.toColor().copy(alpha = 0.85f))
            .border(0.5.dp, theme.border.toColor(), shape).clickableNoRipple(toggle).padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(48.dp).clip(CircleShape).background(TITLE), contentAlignment = Alignment.Center) {
            if (mine && player.isLoading) CircularProgressIndicator(Modifier.size(20.dp), color = ON_DARK, strokeWidth = 2.dp)
            else MaterialIcon(if (playing) MI.PAUSE else MI.PLAY_ARROW, 26f, ON_DARK)
        }
        Column(Modifier.weight(1f).padding(start = 12.dp)) {
            Text(zh(if (mine && player.failed) "音频暂时无法播放，文字照常可读" else "灵修朗读"), color = META, fontSize = 15.sp, fontWeight = FontWeight.Medium)
            DevotionalProgress(pos, dur, enabled = mine && player.durationMs > 0, onSeek = player::seekTo)
        }
    }
}

/** 4dp 进度条 + 两端时间；轨道外套一层 32dp 高的触控框，点 / 拖都能定位 */
@Composable
private fun DevotionalProgress(pos: Long, dur: Long, enabled: Boolean, onSeek: (Long) -> Unit) {
    var drag by remember { mutableStateOf<Float?>(null) }
    var widthPx by remember { mutableStateOf(1f) }
    val fraction = drag ?: if (dur > 0) (pos.toFloat() / dur).coerceIn(0f, 1f) else 0f
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(clock(drag?.let { (it * dur).toLong() } ?: pos), Modifier.width(40.dp), color = META, fontSize = 13.sp)
        Box(
            Modifier.weight(1f).height(32.dp).onSizeChanged { widthPx = it.width.toFloat().coerceAtLeast(1f) }
                .then(if (!enabled) Modifier else Modifier
                    .pointerInput(dur) {
                        detectHorizontalDragGestures(
                            onDragStart = { drag = (it.x / widthPx).coerceIn(0f, 1f) },
                            onDragEnd = { drag?.let { onSeek((it * dur).toLong()) }; drag = null },
                            onDragCancel = { drag = null },
                        ) { change, _ -> drag = (change.position.x / widthPx).coerceIn(0f, 1f) }
                    }
                    .pointerInput(dur) { detectTapGestures { onSeek(((it.x / widthPx).coerceIn(0f, 1f) * dur).toLong()) } }),
            contentAlignment = Alignment.CenterStart,
        ) {
            Box(Modifier.fillMaxWidth().height(4.dp).clip(CircleShape).background(Color(0x385C4030))) {
                Box(Modifier.fillMaxWidth(fraction).height(4.dp).clip(CircleShape).background(Brand.logo.toColor()))
            }
        }
        Text(if (dur > 0) clock(dur) else "--:--", Modifier.width(40.dp), color = META, fontSize = 13.sp, textAlign = TextAlign.End)
    }
}

/**
 * 计划页底部播放坞在播灵修时换成这一条（D-8：一个时间只有一个声音来源，坞上写清在听什么）。
 * 上：书名 · 篇名（点了进灵修页）+ ×（关掉灵修，坞恢复成读经）；下：进度 + 播放 / 暂停。
 */
@Composable
fun DevotionalDock(player: DevotionalPlayer, theme: Parchment, onOpen: () -> Unit) {
    val key = player.currentKey ?: return
    val day = SolidJoys.dayByKey(key)
    Column(Modifier.fillMaxWidth()) {
        Box(Modifier.fillMaxWidth().height(0.5.dp).background(theme.border.toColor()))
        Column(Modifier.fillMaxWidth().defaultMinSize(minHeight = ShellMetrics.dockContentHeight.dp)
            .padding(start = ShellMetrics.dockPaddingH.dp + 4.dp, end = ShellMetrics.dockPaddingH.dp, top = 10.dp, bottom = 6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f).clickableNoRipple(onOpen)) {
                    Text(zh(SolidJoys.TITLE), color = META, fontSize = 13.sp)
                    Text(day?.let { "${it.dateLabel} · ${it.title}" } ?: "", color = TITLE, fontSize = 16.sp, fontWeight = FontWeight.SemiBold,
                         maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Box(Modifier.size(40.dp).clickableNoRipple { player.stop() }, contentAlignment = Alignment.Center) {
                    MaterialIcon(MI.CLOSE, 20f, META)
                }
            }
            Row(Modifier.padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f)) {
                    DevotionalProgress(player.positionMs, player.durationMs, enabled = player.durationMs > 0, onSeek = player::seekTo)
                }
                Box(Modifier.padding(start = 10.dp).size(52.dp).clip(CircleShape).background(TITLE).clickableNoRipple {
                    if (player.isPlaying) player.pause() else day?.audio?.let { player.play(day.md, it, "${day.dateLabel} ${day.title}") }
                }, contentAlignment = Alignment.Center) {
                    if (player.isLoading) CircularProgressIndicator(Modifier.size(22.dp), color = ON_DARK, strokeWidth = 2.dp)
                    else MaterialIcon(if (player.isPlaying) MI.PAUSE else MI.PLAY_ARROW, 28f, ON_DARK)
                }
            }
        }
    }
}

private fun clock(ms: Long): String { val s = ms / 1000; return "%d:%02d".format(s / 60, s % 60) }
