package me.askbible.native_.ui

import me.askbible.native_.data.RemoteTranslations
import me.askbible.native_.data.SiteCopy
import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.gestures.animateScrollBy
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import me.askbible.native_.data.InfoEditionVariant
import kotlinx.coroutines.launch
import androidx.compose.runtime.setValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.askbible.native_.data.BibleCatalog
import me.askbible.native_.data.ChapterSegmentMeta
import me.askbible.native_.data.ChapterSegments
import me.askbible.native_.data.LoadedVerse
import me.askbible.native_.data.Parchment
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.border
import androidx.compose.material3.CircularProgressIndicator
import me.askbible.native_.data.TranslationDelivery
import me.askbible.native_.data.ScriptureTranslation
import me.askbible.native_.data.ReadChrome
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.ReadSize
import me.askbible.native_.data.ReadTypographyMetrics
import me.askbible.native_.data.ShellMetrics

/**
 * 阅读章页。版式逐项对齐 RN 的 ReadChapterScreen（verseParagraphFlow 连排模式），与 iOS 的 ChapterView 对等：
 * 「书名 第N章」标题 + 细线、按 chapter-segments 分段连排、小标题居中、段间 16 / 带小标题 22 + 96 细线、
 * 结尾「‹ 第N章 | 书名 | 第N章 ›」+ 渐变收尾。
 */
