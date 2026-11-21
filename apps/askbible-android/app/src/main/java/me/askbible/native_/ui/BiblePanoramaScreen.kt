package me.askbible.native_.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.BibleBookIntroductions
import me.askbible.native_.data.BibleCatalog
import me.askbible.native_.data.BiblePanorama
import me.askbible.native_.data.BookRef
import me.askbible.native_.data.PanoramaReadingGuide
import me.askbible.native_.data.PanoramaSection
import me.askbible.native_.data.PanoramaSpan
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.ReadChrome
import me.askbible.native_.data.ShellMetrics
import me.askbible.native_.data.name

private val ACT_NUMERALS_ZH = listOf("壹", "贰", "叁", "肆", "伍", "陆")

/**
 * 救赎全景（灵修画卷，对齐 iOS BiblePanoramaView）：
 * - 置顶「✦ 你正在这一幕」沉浸定位卡（含单线手绘插画 + 一键续读按钮）
 * - 纵向金线六幕时间轴（壹～陆），告别四层 +/- 树状目录
 * - 书签式经文脉络导读卡 + 轻巧章节选择半屏弹层
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BiblePanoramaScreen(
    locale: AppLocale,
    currentBook: String?,
    currentChapter: Int,
    locateRequest: Int,
    onReturnReading: () -> Unit,
    onRead: (String, Int) -> Unit,
    musicPlaying: Boolean,
    onToggleMusic: () -> Unit,
    theme: Parchment = Parchment.light,
) {
    val ink = theme.ink.toColor()
    val muted = theme.muted.toColor()
    val faint = theme.faint.toColor()
    val accent = theme.accentOt.toColor()
    fun t(zh: String, en: String) = AppLocale.pick(zh, en, locale)

    val resolvedBookId = currentBook ?: "GEN"
    val resolvedChapter = maxOf(1, currentChapter)
    val resolvedBook = BibleCatalog.book(resolvedBookId) ?: BibleCatalog.all.first()
    val heroLoc = BiblePanorama.location(resolvedBookId, resolvedChapter)
    val heroActIdx = heroLoc?.first ?: 0
    val heroSection = heroLoc?.second ?: BiblePanorama.acts.first().sections.first()

    var activeAct by rememberSaveable { mutableIntStateOf(heroActIdx) }
    var handledRequest by rememberSaveable { mutableIntStateOf(-1) }
    var pickingSpan by remember { mutableStateOf<Pair<BookRef, PanoramaSpan>?>(null) }
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()

    LaunchedEffect(locateRequest) {
        if (locateRequest > 0 && handledRequest != locateRequest) {
            handledRequest = locateRequest
            activeAct = heroActIdx
            scope.launch { listState.animateScrollToItem(heroActIdx + 1) }
        }
    }
    LaunchedEffect(resolvedBookId, resolvedChapter) {
        activeAct = heroActIdx
    }

    Box(Modifier.fillMaxSize()) {
        ParchmentBackground(theme = theme)
        LazyColumn(
            state = listState,
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .parchmentFade(ParchmentFadePreset.TABBAR),
            contentPadding = PaddingValues(
                start = 22.dp,
                end = 22.dp,
                top = 18.dp,
                bottom = TAB_BAR_CLEARANCE.dp + shellTabBarBottomInset() + 100.dp,
            ),
        ) {
            item(key = "header-hero") {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            t("救赎全景", "Redemption Story"),
                            color = ink,
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            t("在完整的救赎故事中安静灵修，看见今天所读经文的位置", "Dwell in the whole story of redemption and see where today's reading belongs"),
                            color = muted,
                            fontSize = 13.5.sp,
                            lineHeight = 20.sp,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                }
                Spacer(Modifier.height(18.dp))

                // 置顶「你正在这一幕」沉浸定位卡
                val actObj = BiblePanorama.acts[heroActIdx]
                Column(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(20.dp))
                        .background(theme.surface.toColor())
                        .border(1.dp, theme.borderStrong.toColor(), RoundedCornerShape(20.dp))
                        .padding(18.dp),
                ) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
                        Column(Modifier.weight(1f).padding(end = 12.dp)) {
                            Box(
                                Modifier
                                    .clip(CircleShape)
                                    .background(accent)
                                    .padding(horizontal = 10.dp, vertical = 4.dp),
                            ) {
                                Text(
                                    t("✦ 你正在这一幕 · 第${heroActIdx + 1}幕", "✦ You are here · Act ${heroActIdx + 1}"),
                                    color = Color(0xFFFFFBF4),
                                    fontSize = 11.5.sp,
                                    fontWeight = FontWeight.SemiBold,
                                )
                            }
                            Spacer(Modifier.height(10.dp))
                            Text(
                                "${t(actObj.zh, actObj.en)} · ${t(heroSection.zh, heroSection.en)}",
                                color = ink,
                                fontSize = 20.sp,
                                lineHeight = 27.sp,
                                fontWeight = FontWeight.Bold,
                            )
                            Text(
                                t(heroSection.summaryZh, heroSection.summaryEn),
                                color = muted,
                                fontSize = 13.5.sp,
                                lineHeight = 21.sp,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.padding(top = 4.dp),
                            )
                        }
                        PanoramaSketch(heroActIdx, Modifier.width(64.dp).height(68.dp), accent)
                    }
                    Spacer(Modifier.height(14.dp))
                    val ctaLabel = if (currentBook != null) {
                        t("继续灵修 · ${ReadChrome.chapterTitle(resolvedBook.name(locale), resolvedChapter, locale)}",
                          "Continue · ${ReadChrome.chapterTitle(resolvedBook.name(locale), resolvedChapter, locale)}")
                    } else {
                        t("从起初进入灵修 · 创世记 第 1 章", "Begin from Genesis 1")
                    }
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .height(44.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(accent)
                            .clickableNoRipple {
                                if (currentBook != null) onReturnReading() else onRead("GEN", 1)
                            }
                            .padding(horizontal = 16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(ctaLabel, Modifier.weight(1f), color = Color(0xFFFFFBF4), fontSize = 14.5.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        MaterialIcon(MI.CHEVRON_RIGHT, 18f, Color(0xFFFFFBF4))
                    }
                }
                Spacer(Modifier.height(22.dp))
            }

            BiblePanorama.acts.forEachIndexed { index, act ->
                val expanded = activeAct == index
                item(key = "act-$index") {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .drawBehind {
                                if (index < BiblePanorama.acts.lastIndex) {
                                    drawLine(
                                        color = accent.copy(alpha = 0.36f),
                                        start = Offset(6.dp.toPx(), 24.dp.toPx()),
                                        end = Offset(6.dp.toPx(), size.height),
                                        strokeWidth = 1.2.dp.toPx(),
                                    )
                                }
                            },
                        verticalAlignment = Alignment.Top,
                    ) {
                        // 左侧纵向金线节点
                        Box(Modifier.padding(top = 18.dp).size(12.dp), contentAlignment = Alignment.Center) {
                            if (expanded) {
                                Box(Modifier.size(11.dp).clip(CircleShape).background(accent))
                            } else {
                                Box(Modifier.size(10.dp).clip(CircleShape).border(1.6.dp, accent, CircleShape).background(theme.canvas.toColor()))
                            }
                        }
                        Spacer(Modifier.width(12.dp))

                        // 幕卡片
                        Column(
                            Modifier
                                .weight(1f)
                                .padding(bottom = 12.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(if (expanded) theme.surface.toColor() else theme.surface.toColor().copy(alpha = 0.62f))
                                .border(
                                    if (expanded) 1.dp else 0.75.dp,
                                    if (expanded) accent.copy(alpha = 0.45f) else theme.border.toColor(),
                                    RoundedCornerShape(16.dp),
                                ),
                        ) {
                            Row(
                                Modifier
                                    .fillMaxWidth()
                                    .clickableNoRipple { activeAct = if (expanded) -1 else index }
                                    .padding(horizontal = 14.dp, vertical = 14.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                val badgeText = if (locale == AppLocale.EN) "${index + 1}" else ACT_NUMERALS_ZH.getOrElse(index) { "${index + 1}" }
                                Box(
                                    Modifier
                                        .size(28.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(if (expanded) accent else accent.copy(alpha = 0.14f)),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Text(
                                        badgeText,
                                        color = if (expanded) Color(0xFFFFFBF4) else accent,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                    )
                                }
                                Spacer(Modifier.width(10.dp))
                                Text(
                                    t(act.zh, act.en),
                                    color = ink,
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold,
                                )
                                Text(
                                    " · ${t(act.subtitleZh, act.subtitleEn)}",
                                    color = muted,
                                    fontSize = 13.5.sp,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    modifier = Modifier.weight(1f),
                                )
                                MaterialIcon(if (expanded) MI.EXPAND_LESS else MI.EXPAND_MORE, 20f, muted)
                            }

                            if (expanded) {
                                Column(
                                    Modifier.padding(start = 14.dp, end = 14.dp, bottom = 16.dp),
                                    verticalArrangement = Arrangement.spacedBy(14.dp),
                                ) {
                                    act.sections.forEach { sec ->
                                        PanoramaSectionBlock(
                                            section = sec,
                                            locale = locale,
                                            theme = theme,
                                            currentBook = currentBook,
                                            currentChapter = currentChapter,
                                            onRead = onRead,
                                            onPickSpan = { b, sp -> pickingSpan = b to sp },
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            item(key = "footer") {
                Text(
                    t(
                        "六幕为灵修导览脉络，帮助你在救赎历史中安放每一章经文；诗歌、智慧与先知书按历史处境与主题相联。",
                        "The six acts serve as a devotional story guide, helping place each chapter within redemptive history.",
                    ),
                    color = faint,
                    fontSize = 12.sp,
                    lineHeight = 19.sp,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
    }

    pickingSpan?.let { (book, span) ->
        ModalBottomSheet(
            onDismissRequest = { pickingSpan = null },
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
            containerColor = theme.surfaceSolid.toColor(),
            contentColor = ink,
        ) {
            val intro = BibleBookIntroductions.get(book.id)
            Column(
                Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp, vertical = 8.dp)
                    .padding(bottom = 24.dp),
            ) {
                Text(book.name(locale), color = ink, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Text(intro.text(locale), color = muted, fontSize = 13.5.sp, lineHeight = 21.sp, modifier = Modifier.padding(top = 6.dp, bottom = 14.dp))
                Text(
                    if (span.first == 1 && span.last == book.chapterCount) t("选择章节（共 ${book.chapterCount} 章）", "Select chapter (${book.chapterCount})")
                    else t("本幕书卷路段：第 ${span.first}–${span.last} 章", "Chapters ${span.first}–${span.last}"),
                    color = accent,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(bottom = 10.dp),
                )
                BoxWithConstraints {
                    val cols = (maxWidth.value / 56f).toInt().coerceIn(4, 6)
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        (span.first..span.last).toList().chunked(cols).forEach { rowChs ->
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                rowChs.forEach { ch ->
                                    val isCur = currentBook == book.id && currentChapter == ch
                                    Box(
                                        Modifier
                                            .weight(1f)
                                            .height(42.dp)
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(if (isCur) accent else theme.canvas.toColor().copy(alpha = 0.65f))
                                            .border(0.75.dp, if (isCur) accent else theme.border.toColor(), RoundedCornerShape(10.dp))
                                            .clickableNoRipple {
                                                pickingSpan = null
                                                onRead(book.id, ch)
                                            },
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        Text(
                                            "$ch",
                                            color = if (isCur) Color(0xFFFFFBF4) else ink,
                                            fontSize = 15.sp,
                                            fontWeight = if (isCur) FontWeight.Bold else FontWeight.Medium,
                                        )
                                    }
                                }
                                repeat(cols - rowChs.size) { Spacer(Modifier.weight(1f)) }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PanoramaSectionBlock(
    section: PanoramaSection,
    locale: AppLocale,
    theme: Parchment,
    currentBook: String?,
    currentChapter: Int,
    onRead: (String, Int) -> Unit,
    onPickSpan: (BookRef, PanoramaSpan) -> Unit,
) {
    val ink = theme.ink.toColor()
    val muted = theme.muted.toColor()
    val accent = theme.accentOt.toColor()
    fun t(zh: String, en: String) = AppLocale.pick(zh, en, locale)

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(Modifier.fillMaxWidth().height(0.5.dp).background(theme.border.toColor()))
        Text(t(section.zh, section.en), color = ink, fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp))
        Text(t(section.summaryZh, section.summaryEn), color = muted, fontSize = 13.5.sp, lineHeight = 21.sp)

        PanoramaReadingGuide.notes[section.id]?.let { note ->
            Text(t(note.zh, note.en), color = ink.copy(alpha = 0.86f), fontSize = 13.sp, lineHeight = 20.sp)
            note.links.forEach { link ->
                val b = BibleCatalog.book(link.bookId) ?: return@forEach
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(accent.copy(alpha = 0.08f))
                        .border(0.75.dp, accent.copy(alpha = 0.25f), RoundedCornerShape(10.dp))
                        .clickableNoRipple { onRead(link.bookId, link.chapter) }
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(Modifier.width(2.5.dp).height(34.dp).clip(CircleShape).background(accent))
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            "${t(link.kindZh, link.kindEn)} · ${b.name(locale)} ${link.chapter}${if (link.verses.isEmpty()) "" else ":${link.verses}"}",
                            color = ink,
                            fontSize = 13.5.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(t(link.reasonZh, link.reasonEn), color = muted, fontSize = 12.5.sp, lineHeight = 18.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    }
                    MaterialIcon(MI.CHEVRON_RIGHT, 16f, accent)
                }
            }
        }

        // 本幕所含书卷胶囊行（一点即开或选章）
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            section.spans.forEach { span ->
                val book = BibleCatalog.book(span.bookId) ?: return@forEach
                val isCurrent = currentBook == book.id && currentChapter in span.first..span.last
                val rangeLabel = if (span.first == 1 && span.last == book.chapterCount) {
                    t("${book.chapterCount} 章", "${book.chapterCount} ch")
                } else {
                    t("${span.first}–${span.last} 章", "Ch ${span.first}–${span.last}")
                }
                Row(
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 44.dp)
                        .clip(RoundedCornerShape(11.dp))
                        .background(if (isCurrent) accent.copy(alpha = 0.12f) else theme.canvas.toColor().copy(alpha = 0.45f))
                        .border(0.75.dp, if (isCurrent) accent else theme.border.toColor(), RoundedCornerShape(11.dp))
                        .clickableNoRipple {
                            if (span.first == span.last) onRead(book.id, span.first)
                            else onPickSpan(book, span)
                        }
                        .padding(horizontal = 12.dp, vertical = 9.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    MaterialIcon(MI.MENU_BOOK, 16f, if (isCurrent) accent else muted)
                    Spacer(Modifier.width(8.dp))
                    Text(book.name(locale), color = ink, fontSize = 14.5.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                    Text(rangeLabel, color = muted, fontSize = 12.sp)
                    Spacer(Modifier.width(4.dp))
                    MaterialIcon(MI.CHEVRON_RIGHT, 15f, muted)
                }
            }
        }
    }
}
