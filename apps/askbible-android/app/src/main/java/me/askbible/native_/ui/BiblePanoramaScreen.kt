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
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
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
import me.askbible.native_.data.ShellMetrics
import me.askbible.native_.data.name

private val ACT_NUMERALS_ZH = listOf("壹", "贰", "叁", "肆", "伍", "陆")

/**
 * 救赎全景（灵修画卷 + 66 卷每卷书简介与选章）：
 * - 顶部保留「✦ 你正在这一幕」英雄定位卡与右上「书卷速查」入口；
 * - 六幕历史时间轴（壹..陆）完整呈现每一阶段的救赎脉络，并直接放出 **每一卷书在写什么**（`BibleBookIntroductions`）；
 * - 点按任一书卷卡片即可展开阅读线索与章节号网格直达经文。
 */
@Composable
fun BiblePanoramaScreen(
    locale: AppLocale,
    currentBook: String?,
    currentChapter: Int,
    locateRequest: Int,
    onReturnReading: () -> Unit,
    onRead: (String, Int) -> Unit,
    musicPlaying: Boolean = false,
    onToggleMusic: () -> Unit = {},
    theme: Parchment = LocalParchment.current,
) {
    val ink = theme.ink.toColor()
    val muted = theme.muted.toColor()
    val accent = theme.accentOt.toColor()
    val isDark = theme == Parchment.dark
    val gold = if (isDark) Color(0xFFE2A84B) else Color(0xFFB56A18)
    fun t(zh: String, en: String) = AppLocale.pick(zh, en, locale)

    val current = currentBook?.let { BiblePanorama.location(it, currentChapter) }
    val initialMask = (1 shl (current?.first ?: 0))
    var expandedActs by rememberSaveable { mutableIntStateOf(initialMask) }
    var expandedSections by rememberSaveable {
        mutableStateOf(listOfNotNull(current?.second?.id ?: "creation"))
    }
    var expandedBooks by rememberSaveable { mutableStateOf(listOf<String>()) }
    var quickCatalogBook by rememberSaveable { mutableStateOf<String?>(null) }
    var showQuickCatalog by rememberSaveable { mutableStateOf(false) }
    var handledRequest by rememberSaveable { mutableIntStateOf(-1) }

    val list = rememberLazyListState()
    val scope = rememberCoroutineScope()

    fun locate() {
        val target = current ?: (0 to BiblePanorama.acts[0].sections[0])
        expandedActs = expandedActs or (1 shl target.first)
        expandedSections = (expandedSections + target.second.id).distinct()
        scope.launch { list.animateScrollToItem(target.first + 1) }
    }

    LaunchedEffect(locateRequest) {
        if (locateRequest > 0 && handledRequest != locateRequest) {
            handledRequest = locateRequest
            locate()
        }
    }

    val insets = WindowInsets.systemBars.asPaddingValues()

    Box(Modifier.fillMaxSize()) {
        ParchmentBackground(theme = theme)

        LazyColumn(
            state = list,
            modifier = Modifier.fillMaxSize().parchmentFade(ParchmentFadePreset.TABBAR),
            contentPadding = PaddingValues(
                start = 20.dp,
                end = 20.dp,
                top = 16.dp + insets.calculateTopPadding(),
                bottom = ShellMetrics.tabRowHeight.dp + shellTabBarBottomInset() + 36.dp,
            ),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // 顶栏标题 + 66 卷速查按钮 + 当前定位英雄卡
            item(key = "panorama-header") {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(
                                t("救赎全景", "Redemption Story"),
                                color = ink,
                                fontSize = 28.sp,
                                fontWeight = FontWeight.Bold,
                            )
                            Text(
                                t("从创造走向新创造 · 读懂每一卷书在写什么", "From Creation to New Creation · Every book in context"),
                                color = muted,
                                fontSize = 13.sp,
                            )
                        }
                        Row(
                            Modifier
                                .clip(CircleShape)
                                .background(theme.surface.toColor().copy(alpha = 0.88f))
                                .border(1.dp, theme.border.toColor(), CircleShape)
                                .clickableNoRipple { showQuickCatalog = true }
                                .padding(horizontal = 12.dp, vertical = 7.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            MaterialIcon(MI.MENU_BOOK, 15f, gold)
                            Text(t("书卷速查", "Books"), color = ink, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }

                    // 英雄定位卡
                    val heroActIdx = current?.first ?: 0
                    val heroAct = BiblePanorama.acts[heroActIdx]
                    val heroSection = current?.second ?: heroAct.sections.first()
                    val curBookRef = currentBook?.let { BibleCatalog.book(it) }
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(18.dp))
                            .background(gold.copy(alpha = if (isDark) 0.14f else 0.10f))
                            .border(1.dp, gold.copy(alpha = 0.42f), RoundedCornerShape(18.dp))
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            PanoramaSketch(heroActIdx, Modifier.width(52.dp).height(56.dp), gold)
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                                Text(
                                    if (curBookRef != null) t("✦ 你正在这一幕", "✦ YOU ARE IN THIS ACT")
                                    else t("✦ 救赎历史起点", "✦ WHERE THE STORY BEGINS"),
                                    color = gold,
                                    fontSize = 11.5.sp,
                                    fontWeight = FontWeight.Bold,
                                )
                                Text(
                                    "${t(heroAct.zh, heroAct.en)} · ${t(heroSection.zh, heroSection.en)}",
                                    color = ink,
                                    fontSize = 17.sp,
                                    fontWeight = FontWeight.Bold,
                                )
                                Text(
                                    t(heroSection.summaryZh, heroSection.summaryEn),
                                    color = muted,
                                    fontSize = 12.5.sp,
                                    lineHeight = 19.sp,
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                        }

                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                            Row(
                                Modifier
                                    .clip(CircleShape)
                                    .background(gold)
                                    .clickableNoRipple {
                                        if (curBookRef != null) onReturnReading() else onRead("GEN", 1)
                                    }
                                    .padding(horizontal = 14.dp, vertical = 7.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(
                                    if (curBookRef != null)
                                        t("继续读 · ${curBookRef.name(locale)} $currentChapter ›", "Resume · ${curBookRef.name(locale)} $currentChapter ›")
                                    else t("从创世记第 1 章开始 ›", "Begin at Genesis 1 ›"),
                                    color = if (isDark) Color(0xFF1A1511) else Color(0xFFFFFDF9),
                                    fontSize = 12.5.sp,
                                    fontWeight = FontWeight.Bold,
                                )
                            }

                            if (curBookRef != null) {
                                Text(
                                    t("在下方定位", "Locate below"),
                                    Modifier.clickableNoRipple { locate() }.padding(horizontal = 8.dp, vertical = 6.dp),
                                    color = gold,
                                    fontSize = 12.5.sp,
                                    fontWeight = FontWeight.SemiBold,
                                )
                            }
                        }
                    }
                }
            }

            // 六幕救赎历史与 66 卷书每卷简介
            BiblePanorama.acts.forEachIndexed { index, act ->
                val actOpen = (expandedActs and (1 shl index)) != 0
                val isCurrentAct = current?.first == index
                item(key = "act-$index") {
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(18.dp))
                            .background(theme.surface.toColor().copy(alpha = if (isDark) 0.72f else 0.86f))
                            .border(
                                if (isCurrentAct) 1.3.dp else 0.8.dp,
                                if (isCurrentAct) gold.copy(alpha = 0.75f) else theme.border.toColor(),
                                RoundedCornerShape(18.dp),
                            )
                            .padding(16.dp),
                    ) {
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .clickableNoRipple { expandedActs = expandedActs xor (1 shl index) },
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Box(
                                Modifier
                                    .size(34.dp)
                                    .clip(CircleShape)
                                    .background(if (actOpen || isCurrentAct) gold else gold.copy(alpha = 0.16f)),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    if (locale == AppLocale.EN) "${index + 1}" else ACT_NUMERALS_ZH.getOrElse(index) { "${index + 1}" },
                                    color = if (actOpen || isCurrentAct) (if (isDark) Color(0xFF1A1511) else Color(0xFFFFFDF9)) else gold,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                )
                            }

                            PanoramaSketch(index, Modifier.width(46.dp).height(50.dp), gold)

                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Text(t(act.zh, act.en), color = ink, fontSize = 19.sp, fontWeight = FontWeight.Bold)
                                    if (isCurrentAct) {
                                        Text(
                                            t("当前所在", "Here"),
                                            color = gold,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                        )
                                    }
                                }
                                Text(t(act.subtitleZh, act.subtitleEn), color = muted, fontSize = 13.sp)
                            }

                            MaterialIcon(if (actOpen) MI.EXPAND_LESS else MI.EXPAND_MORE, 22f, muted)
                        }

                        if (actOpen) {
                            Spacer(Modifier.height(14.dp))
                            Column(
                                Modifier
                                    .fillMaxWidth()
                                    .drawBehind {
                                        drawLine(
                                            gold.copy(alpha = 0.35f),
                                            Offset(8.dp.toPx(), 4.dp.toPx()),
                                            Offset(8.dp.toPx(), size.height - 4.dp.toPx()),
                                            1.5.dp.toPx(),
                                        )
                                    }
                                    .padding(start = 20.dp),
                                verticalArrangement = Arrangement.spacedBy(16.dp),
                            ) {
                                act.sections.forEach { section ->
                                    val alwaysOpen = act.sections.size <= 2
                                    val secOpen = alwaysOpen || section.id in expandedSections
                                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Row(
                                            Modifier
                                                .fillMaxWidth()
                                                .clickableNoRipple {
                                                    if (!alwaysOpen) {
                                                        expandedSections =
                                                            if (secOpen) expandedSections - section.id
                                                            else expandedSections + section.id
                                                    }
                                                },
                                            verticalAlignment = Alignment.CenterVertically,
                                        ) {
                                            Text(
                                                t(section.zh, section.en),
                                                color = if (current?.second?.id == section.id) gold else ink,
                                                fontSize = 16.sp,
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier.weight(1f),
                                            )
                                            if (!alwaysOpen) {
                                                Text(
                                                    "${section.spans.size} " + t("卷", "books") + (if (secOpen) " ▴" else " ▾"),
                                                    color = muted,
                                                    fontSize = 12.sp,
                                                )
                                            }
                                        }

                                        Text(
                                            t(section.summaryZh, section.summaryEn),
                                            color = muted,
                                            fontSize = 13.sp,
                                            lineHeight = 20.sp,
                                        )

                                        if (secOpen) {
                                            PanoramaReadingGuide.notes[section.id]?.let { note ->
                                                Column(
                                                    Modifier
                                                        .fillMaxWidth()
                                                        .clip(RoundedCornerShape(10.dp))
                                                        .background(gold.copy(alpha = if (isDark) 0.10f else 0.08f))
                                                        .padding(10.dp),
                                                    verticalArrangement = Arrangement.spacedBy(6.dp),
                                                ) {
                                                    Text(
                                                        t(note.zh, note.en),
                                                        color = ink.copy(alpha = 0.88f),
                                                        fontSize = 12.5.sp,
                                                        lineHeight = 19.sp,
                                                    )
                                                    note.links.forEach { link ->
                                                        val bName = BibleCatalog.book(link.bookId)?.name(locale) ?: link.bookId
                                                        val refLabel = "$bName ${link.chapter}" + if (link.verses.isEmpty()) "" else ":${link.verses}"
                                                        Row(
                                                            Modifier
                                                                .fillMaxWidth()
                                                                .clip(RoundedCornerShape(8.dp))
                                                                .background(theme.canvas.toColor().copy(alpha = 0.55f))
                                                                .clickableNoRipple { onRead(link.bookId, link.chapter) }
                                                                .padding(horizontal = 10.dp, vertical = 8.dp),
                                                            verticalAlignment = Alignment.CenterVertically,
                                                        ) {
                                                            Column(Modifier.weight(1f)) {
                                                                Text(
                                                                    "${t(link.kindZh, link.kindEn)} · $refLabel",
                                                                    color = gold,
                                                                    fontSize = 12.sp,
                                                                    fontWeight = FontWeight.Bold,
                                                                )
                                                                Text(
                                                                    t(link.reasonZh, link.reasonEn),
                                                                    color = ink.copy(alpha = 0.84f),
                                                                    fontSize = 12.sp,
                                                                    lineHeight = 18.sp,
                                                                )
                                                            }
                                                            Text("›", color = gold, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                                                        }
                                                    }
                                                }
                                            }

                                            // 每一卷书卡片：直接展示「这一卷书在写什么」（intro.text(locale)）
                                            section.spans.forEach { span ->
                                                val key = "${section.id}:${span.bookId}:${span.first}"
                                                PanoramaBookSummaryCard(
                                                    span = span,
                                                    locale = locale,
                                                    theme = theme,
                                                    gold = gold,
                                                    currentBook = currentBook,
                                                    currentChapter = currentChapter,
                                                    expanded = key in expandedBooks,
                                                    onToggle = {
                                                        expandedBooks =
                                                            if (key in expandedBooks) expandedBooks - key
                                                            else expandedBooks + key
                                                    },
                                                    onRead = onRead,
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            item(key = "panorama-footer") {
                Text(
                    t(
                        "六幕是阅读导览，不是圣经原有的分卷。书卷可跨越多个阶段；诗歌、智慧与先知书按处境和主题连接。",
                        "The six acts are a reading guide, not the Bible's own divisions. Books can span stages; poetry, wisdom, and prophecy connect through context and themes.",
                    ),
                    color = muted,
                    fontSize = 12.sp,
                    lineHeight = 19.sp,
                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 4.dp),
                )
            }
        }

        if (showQuickCatalog) {
            val defaultBook = quickCatalogBook?.let { BibleCatalog.book(it) }
                ?: currentBook?.let { BibleCatalog.book(it) }
                ?: BibleCatalog.all.first()
            ChapterPickerSheet(
                book = defaultBook,
                chapterCount = defaultBook.chapterCount,
                currentChapter = if (defaultBook.id == currentBook) currentChapter else null,
                initialShowBooks = true,
                onPick = { ch ->
                    showQuickCatalog = false
                    onRead(defaultBook.id, ch)
                },
                onPickBookChapter = { pickedBook, ch ->
                    quickCatalogBook = pickedBook.id
                    showQuickCatalog = false
                    onRead(pickedBook.id, ch)
                },
                onClose = { showQuickCatalog = false },
                theme = theme,
                locale = locale,
            )
        }
    }
}

@Composable
private fun PanoramaBookSummaryCard(
    span: PanoramaSpan,
    locale: AppLocale,
    theme: Parchment,
    gold: Color,
    currentBook: String?,
    currentChapter: Int,
    expanded: Boolean,
    onToggle: () -> Unit,
    onRead: (String, Int) -> Unit,
) {
    val book: BookRef = BibleCatalog.book(span.bookId) ?: return
    val intro = BibleBookIntroductions.get(book.id)
    val ink = theme.ink.toColor()
    val muted = theme.muted.toColor()
    val isDark = theme == Parchment.dark
    val isCurrent = currentBook == book.id && currentChapter in span.first..span.last
    fun t(zh: String, en: String) = AppLocale.pick(zh, en, locale)

    val spanBadge = if (span.first == 1 && span.last == book.chapterCount) {
        t("共 ${book.chapterCount} 章", "${book.chapterCount} chs")
    } else {
        t("第 ${span.first}–${span.last} 章", "Ch. ${span.first}–${span.last}")
    }

    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(
                if (isCurrent) gold.copy(alpha = if (isDark) 0.18f else 0.12f)
                else theme.canvas.toColor().copy(alpha = if (isDark) 0.65f else 0.72f),
            )
            .border(
                if (isCurrent) 1.2.dp else 0.8.dp,
                if (isCurrent) gold else theme.border.toColor(),
                RoundedCornerShape(14.dp),
            ),
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .clickableNoRipple(onToggle)
                .padding(13.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    book.name(locale),
                    color = ink,
                    fontSize = 16.5.sp,
                    fontWeight = FontWeight.Bold,
                )
                Box(
                    Modifier
                        .clip(CircleShape)
                        .background(gold.copy(alpha = 0.15f))
                        .padding(horizontal = 8.dp, vertical = 2.dp),
                ) {
                    Text(spanBadge, color = gold, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                }
                if (isCurrent) {
                    Text(
                        t("正在读 · 第${currentChapter}章", "Ch. $currentChapter"),
                        color = gold,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
                Spacer(Modifier.weight(1f))
                Text(
                    if (expanded) t("收起 ▴", "Hide ▴") else t("选章 ▾", "Read ▾"),
                    color = gold,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }

            // 直接放出「这一卷书在写什么」
            Text(
                intro.text(locale),
                color = ink.copy(alpha = 0.88f),
                fontSize = 13.5.sp,
                lineHeight = 21.sp,
            )
        }

        if (expanded) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(start = 13.dp, end = 13.dp, bottom = 13.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Box(Modifier.fillMaxWidth().height(0.5.dp).background(theme.border.toColor()))

                if (intro.references.isNotBlank()) {
                    Text(
                        t("阅读线索：", "Key passages: ") + intro.references,
                        color = muted,
                        fontSize = 12.sp,
                        lineHeight = 18.sp,
                    )
                }

                BoxWithConstraints(Modifier.fillMaxWidth()) {
                    val cols = (maxWidth.value / (48f * LocalDensity.current.fontScale)).toInt().coerceIn(4, 7)
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        (span.first..span.last).toList().chunked(cols).forEach { rowChs ->
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                rowChs.forEach { ch ->
                                    val chActive = isCurrent && ch == currentChapter
                                    Box(
                                        Modifier
                                            .weight(1f)
                                            .height(38.dp)
                                            .clip(RoundedCornerShape(9.dp))
                                            .background(
                                                if (chActive) gold
                                                else theme.surface.toColor().copy(alpha = 0.9f),
                                            )
                                            .border(0.6.dp, if (chActive) gold else theme.border.toColor(), RoundedCornerShape(9.dp))
                                            .clickableNoRipple { onRead(book.id, ch) },
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        Text(
                                            "$ch",
                                            color = if (chActive) (if (isDark) Color(0xFF1A1511) else Color(0xFFFFFDF9)) else ink,
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.SemiBold,
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
