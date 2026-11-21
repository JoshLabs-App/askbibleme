package me.askbible.native_.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.LineBreak
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import me.askbible.native_.audio.DevotionalPlayer
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.Brand
import me.askbible.native_.data.DevotionalDay
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.ReadSize
import me.askbible.native_.data.ShellMetrics
import me.askbible.native_.data.SolidJoys
import java.time.LocalDate

private val ON_DARK = Color(0xFFF5EFE4)

/** 固定文案跟界面语言（繁体界面转繁）；灵修正文本身已按界面语言下载对应的一份 */
private fun zh(text: String) = AppLocale.current.zh(text)

/** 「约 3 分钟」 */
private fun minutesLabel(sec: Int?) = sec?.let { zh("约 ${maxOf(1, Math.round(it / 60f))} 分钟") }

/**
 * 今日同行页底部的「每日灵修」卡片（D-7：入口只在计划页）。
 * 直接展示简单标题、经文出处与 3 行内容简要；点卡片进入全年 12 个月分类目录与搜索收听页，点右下角直接听。
 */
@Composable
fun DevotionalCard(
    day: DevotionalDay?,
    player: DevotionalPlayer,
    theme: Parchment,
    onOpen: () -> Unit,
    onRetry: () -> Unit,
    autoRead: Boolean,
    onAutoRead: (Boolean) -> Unit,
) {
    val state = SolidJoys.state
    val ink = theme.ink.toColor()
    val inkSoft = theme.inkSoft.toColor()
    val muted = theme.muted.toColor()
    val faint = theme.faint.toColor()
    val accent = theme.accentOt.toColor()
    val shape = RoundedCornerShape(18.dp)

    Column(
        Modifier
            .fillMaxWidth()
            .padding(top = 24.dp)
            .clip(shape)
            .background(theme.surface.toColor())
            .border(1.dp, theme.border.toColor(), shape)
            .padding(horizontal = 16.dp, vertical = 14.dp),
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .clickableNoRipple {
                    if (day != null || state is SolidJoys.State.Ready) onOpen()
                    else if (state is SolidJoys.State.Failed) onRetry()
                },
        ) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(zh("每日灵修"), color = accent, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                if (day != null) {
                    Text(" · ${zh(day.dateLabel)}", color = muted, fontSize = 13.5.sp, fontWeight = FontWeight.Medium)
                }
                Spacer(Modifier.weight(1f))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(zh("全年目录"), color = accent, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
                    MaterialIcon(MI.CHEVRON_RIGHT, 16f, accent)
                }
            }

            when {
                day != null -> {
                    Text(
                        day.title,
                        Modifier.padding(top = 8.dp),
                        color = ink,
                        fontSize = 19.sp,
                        lineHeight = 26.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (day.ref.isNotEmpty()) {
                        Text(
                            day.ref,
                            Modifier.padding(top = 4.dp),
                            color = accent.copy(alpha = 0.9f),
                            fontSize = 12.5.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    if (day.brief.isNotEmpty()) {
                        Text(
                            day.brief,
                            Modifier.padding(top = 6.dp),
                            color = inkSoft,
                            fontSize = 14.5.sp,
                            lineHeight = 22.sp,
                            maxLines = 3,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                state is SolidJoys.State.Failed -> {
                    Text(zh("灵修没有载入，点这里重试"), Modifier.padding(top = 10.dp), color = muted, fontSize = 15.sp)
                }
                else -> {
                    Text(zh("正在准备每日灵修…"), Modifier.padding(top = 10.dp), color = muted, fontSize = 15.sp)
                }
            }
        }

        Box(Modifier.fillMaxWidth().padding(vertical = 12.dp).height(0.75.dp).background(theme.border.toColor()))

        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Row(
                Modifier
                    .defaultMinSize(minHeight = 40.dp)
                    .clickableNoRipple { onAutoRead(!autoRead) },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(7.dp),
            ) {
                Box(
                    Modifier
                        .size(18.dp)
                        .clip(CircleShape)
                        .background(if (autoRead) accent else Color.Transparent)
                        .border(1.2.dp, if (autoRead) accent else faint, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    if (autoRead) MaterialIcon(MI.CHECK, 12f, Color(0xFFFFFBF4))
                }
                Text(zh("读经后接着听"), color = muted, fontSize = 13.5.sp, fontWeight = FontWeight.Medium)
            }

            Spacer(Modifier.weight(1f))

            if (day?.audio != null) {
                val mine = player.currentKey == day.md
                val playing = mine && player.isPlaying
                Row(
                    Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(if (playing) accent else accent.copy(alpha = 0.14f))
                        .border(
                            1.dp,
                            if (playing) Color.Transparent else accent.copy(alpha = 0.32f),
                            RoundedCornerShape(999.dp),
                        )
                        .clickableNoRipple {
                            if (playing) player.pause() else player.play(day.md, day.audio, "${day.dateLabel} ${day.title}")
                        }
                        .padding(horizontal = 13.dp, vertical = 7.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(5.dp),
                ) {
                    if (mine && player.isLoading) {
                        CircularProgressIndicator(Modifier.size(15.dp), color = if (playing) Color(0xFFFFFBF4) else accent, strokeWidth = 2.dp)
                    } else {
                        MaterialIcon(if (playing) MI.PAUSE else MI.PLAY_ARROW, 17f, if (playing) Color(0xFFFFFBF4) else accent)
                    }
                    Text(
                        if (playing) zh("正在播放") else minutesLabel(day.audioSec)?.let { "${zh("收听")} · $it" } ?: zh("收听"),
                        color = if (playing) Color(0xFFFFFBF4) else accent,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }
    }
}

/**
 * 每日灵修全页：
 * 顶栏 → 当前选定篇卡片（朗读进度条 + 可展开全文阅读 + 经文跳转） → 搜索框 → 1–12 月分类胶囊 → 每日标题与简要列表（点选任意一天来听/读） → 版权署名。
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
    val scope = rememberCoroutineScope()
    val state = SolidJoys.state
    val allDays = remember(state) { SolidJoys.orderedDays() }
    val day = SolidJoys.day(date)
    val ink = theme.ink.toColor()
    val inkSoft = theme.inkSoft.toColor()
    val muted = theme.muted.toColor()
    val faint = theme.faint.toColor()
    val accent = theme.accentOt.toColor()
    val scale = (size.metrics.verseFontSize / 16f).coerceIn(0.85f, 2.0f)

    var selectedMonth by remember { mutableIntStateOf(date.monthValue.coerceIn(1, 12)) }
    var query by remember { mutableStateOf("") }
    var articleExpanded by remember { mutableStateOf(false) }

    val listState = rememberLazyListState()
    val monthRowState = rememberLazyListState()

    LaunchedEffect(selectedMonth) {
        val targetIndex = selectedMonth.coerceIn(0, 12)
        runCatching { monthRowState.animateScrollToItem(maxOf(0, targetIndex - 2)) }
    }

    val trimmedQuery = query.trim()
    val filteredGroups = remember(allDays, selectedMonth, trimmedQuery) {
        val matched = allDays.filter { item ->
            (selectedMonth == 0 || item.month == selectedMonth) && item.matches(trimmedQuery)
        }
        val byMonth = matched.groupBy { it.month }
        (1..12).mapNotNull { m ->
            val items = byMonth[m]
            if (items.isNullOrEmpty()) null else m to items
        }
    }
    val totalHitCount = remember(filteredGroups) { filteredGroups.sumOf { it.second.size } }

    Box(Modifier.fillMaxSize()) {
        ParchmentBackground(theme = theme)
        LazyColumn(
            modifier = Modifier.fillMaxSize().statusBarsPadding(),
            state = listState,
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 56.dp),
        ) {
            item(key = "top-bar") {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier.size(40.dp).clickableNoRipple(onBack),
                        contentAlignment = Alignment.CenterStart,
                    ) {
                        MaterialIcon(MI.ARROW_BACK, 24f, ink)
                    }
                    Column(Modifier.weight(1f)) {
                        Text(zh("每日灵修"), color = ink, fontSize = 21.sp, fontWeight = FontWeight.Bold)
                        Text(
                            zh("${SolidJoys.TITLE} · 全年 365 篇"),
                            color = muted,
                            fontSize = 12.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    if (date != LocalDate.now()) {
                        Box(
                            Modifier
                                .clip(RoundedCornerShape(999.dp))
                                .background(accent.copy(alpha = 0.14f))
                                .clickableNoRipple {
                                    val now = LocalDate.now()
                                    onDate(now)
                                    selectedMonth = now.monthValue
                                }
                                .padding(horizontal = 11.dp, vertical = 6.dp),
                        ) {
                            Text(zh("回到今日"), color = accent, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }

            if (allDays.isEmpty()) {
                item(key = "loading-or-failed") {
                    Column(
                        Modifier.fillMaxWidth().padding(top = 64.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        if (state is SolidJoys.State.Failed) {
                            Text(zh("灵修内容未能载入，请检查网络后重试"), color = muted, fontSize = 15.sp, textAlign = TextAlign.Center)
                            Box(
                                Modifier
                                    .clip(RoundedCornerShape(999.dp))
                                    .background(accent)
                                    .clickableNoRipple { SolidJoys.ensureLoaded(context, AppLocale.current) }
                                    .padding(horizontal = 18.dp, vertical = 9.dp),
                            ) {
                                Text(zh("点这里重试"), color = Color(0xFFFFFBF4), fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                            }
                        } else {
                            CircularProgressIndicator(Modifier.size(26.dp), color = accent, strokeWidth = 2.5.dp)
                            Text(zh("正在准备全年灵修目录…"), color = muted, fontSize = 14.sp)
                        }
                    }
                }
                return@LazyColumn
            }

            if (day != null) {
                item(key = "active-day") {
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .padding(top = 12.dp)
                            .clip(RoundedCornerShape(18.dp))
                            .background(theme.surface.toColor())
                            .border(1.dp, accent.copy(alpha = 0.45f), RoundedCornerShape(18.dp))
                            .padding(16.dp),
                    ) {
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                Modifier
                                    .size(32.dp)
                                    .clip(CircleShape)
                                    .background(ink.copy(alpha = 0.06f))
                                    .clickableNoRipple { onDate(date.minusDays(1)) },
                                contentAlignment = Alignment.Center,
                            ) {
                                MaterialIcon(MI.CHEVRON_LEFT, 20f, muted)
                            }
                            Text(
                                zh(day.dateLabel),
                                Modifier.padding(horizontal = 10.dp),
                                color = accent,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                            )
                            Box(
                                Modifier
                                    .size(32.dp)
                                    .clip(CircleShape)
                                    .background(ink.copy(alpha = 0.06f))
                                    .clickableNoRipple { onDate(date.plusDays(1)) },
                                contentAlignment = Alignment.Center,
                            ) {
                                MaterialIcon(MI.CHEVRON_RIGHT, 20f, muted)
                            }

                            Spacer(Modifier.weight(1f))

                            if (day.ref.isNotEmpty()) {
                                val book = day.refBook
                                val ch = day.refChapter
                                Text(
                                    "（${day.ref}）",
                                    modifier = if (book != null && ch != null) {
                                        Modifier.clickableNoRipple { onOpenChapter(book, ch) }
                                    } else {
                                        Modifier
                                    },
                                    color = if (book != null) accent else muted,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                        }

                        Text(
                            day.title,
                            Modifier.padding(top = 10.dp, bottom = 12.dp),
                            style = TextStyle(
                                color = ink,
                                fontSize = (21 * scale).sp,
                                lineHeight = (29 * scale).sp,
                                fontWeight = FontWeight.Bold,
                                lineBreak = LineBreak.Heading,
                            ),
                        )

                        if (day.audio != null) {
                            DevotionalAudioBar(day, player, theme)
                        }

                        if (articleExpanded) {
                            if (day.verse.isNotEmpty()) {
                                Row(
                                    Modifier
                                        .fillMaxWidth()
                                        .padding(top = 14.dp, bottom = 8.dp)
                                        .height(IntrinsicSize.Min),
                                ) {
                                    Box(Modifier.width(3.dp).fillMaxHeight().background(accent.copy(alpha = 0.55f)))
                                    Column(Modifier.padding(start = 12.dp)) {
                                        Text(
                                            day.verse,
                                            style = TextStyle(
                                                color = ink,
                                                fontSize = (16.5f * scale).sp,
                                                lineHeight = (27 * scale).sp,
                                                lineBreak = LineBreak.Heading,
                                            ),
                                        )
                                        if (day.ref.isNotEmpty()) {
                                            val book = day.refBook
                                            val ch = day.refChapter
                                            Text(
                                                "— ${day.ref}",
                                                Modifier.padding(top = 6.dp).then(
                                                    if (book != null && ch != null) Modifier.clickableNoRipple { onOpenChapter(book, ch) } else Modifier,
                                                ),
                                                color = if (book != null) accent else muted,
                                                fontSize = (13.5f * scale).sp,
                                                fontWeight = FontWeight.SemiBold,
                                            )
                                        }
                                    }
                                }
                            }
                            day.paragraphs.forEachIndexed { idx, para ->
                                Text(
                                    para,
                                    Modifier.fillMaxWidth().padding(top = if (idx == 0) 12.dp else 14.dp),
                                    style = TextStyle(
                                        color = inkSoft,
                                        fontSize = (16.5f * scale).sp,
                                        lineHeight = (29 * scale).sp,
                                        lineBreak = LineBreak.Paragraph,
                                    ),
                                )
                            }
                        } else if (day.brief.isNotEmpty()) {
                            Text(
                                day.brief,
                                Modifier.padding(top = 10.dp),
                                color = inkSoft,
                                fontSize = 14.5.sp,
                                lineHeight = 22.sp,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }

                        Row(
                            Modifier
                                .fillMaxWidth()
                                .padding(top = 10.dp)
                                .clickableNoRipple { articleExpanded = !articleExpanded }
                                .padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                zh(if (articleExpanded) "收起全文" else "展开阅读全文"),
                                color = accent,
                                fontSize = 13.5.sp,
                                fontWeight = FontWeight.SemiBold,
                            )
                            MaterialIcon(if (articleExpanded) MI.EXPAND_LESS else MI.EXPAND_MORE, 18f, accent)
                        }
                    }
                }
            }

            item(key = "search-and-months") {
                // 搜索栏
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(top = 18.dp)
                        .height(44.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(theme.surface.toColor())
                        .border(1.dp, theme.border.toColor(), RoundedCornerShape(12.dp))
                        .padding(horizontal = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    MaterialIcon(MI.SEARCH, 19f, muted)
                    Box(Modifier.weight(1f).padding(start = 8.dp), contentAlignment = Alignment.CenterStart) {
                        if (query.isEmpty()) {
                            Text(
                                zh("搜索标题、内容简要或经文（如：恩典、诗篇）…"),
                                color = faint,
                                fontSize = 14.5.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                        BasicTextField(
                            value = query,
                            onValueChange = { next ->
                                query = next
                                if (next.trim().isNotEmpty() && selectedMonth != 0) {
                                    selectedMonth = 0
                                }
                            },
                            singleLine = true,
                            textStyle = TextStyle(color = ink, fontSize = 15.sp),
                            cursorBrush = SolidColor(accent),
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                    if (query.isNotEmpty()) {
                        Box(
                            Modifier
                                .size(30.dp)
                                .clickableNoRipple {
                                    query = ""
                                    selectedMonth = date.monthValue.coerceIn(1, 12)
                                },
                            contentAlignment = Alignment.Center,
                        ) {
                            MaterialIcon(MI.CLOSE, 18f, faint)
                        }
                    }
                }

                // 12 个月分类胶囊条
                LazyRow(
                    state = monthRowState,
                    modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(7.dp),
                ) {
                    item(key = "m-0") {
                        DevotionalMonthPill(
                            label = zh("全部"),
                            active = selectedMonth == 0,
                            accent = accent,
                            ink = ink,
                            surface = theme.surface.toColor(),
                            border = theme.border.toColor(),
                            onClick = { selectedMonth = 0 },
                        )
                    }
                    items(12) { idx ->
                        val m = idx + 1
                        DevotionalMonthPill(
                            label = zh("${m}月"),
                            active = selectedMonth == m,
                            accent = accent,
                            ink = ink,
                            surface = theme.surface.toColor(),
                            border = theme.border.toColor(),
                            onClick = { selectedMonth = m },
                        )
                    }
                }

                if (trimmedQuery.isNotEmpty()) {
                    Text(
                        zh("共找到 $totalHitCount 篇灵修"),
                        Modifier.padding(top = 10.dp),
                        color = muted,
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }

            if (filteredGroups.isEmpty()) {
                item(key = "empty-results") {
                    Column(
                        Modifier.fillMaxWidth().padding(vertical = 36.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Text(zh("没有找到匹配的灵修篇目"), color = ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                        Text(zh("试试搜索「恩典」「平安」「信心」或切换上方月份"), color = muted, fontSize = 13.sp)
                    }
                }
            } else {
                filteredGroups.forEach { (month, itemsInMonth) ->
                    item(key = "header-$month") {
                        Row(
                            Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(zh("${month}月"), color = ink, fontSize = 16.5.sp, fontWeight = FontWeight.Bold)
                            Text(" · ${zh("${itemsInMonth.size} 篇")}", color = muted, fontSize = 12.5.sp, fontWeight = FontWeight.Medium)
                        }
                    }

                    items(itemsInMonth, key = { it.md }) { item ->
                        val isSelected = day?.md == item.md
                        val isPlayingThis = player.currentKey == item.md && player.isPlaying
                        val isLoadingThis = player.currentKey == item.md && player.isLoading
                        val snippet = item.briefMatching(trimmedQuery)

                        Row(
                            Modifier
                                .fillMaxWidth()
                                .padding(bottom = 8.dp)
                                .clip(RoundedCornerShape(15.dp))
                                .background(if (isSelected) theme.surface.toColor() else theme.surface.toColor().copy(alpha = 0.62f))
                                .border(
                                    if (isSelected) 1.1.dp else 0.75.dp,
                                    if (isSelected) accent.copy(alpha = 0.55f) else theme.border.toColor(),
                                    RoundedCornerShape(15.dp),
                                )
                                .clickableNoRipple {
                                    onDate(SolidJoys.dateForKey(item.md))
                                    articleExpanded = true
                                    scope.launch { listState.animateScrollToItem(0) }
                                }
                                .padding(horizontal = 14.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        zh(item.dateLabel),
                                        color = if (isSelected) accent else muted,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                    )
                                    if (item.ref.isNotEmpty()) {
                                        Text(
                                            " · ${item.ref}",
                                            color = muted,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Medium,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                        )
                                    }
                                    minutesLabel(item.audioSec)?.let { mins ->
                                        Text(" · $mins", color = faint, fontSize = 11.5.sp, maxLines = 1)
                                    }
                                }

                                Text(
                                    item.title,
                                    color = ink,
                                    fontSize = 16.5.sp,
                                    fontWeight = FontWeight.Bold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )

                                if (snippet.isNotEmpty()) {
                                    Text(
                                        snippet,
                                        color = muted,
                                        fontSize = 13.5.sp,
                                        lineHeight = 20.sp,
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                }
                            }

                            if (item.audio != null) {
                                Box(
                                    Modifier
                                        .size(42.dp)
                                        .clip(CircleShape)
                                        .background(if (isPlayingThis) accent else accent.copy(alpha = 0.14f))
                                        .clickableNoRipple {
                                            onDate(SolidJoys.dateForKey(item.md))
                                            if (isPlayingThis) {
                                                player.pause()
                                            } else {
                                                player.play(item.md, item.audio, "${item.dateLabel} ${item.title}")
                                            }
                                        },
                                    contentAlignment = Alignment.Center,
                                ) {
                                    if (isLoadingThis) {
                                        CircularProgressIndicator(
                                            Modifier.size(18.dp),
                                            color = if (isPlayingThis) Color(0xFFFFFBF4) else accent,
                                            strokeWidth = 2.dp,
                                        )
                                    } else {
                                        MaterialIcon(
                                            if (isPlayingThis) MI.GRAPHIC_EQ else MI.PLAY_ARROW,
                                            20f,
                                            if (isPlayingThis) Color(0xFFFFFBF4) else accent,
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            item(key = "credit-footer") {
                Box(Modifier.fillMaxWidth().padding(top = 20.dp).height(1.dp).background(theme.border.toColor()))
                Column(Modifier.fillMaxWidth().padding(top = 14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(zh("原作：") + SolidJoys.CREDIT_AUTHOR, color = muted, fontSize = 14.sp, lineHeight = 22.sp)
                    Text(zh("译文与音频：${SolidJoys.CREDIT_TRANSLATION}"), color = muted, fontSize = 14.sp, lineHeight = 22.sp)
                    Text(
                        "befaithful.net",
                        Modifier.clickableNoRipple {
                            runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(SolidJoys.CREDIT_LINK))) }
                        },
                        color = accent,
                        fontSize = 14.sp,
                        lineHeight = 22.sp,
                        fontWeight = FontWeight.Medium,
                        textDecoration = TextDecoration.Underline,
                    )
                }
            }
        }
    }
}

@Composable
private fun DevotionalMonthPill(
    label: String,
    active: Boolean,
    accent: Color,
    ink: Color,
    surface: Color,
    border: Color,
    onClick: () -> Unit,
) {
    Box(
        Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(if (active) accent else surface)
            .border(1.dp, if (active) Color.Transparent else border, RoundedCornerShape(999.dp))
            .clickableNoRipple(onClick)
            .padding(horizontal = 13.dp, vertical = 7.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            color = if (active) Color(0xFFFFFBF4) else ink,
            fontSize = 13.5.sp,
            fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
        )
    }
}

/** 朗读条：整条都能点（播放 / 暂停），进度条可拖 */
@Composable
private fun DevotionalAudioBar(day: DevotionalDay, player: DevotionalPlayer, theme: Parchment) {
    val mine = player.currentKey == day.md
    val playing = mine && player.isPlaying
    val dur = if (mine && player.durationMs > 0) player.durationMs else (day.audioSec ?: 0) * 1000L
    val pos = if (mine) player.positionMs else 0L
    val shape = RoundedCornerShape(14.dp)
    val toggle = { if (playing) player.pause() else player.play(day.md, day.audio!!, "${day.dateLabel} ${day.title}") }
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 66.dp)
            .clip(shape)
            .background(theme.canvas.toColor().copy(alpha = 0.65f))
            .border(0.75.dp, theme.border.toColor(), shape)
            .clickableNoRipple(toggle)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(44.dp).clip(CircleShape).background(Color(0xFF241F1B)), contentAlignment = Alignment.Center) {
            if (mine && player.isLoading) CircularProgressIndicator(Modifier.size(19.dp), color = ON_DARK, strokeWidth = 2.dp)
            else MaterialIcon(if (playing) MI.PAUSE else MI.PLAY_ARROW, 24f, ON_DARK)
        }
        Column(Modifier.weight(1f).padding(start = 12.dp)) {
            Text(
                zh(if (mine && player.failed) "音频暂时无法播放，文字照常可读" else "灵修朗读"),
                color = theme.ink.toColor(),
                fontSize = 13.5.sp,
                fontWeight = FontWeight.SemiBold,
            )
            DevotionalProgress(pos, dur, theme, enabled = mine && player.durationMs > 0, onSeek = player::seekTo)
        }
    }
}

/** 4dp 进度条 + 两端时间；轨道外套一层 32dp 高的触控框，点 / 拖都能定位 */
@Composable
private fun DevotionalProgress(pos: Long, dur: Long, theme: Parchment, enabled: Boolean, onSeek: (Long) -> Unit) {
    var drag by remember { mutableStateOf<Float?>(null) }
    var widthPx by remember { mutableStateOf(1f) }
    val fraction = drag ?: if (dur > 0) (pos.toFloat() / dur).coerceIn(0f, 1f) else 0f
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(clock(drag?.let { (it * dur).toLong() } ?: pos), Modifier.width(40.dp), color = theme.muted.toColor(), fontSize = 12.5.sp)
        Box(
            Modifier
                .weight(1f)
                .height(30.dp)
                .onSizeChanged { widthPx = it.width.toFloat().coerceAtLeast(1f) }
                .then(
                    if (!enabled) {
                        Modifier
                    } else {
                        Modifier
                            .pointerInput(dur) {
                                detectHorizontalDragGestures(
                                    onDragStart = { drag = (it.x / widthPx).coerceIn(0f, 1f) },
                                    onDragEnd = { drag?.let { onSeek((it * dur).toLong()) }; drag = null },
                                    onDragCancel = { drag = null },
                                ) { change, _ -> drag = (change.position.x / widthPx).coerceIn(0f, 1f) }
                            }
                            .pointerInput(dur) { detectTapGestures { onSeek(((it.x / widthPx).coerceIn(0f, 1f) * dur).toLong()) } }
                    },
                ),
            contentAlignment = Alignment.CenterStart,
        ) {
            Box(Modifier.fillMaxWidth().height(4.dp).clip(CircleShape).background(Color(0x385C4030))) {
                Box(Modifier.fillMaxWidth(fraction).height(4.dp).clip(CircleShape).background(Brand.logo.toColor()))
            }
        }
        Text(if (dur > 0) clock(dur) else "--:--", Modifier.width(40.dp), color = theme.muted.toColor(), fontSize = 12.5.sp, textAlign = TextAlign.End)
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
        Column(
            Modifier
                .fillMaxWidth()
                .defaultMinSize(minHeight = ShellMetrics.dockContentHeight.dp)
                .padding(start = ShellMetrics.dockPaddingH.dp + 4.dp, end = ShellMetrics.dockPaddingH.dp, top = 10.dp, bottom = 6.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f).clickableNoRipple(onOpen)) {
                    Text(zh(SolidJoys.TITLE), color = theme.muted.toColor(), fontSize = 13.sp)
                    Text(
                        day?.let { "${zh(it.dateLabel)} · ${it.title}" } ?: "",
                        color = theme.ink.toColor(),
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Box(Modifier.size(40.dp).clickableNoRipple { player.stop() }, contentAlignment = Alignment.Center) {
                    MaterialIcon(MI.CLOSE, 20f, theme.muted.toColor())
                }
            }
            Row(Modifier.padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f)) {
                    DevotionalProgress(player.positionMs, player.durationMs, theme, enabled = player.durationMs > 0, onSeek = player::seekTo)
                }
                Box(
                    Modifier
                        .padding(start = 10.dp)
                        .size(52.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF241F1B))
                        .clickableNoRipple {
                            if (player.isPlaying) player.pause() else day?.audio?.let { player.play(day.md, it, "${day.dateLabel} ${day.title}") }
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    if (player.isLoading) CircularProgressIndicator(Modifier.size(22.dp), color = ON_DARK, strokeWidth = 2.dp)
                    else MaterialIcon(if (player.isPlaying) MI.PAUSE else MI.PLAY_ARROW, 28f, ON_DARK)
                }
            }
        }
    }
}

private fun clock(ms: Long): String {
    val s = maxOf(0L, ms / 1000)
    return "%d:%02d".format(s / 60, s % 60)
}