@Composable
fun ChapterScreen(
    bookId: String,
    /** 按读经展示语言取好的书名（中文译本中文名 / 英文译本英文名） */
    bookName: String,
    chapter: Int,
    /** 读经展示语言（RN readDisplayLocale）：标题格式、小标题、章末「第N章 / Chapter N」、读后两版都按它 */
    locale: AppLocale = AppLocale.ZH_CN,
    /** 界面语言（读后两版这类「只有中文内容」的模块按它决定出不出，不跟译本语言） */
    uiLocale: AppLocale = AppLocale.ZH_CN,
    /** 当前主译本 id（判断是不是下载型，给提示用） */
    translationId: String = "",
    /** 在线 / 下载型译本取数中 / 取不到（内置译本瞬时读库，不会看到） */
    loading: Boolean = false,
    failed: Boolean = false,
    onRetry: () -> Unit = {},
    verses: List<LoadedVerse>,
    xrefVerses: Set<Int>,
    size: ReadSize,
    activeVerse: Int?,
    onBack: () -> Unit,
    onOpenSettings: () -> Unit,
    onSizeUp: () -> Unit,
    onSizeDown: () -> Unit,
    theme: Parchment = Parchment.light,
    isPlaying: Boolean = false,
    /** 副译本对照：节号 → 对照文；空则不显示 */
    contrast: Map<Int, String> = emptyMap(),
    /** 点了有串珠的节号 → 经文关联 */
    onTapVerse: (Int) -> Unit = {},
    bookmarked: Set<Int> = emptySet(),
    /** 从搜索 / 收藏跳进来要定位并标出的那节 */
    focusVerse: Int? = null,
    onDoubleTapVerse: (LoadedVerse) -> Unit = {},
    onLongPressVerse: (LoadedVerse) -> Unit = {},
    onOpenSearch: () -> Unit = {},
    onOpenFavorites: () -> Unit = {},
    /** 结尾中间的书名 → 回目录 */
    onOpenCatalog: () -> Unit = {},
    /** 结尾左右的上一章 / 下一章（可跨卷） */
    onNavigate: (bookId: String, chapter: Int) -> Unit = { _, _ -> },
) {
    val context = LocalContext.current
    val meta = remember(bookId, chapter, locale) { ChapterSegments.meta(context, bookId, chapter, english = locale == AppLocale.EN) }
    val groups = remember(verses, meta) { ChapterSegments.paragraphGroups(verses, meta) }
    val neighbors = remember(bookId, chapter) { ChapterNeighbor.resolve(bookId, chapter) }
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()
    // 搜索定位标记：进来时亮着，用户一动某节就灭
    var searchFocus by remember(bookId, chapter, focusVerse) { mutableStateOf(focusVerse) }
    LaunchedEffect(bookId, chapter, focusVerse, groups.size) {
        // 搜索 / 收藏跳进来：经文装好后滚到那节所在的段
        val f = focusVerse ?: return@LaunchedEffect
        val gi = groups.indexOfFirst { g -> g.any { it.number == f } }
        if (gi >= 0) listState.animateScrollToItem(gi + 1)
    }
    // 章末「读后两版」当前展开的是哪一版；换章清空
    var activeEdition by remember(bookId, chapter) { mutableStateOf<InfoEditionVariant?>(null) }
    // 换章回到顶部：LazyColumn 状态跨章复用，不主动滚回去会停在上一章的位置（计划流顺章时标题在屏外）
    LaunchedEffect(bookId, chapter) { listState.scrollToItem(0) }

    // 跟读时把当前「节」滚到可读区中心（RN scrollVerseToReadableCenter / readChapterReadableCenterFromScreen：
    // 顶栏 56 + 安全区 到 底部 72 + 安全区 + 音频条 220 之间的几何中心；偏差不到 8px 不动）。
    // 之前按「段」animateScrollToItem 只把段首顶到视口顶，长段后半的节会读到屏幕外（Josh 三星 2026-09-10）。
    // 用户手动滚动中不打断。
    val verseBounds = remember(bookId, chapter) { mutableStateMapOf<Int, Pair<Float, Float>>() }
    val rootView = LocalView.current
    val density = LocalDensity.current
    val navBarBottom = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    val sbTop = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    LaunchedEffect(activeVerse, isPlaying) {
        val v = activeVerse ?: return@LaunchedEffect
        if (!isPlaying) return@LaunchedEffect
        val gi = groups.indexOfFirst { g -> g.any { it.number == v } }
        if (gi < 0) return@LaunchedEffect
        if (listState.isScrollInProgress) return@LaunchedEffect
        var b = verseBounds[v]
        if (b == null) {
            // 这节所在的段还没排上屏：先把段滚进来，等一帧拿到节的位置再对中
            listState.animateScrollToItem(gi + 1)  // +1 跳过标题 item
            kotlinx.coroutines.delay(80)
            b = verseBounds[v] ?: return@LaunchedEffect
        }
        val target: Float = with(density) {
            val top = 56.dp.toPx() + sbTop.toPx()
            val bottom = rootView.height - 72.dp.toPx() - navBarBottom.toPx() - 220.dp.toPx()
            (top + bottom) / 2
        }
        val delta = (b.first + b.second) / 2 - target
        if (kotlin.math.abs(delta) >= with(density) { 8.dp.toPx() }) listState.animateScrollBy(delta)
    }
    val m = size.metrics
    val statusBarTop = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()

    Box(Modifier.fillMaxSize()) {
        ParchmentBackground(theme = theme)

        LazyColumn(
            state = listState,
            // 视口从屏幕顶开始（状态栏高度并进 contentPadding），顶部 70 渐隐才对得上 RN
            modifier = Modifier.fillMaxSize().parchmentFade(ParchmentFadePreset.CHAPTER),
            contentPadding = PaddingValues(
                start = 20.dp, end = 20.dp, top = 59.dp + statusBarTop,
                bottom = (ShellMetrics.tabRowHeight + ShellMetrics.tabBarDockGap +
                          ShellMetrics.dockContentHeight + 24f).dp,
            ),
        ) {
            item(key = "header") {
                // header：paddingTop 4 / paddingBottom 24 / 细线 / marginBottom 12（readChapterScreenLayoutStyles.header）
                Column(Modifier.fillMaxWidth().padding(bottom = 12.dp)) {
                    Text(
                        ReadChrome.chapterTitle(bookName, chapter, locale),
                        Modifier.fillMaxWidth().padding(start = 42.dp, end = 42.dp, top = 4.dp, bottom = 24.dp),
                        color = theme.ink.toColor(),
                        fontSize = m.chapterTitleSize.sp,
                        fontWeight = FontWeight.SemiBold,
                        textAlign = TextAlign.Center,
                    )
                    Box(Modifier.fillMaxWidth().height(0.5.dp).background(theme.border.toColor()))
                }
            }

            if (verses.isEmpty() && (loading || failed)) item(key = "status") {
                ChapterStatus(loading, ScriptureTranslation.find(translationId)?.delivery == TranslationDelivery.DOWNLOAD, theme, locale, onRetry)
            }
            itemsIndexed(groups, key = { _, g -> g.first().number }) { gi, group ->
                ParagraphBlock(group, gi, meta, locale, m, theme, xrefVerses, activeVerse, contrast,
                    bookmarked = bookmarked, searchFocus = searchFocus,
                    onTapVerseNumber = { v -> searchFocus = null; if (v in xrefVerses) onTapVerse(v) },
                    onDoubleTapVerse = { v -> searchFocus = null; group.firstOrNull { it.number == v }?.let(onDoubleTapVerse) },
                    onLongPressVerse = { v -> searchFocus = null; group.firstOrNull { it.number == v }?.let(onLongPressVerse) },
                    onVerseBounds = { b -> verseBounds.putAll(b) })
            }

            // 在线译本的版权声明（YouVersion 条款要求展示；内置译本没有这一行）
            RemoteTranslations.attribution(translationId, locale)?.let { copyright ->
                item(key = "copyright") {
                    Text(copyright, Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 18.dp),
                         color = theme.faint.toColor(), fontSize = 12.sp, lineHeight = 16.sp)
                }
            }

            item(key = "ending") {
                EndingSection(bookName, neighbors, theme, onOpenCatalog, onNavigate, locale)
            }
            // 读后两版入口：陪你探索 / 查找资料（RN ReadChapterPostReadingEditions）。
            // 库里中英两套都有：读英文译本（RN prefersEnglishInfoEdition）或界面是英文 → 英文那套；
            // 其余（含西班牙语等没有对应语种内容的版本）跟界面语言走中文那套（Josh 2026-09-10）
            item(key = "post-reading") {
                PostReadingEditions(
                    bookId = bookId, chapter = chapter, size = size, theme = theme,
                    prev = neighbors.first, next = neighbors.second,
                    active = activeEdition, onActiveChange = { activeEdition = it },
                    english = locale == AppLocale.EN || uiLocale == AppLocale.EN,
                    onNavigate = onNavigate,
                    onBackToTop = { scope.launch { listState.animateScrollToItem(0) } },
                )
            }
        }

        TopChrome(theme, onBack, onOpenSettings, onSizeUp, onSizeDown, onOpenSearch, onOpenFavorites)
    }
}

