package me.askbible.native_.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.askbible.native_.audio.DevotionalPlayer
import me.askbible.native_.data.DevotionalDay
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.ReadSize
import me.askbible.native_.data.SolidJoys
import java.time.LocalDate

/** 署名强调色：和读后两版的标题同一个赭色 */
private val ACCENT = Color(0xFF8C5A2A)

/**
 * 读经计划页章节列表下面的「今日灵修」卡片（DECISIONS D-7：入口只在计划页）。
 * 跟着日历选中的那天走；点卡片进灵修页，点右边圆钮直接听。
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
    val ink = theme.ink.toColor(); val muted = theme.muted.toColor()
    Column(Modifier.fillMaxWidth().padding(top = 26.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("今日灵修", color = ink, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.weight(1f))
            Text(SolidJoys.TITLE, color = muted, fontSize = 13.sp)
        }
        Spacer(Modifier.height(8.dp))
        val shape = RoundedCornerShape(12.dp)
        Row(
            Modifier.fillMaxWidth().clip(shape).background(theme.surface.toColor().copy(alpha = 0.85f))
                .border(0.5.dp, theme.border.toColor(), shape)
                .clickableNoRipple { if (day != null) onOpen() else if (state is SolidJoys.State.Failed) onRetry() }
                .padding(start = 16.dp, end = 8.dp, top = 12.dp, bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                when {
                    day != null -> {
                        Text("${day.dateLabel} · ${day.title}", color = ink, fontSize = 17.sp, fontWeight = FontWeight.SemiBold,
                             maxLines = 1, overflow = TextOverflow.Ellipsis)
                        if (day.verse.isNotEmpty()) {
                            Text(day.verse, Modifier.padding(top = 4.dp), color = muted, fontSize = 14.sp, lineHeight = 20.sp,
                                 maxLines = 2, overflow = TextOverflow.Ellipsis)
                        }
                    }
                    state is SolidJoys.State.Failed -> Text("灵修没有载入，点这里重试", color = muted, fontSize = 15.sp)
                    else -> Text("正在准备今日灵修…", color = muted, fontSize = 15.sp)
                }
            }
            if (day?.audio != null) {
                val mine = player.currentKey == day.md
                Box(Modifier.size(44.dp).clickableNoRipple {
                    if (mine && player.isPlaying) player.pause() else player.play(day.md, day.audio, "${day.dateLabel} ${day.title}")
                }, contentAlignment = Alignment.Center) {
                    if (mine && player.isLoading) CircularProgressIndicator(Modifier.size(20.dp), color = muted, strokeWidth = 2.dp)
                    else MaterialIcon(if (mine && player.isPlaying) MI.PAUSE else MI.PLAY_ARROW, 26f, ink)
                }
            } else {
                MaterialIcon(MI.CHEVRON_RIGHT, 22f, muted)
            }
        }
    }
}

/**
 * 灵修页：日期切换 → 标题 → 当天经文（出处可点进那一章）→ 播放条 → 正文 → 固定署名。
 * 署名是授权条件（DG：原作 John Piper / Desiring God；八福：译文与音频署「忠信福音事工」+ befaithful.net），不许拿掉。
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
    val ink = theme.ink.toColor(); val muted = theme.muted.toColor(); val faint = theme.faint.toColor()
    val scale = (size.metrics.verseFontSize / 16f).coerceIn(0.85f, 2.2f)
    val listState = rememberLazyListState()
    LaunchedEffect(date) { listState.scrollToItem(0) }

    Box(Modifier.fillMaxSize()) {
        ParchmentBackground(theme = theme)
        LazyColumn(
            Modifier.fillMaxSize().statusBarsPadding(), state = listState,
            contentPadding = PaddingValues(start = 22.dp, end = 22.dp, top = 8.dp, bottom = 120.dp),
        ) {
            item {
                // 顶栏：返回 · 书名 · 空位对称
                Box(Modifier.fillMaxWidth().height(44.dp), contentAlignment = Alignment.Center) {
                    Box(Modifier.align(Alignment.CenterStart).size(44.dp).clickableNoRipple(onBack), contentAlignment = Alignment.CenterStart) {
                        MaterialIcon(MI.ARROW_BACK, 24f, ink)
                    }
                    Text(SolidJoys.TITLE, color = muted, fontSize = 15.sp, fontWeight = FontWeight.Medium)
                }
                // 日期：‹ 10月1日 ›（前后一天；今天之外显示「回到今天」）
                Row(Modifier.fillMaxWidth().padding(top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(40.dp).clickableNoRipple { onDate(date.minusDays(1)) }, contentAlignment = Alignment.Center) {
                        MaterialIcon(MI.CHEVRON_LEFT, 26f, muted)
                    }
                    Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("${date.monthValue}月${date.dayOfMonth}日", color = muted, fontSize = 15.sp, fontWeight = FontWeight.Medium)
                        if (date != LocalDate.now()) {
                            Text("回到今天", Modifier.padding(top = 2.dp).clickableNoRipple { onDate(LocalDate.now()) },
                                 color = ACCENT, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                        }
                    }
                    Box(Modifier.size(40.dp).clickableNoRipple { onDate(date.plusDays(1)) }, contentAlignment = Alignment.Center) {
                        MaterialIcon(MI.CHEVRON_RIGHT, 26f, muted)
                    }
                }
            }
            if (day == null) {
                item {
                    Text(if (SolidJoys.state is SolidJoys.State.Failed) "灵修没有载入，请检查网络后返回重试" else "正在准备今日灵修…",
                         Modifier.fillMaxWidth().padding(top = 60.dp), color = muted, fontSize = 15.sp, textAlign = TextAlign.Center)
                }
                return@LazyColumn
            }
            item {
                Text(day.title, Modifier.fillMaxWidth().padding(top = 14.dp, bottom = 18.dp), color = ink,
                     fontSize = (24 * scale).sp, lineHeight = (34 * scale).sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                if (day.verse.isNotEmpty()) {
                    // 当天经文：左侧一道赭色竖线的引文块；出处点了进那一章
                    Row(Modifier.fillMaxWidth().padding(bottom = 18.dp)) {
                        Box(Modifier.width(3.dp).height((52 * scale).dp).background(ACCENT.copy(alpha = 0.55f)))
                        Column(Modifier.padding(start = 14.dp)) {
                            Text(day.verse, color = ink, fontSize = (17 * scale).sp, lineHeight = (27 * scale).sp, fontWeight = FontWeight.Medium)
                            val book = day.refBook; val ch = day.refChapter
                            Text("（${day.ref}）", Modifier.padding(top = 6.dp).then(
                                if (book != null && ch != null) Modifier.clickableNoRipple { onOpenChapter(book, ch) } else Modifier),
                                 color = if (book != null) ACCENT else muted, fontSize = (14 * scale).sp, fontWeight = FontWeight.Medium)
                        }
                    }
                }
                if (day.audio != null) DevotionalAudioBar(day, player, theme)
            }
            items(day.paragraphs.size) { i ->
                Text(day.paragraphs[i], Modifier.fillMaxWidth().padding(top = if (i == 0) 20.dp else 0.dp, bottom = (14 * scale).dp),
                     color = ink, fontSize = (17 * scale).sp, lineHeight = (30 * scale).sp)
            }
            item {
                // 署名（授权条件，固定显示）
                Box(Modifier.fillMaxWidth().padding(top = 24.dp).height(0.5.dp).background(theme.border.toColor()))
                Column(Modifier.fillMaxWidth().padding(top = 14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("原作：${SolidJoys.CREDIT_AUTHOR}", color = faint, fontSize = 13.sp)
                    Text("译文与音频：${SolidJoys.CREDIT_TRANSLATION}", color = faint, fontSize = 13.sp)
                    Text("befaithful.net", Modifier.clickableNoRipple {
                        runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(SolidJoys.CREDIT_LINK))) }
                    }, color = ACCENT, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                }
            }
        }
    }
}

/** 播放 / 暂停 + 可拖的进度条 + 时间 */
@Composable
private fun DevotionalAudioBar(day: DevotionalDay, player: DevotionalPlayer, theme: Parchment) {
    val ink = theme.ink.toColor(); val muted = theme.muted.toColor()
    val mine = player.currentKey == day.md
    val playing = mine && player.isPlaying
    var dragging by remember { mutableStateOf<Float?>(null) }
    val dur = if (mine) player.durationMs else 0L
    val pos = if (mine) player.positionMs else 0L
    val shape = RoundedCornerShape(14.dp)
    Row(
        Modifier.fillMaxWidth().clip(shape).background(theme.surface.toColor().copy(alpha = 0.85f))
            .border(0.5.dp, theme.border.toColor(), shape).padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(44.dp).clip(CircleShape).background(ink).clickableNoRipple {
            if (playing) player.pause() else player.play(day.md, day.audio!!, "${day.dateLabel} ${day.title}")
        }, contentAlignment = Alignment.Center) {
            if (mine && player.isLoading) CircularProgressIndicator(Modifier.size(20.dp), color = Color(0xFFF5EFE4), strokeWidth = 2.dp)
            else MaterialIcon(if (playing) MI.PAUSE else MI.PLAY_ARROW, 26f, Color(0xFFF5EFE4))
        }
        Column(Modifier.weight(1f).padding(start = 10.dp)) {
            if (mine && player.failed) {
                Text("音频暂时无法播放，文字照常可读", color = muted, fontSize = 13.sp)
            } else {
                Slider(
                    value = dragging ?: if (dur > 0) (pos.toFloat() / dur).coerceIn(0f, 1f) else 0f,
                    onValueChange = { dragging = it },
                    onValueChangeFinished = { dragging?.let { if (dur > 0) player.seekTo((it * dur).toLong()) }; dragging = null },
                    enabled = mine && dur > 0,
                    colors = SliderDefaults.colors(thumbColor = ink, activeTrackColor = ink, inactiveTrackColor = theme.border.toColor(),
                                                   disabledThumbColor = theme.border.toColor(), disabledInactiveTrackColor = theme.border.toColor()),
                    modifier = Modifier.height(28.dp),
                )
                Row {
                    Text(clock(dragging?.let { (it * dur).toLong() } ?: pos), color = muted, fontSize = 12.sp)
                    Spacer(Modifier.weight(1f))
                    Text(if (dur > 0) clock(dur) else "--:--", color = muted, fontSize = 12.sp)
                }
            }
        }
    }
}

private fun clock(ms: Long): String { val s = ms / 1000; return "%d:%02d".format(s / 60, s % 60) }