/** 一个段落：段前分隔（首段没有；带小标题时 22 高 + 96 宽细线，否则 16 空）→ 小标题 → 连排正文 → 副译本对照 */
@Composable
private fun ParagraphBlock(
    group: List<LoadedVerse>,
    index: Int,
    meta: ChapterSegmentMeta,
    locale: AppLocale,
    m: ReadTypographyMetrics,
    theme: Parchment,
    xrefVerses: Set<Int>,
    activeVerse: Int?,
    contrast: Map<Int, String>,
    bookmarked: Set<Int>,
    searchFocus: Int?,
    onTapVerseNumber: (Int) -> Unit,
    onDoubleTapVerse: (Int) -> Unit,
    onLongPressVerse: (Int) -> Unit,
    onVerseBounds: ((Map<Int, Pair<Float, Float>>) -> Unit)? = null,
) {
    val headings = (meta.headings[group.first().number] ?: emptyList()).map { locale.zh(it) }
    Column(Modifier.fillMaxWidth().padding(bottom = 14.dp)) {  // verseParagraphBlock.marginBottom
        if (index > 0) {
            if (headings.isEmpty()) {
                Spacer(Modifier.height(16.dp))
            } else {
                Box(Modifier.fillMaxWidth().height(22.dp), contentAlignment = Alignment.Center) {
                    Box(Modifier.width(96.dp).height(0.5.dp).background(theme.border.toColor(), CircleShape))
                }
            }
        }
        for (h in headings) {
            // segmentHeading：字号 +1、行高 +2、#70451F、600、字距 0.3、居中、上 18 下 16
            Text(
                h,
                Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 18.dp, bottom = 16.dp),
                color = Color(0xFF70451F).copy(alpha = 0.92f),
                fontSize = (m.verseFontSize + 1).sp,
                lineHeight = (m.verseLineHeight + 2).sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 0.3.sp,
                textAlign = TextAlign.Center,
            )
        }
        ChapterFlowParagraph(group, m, theme, xrefVerses, activeVerse, bookmarked, searchFocus,
                             onTapVerseNumber, onDoubleTapVerse, onLongPressVerse, onVerseBounds)
        // 副译本对照行：0.82× 字号，muted，上距 7（verseContrast）
        for (v in group) {
            val line = contrast[v.number] ?: continue
            val cfs = m.verseFontSize * 0.82f
            Text(
                "${v.number} $line",
                Modifier.fillMaxWidth().padding(top = 7.dp),
                color = theme.muted.toColor(),
                fontSize = cfs.sp,
                lineHeight = maxOf(m.verseLineHeight * 0.78f, cfs * 1.2f).sp,
            )
        }
    }
}

/** 结尾：endNav（上 80 下 50）+ 收尾渐变（28 高，贴满屏宽）+ 段尾 30 */
/** 在线 / 下载型译本取数中或失败时的提示 */
@Composable
private fun ChapterStatus(loading: Boolean, downloading: Boolean, theme: Parchment, locale: AppLocale, onRetry: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(vertical = 40.dp, horizontal = 24.dp), horizontalAlignment = Alignment.CenterHorizontally,
           verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (loading) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                CircularProgressIndicator(color = theme.muted.toColor(), strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                Text(if (downloading) SiteCopy.t("native.translationDownloading", locale) else SiteCopy.t("native.chapterFetching", locale), color = theme.muted.toColor(), fontSize = 15.sp)
            }
        } else {
            Text(SiteCopy.t("native.translationOfflineHint", locale), color = theme.muted.toColor(), fontSize = 15.sp, textAlign = TextAlign.Center)
            Text(SiteCopy.t("pages.read.retry", locale), Modifier.clip(CircleShape).background(theme.surface.toColor()).border(1.dp, theme.border.toColor(), CircleShape)
                    .clickableNoRipple(onRetry).padding(horizontal = 18.dp, vertical = 9.dp),
                 color = theme.ink.toColor(), fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun EndingSection(
    bookName: String,
    neighbors: Pair<ChapterNeighbor?, ChapterNeighbor?>,
    theme: Parchment,
    onOpenCatalog: () -> Unit,
    onNavigate: (String, Int) -> Unit,
    locale: AppLocale = AppLocale.ZH_CN,
) {
    val faint = theme.faint.toColor()
    Column(Modifier.fillMaxWidth().padding(bottom = 30.dp)) {
        Row(
            Modifier.fillMaxWidth().padding(top = 80.dp, bottom = 50.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
                neighbors.first?.let { p ->
                    Row(Modifier.clickableNoRipple { onNavigate(p.bookId, p.chapter) },
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                        // RN：MaterialIcons chevron-left 16 + 13/500，颜色 breadcrumbColor = faint
                        MaterialIcon(MI.CHEVRON_LEFT, 16f, faint)
                        Text(ReadChrome.chapterLabel(p.chapter, locale), color = faint, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                    }
                }
            }
            Text(
                bookName,
                Modifier.widthIn(max = 120.dp).padding(horizontal = 4.dp).clickableNoRipple(onOpenCatalog),
                color = theme.ink.toColor(), fontSize = 16.sp, fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center, maxLines = 1, softWrap = false, overflow = TextOverflow.Ellipsis,
            )
            Box(Modifier.weight(1f), contentAlignment = Alignment.CenterEnd) {
                neighbors.second?.let { n ->
                    Row(Modifier.clickableNoRipple { onNavigate(n.bookId, n.chapter) },
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(ReadChrome.chapterLabel(n.chapter, locale), color = faint, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                        MaterialIcon(MI.CHEVRON_RIGHT, 16f, faint)
                    }
                }
            }
        }
        // scriptureClosingDivider：rgba(78,52,30) .22 → .14 → .07 → .03 → 0，宽 = 屏宽（越过 20 的内边距）
        Box(
            Modifier.fillMaxWidth().padding(bottom = 14.dp).height(34.dp)
                .layout { measurable, constraints ->
                    val extra = (40.dp).roundToPx()
                    val p = measurable.measure(constraints.copy(maxWidth = constraints.maxWidth + extra, minWidth = constraints.maxWidth + extra))
                    layout(constraints.maxWidth, p.height) { p.placeRelative(-extra / 2, 0) }
                },
            contentAlignment = Alignment.Center,
        ) {
            Box(Modifier.fillMaxWidth().height(28.dp).background(Brush.verticalGradient(
                0f to Color(0x384E341E), 0.28f to Color(0x244E341E), 0.58f to Color(0x124E341E),
                0.82f to Color(0x084E341E), 1f to Color(0x004E341E),
            )))
        }
    }
}

/**
 * 左上返回 + 右上竖排。位置来自 ShellMetrics（readTopChrome.ts）：
 * 按钮 50、图标 32、间距 5、边距 8；加减号是 32sp 文字不是图标。
 */
@Composable
private fun TopChrome(
    theme: Parchment,
    onBack: () -> Unit,
    onOpenSettings: () -> Unit,
    onSizeUp: () -> Unit,
    onSizeDown: () -> Unit,
    onOpenSearch: () -> Unit = {},
    onOpenFavorites: () -> Unit = {},
) {
    Row(
        Modifier.fillMaxWidth()
            .statusBarsPadding()
            .padding(horizontal = ShellMetrics.topChromeSideInset.dp,
                     vertical = ShellMetrics.topChromeOffset.dp),
        verticalAlignment = Alignment.Top,
    ) {
        // RN 的返回是 React Navigation HeaderBackButton：Android 上就是 Material arrow-back
        ChromeIcon(MI.ARROW_BACK, onBack)
        Spacer(Modifier.weight(1f))
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(ShellMetrics.topChromeGap.dp),
        ) {
            ChromeIcon(MI.SETTINGS, onOpenSettings)
            ChromeIcon(MI.SEARCH, onOpenSearch)
            ChromeIcon(MI.BOOKMARK_BORDER, onOpenFavorites)
            ChromeLabel("+", onSizeUp)
            ChromeLabel("−", onSizeDown)
        }
    }
}

@Composable
private fun ChromeIcon(glyph: String, onClick: () -> Unit) {
    Box(
        Modifier.size(ShellMetrics.topChromeButton.dp).clickableNoRipple(onClick),
        contentAlignment = Alignment.Center,
    ) {
        MaterialIcon(glyph, ShellMetrics.topChromeIcon, Color.White, shadow = true)
    }
}

@Composable
private fun ChromeLabel(text: String, onClick: () -> Unit) {
    Box(
        Modifier.size(ShellMetrics.topChromeButton.dp).clickableNoRipple(onClick),
        contentAlignment = Alignment.Center,
    ) {
        // 与旁边的图标一样带投影（Josh 真机：「右边 + - 没有阴影」）
        Text(text, color = Color.White,
             fontSize = ShellMetrics.topChromeSizeLabel.sp, fontWeight = FontWeight.Medium,
             style = androidx.compose.ui.text.TextStyle(shadow = ShellIconShadow))
    }
}

/** 上一章 / 下一章（可跨卷）。对应 RN `read-chapter-neighbors.ts`：卷首的上一章是前一卷末章，卷末的下一章是后一卷首章。 */
data class ChapterNeighbor(val bookId: String, val chapter: Int) {
    companion object {
        fun resolve(bookId: String, chapter: Int): Pair<ChapterNeighbor?, ChapterNeighbor?> {
            val all = BibleCatalog.all
            val i = all.indexOfFirst { it.id == bookId.uppercase() }
            if (i < 0) return null to null
            val book = all[i]
            if (chapter < 1 || chapter > book.chapterCount) return null to null
            val prev = when {
                chapter > 1 -> ChapterNeighbor(book.id, chapter - 1)
                i > 0 -> ChapterNeighbor(all[i - 1].id, all[i - 1].chapterCount)
                else -> null
            }
            val next = when {
                chapter < book.chapterCount -> ChapterNeighbor(book.id, chapter + 1)
                i + 1 < all.size -> ChapterNeighbor(all[i + 1].id, 1)
                else -> null
            }
            return prev to next
        }
    }
}
