package me.askbible.native_.ui

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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.askbible.native_.data.BibleCatalog
import me.askbible.native_.data.BookGroup
import me.askbible.native_.data.BookRef
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.title
import me.askbible.native_.data.name
import me.askbible.native_.data.ReadChrome
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.ReadSize
import me.askbible.native_.data.ShellMetrics

/**
 * 圣经目录。双栏 + 彩色分组，右侧竖排在这一页是 6 个（比章页多搜索和历史）。
 * 与 iOS 的 CatalogView 对等；书卷数据来自 core 的 BibleCatalog（已三端对拍）。
 */
@Composable
fun CatalogScreen(
    size: ReadSize,
    onOpenBook: (BookRef) -> Unit,
    /** 书卷名：在线译本用它自己那套（西语版本 → Génesis）；默认退回目录里的中英名 */
    bookLabel: (BookRef) -> String = { it.name(AppLocale.current) },
    /** 读经展示语言：书名 / 分组 / 「圣经 · 旧约 · 新约」都按它（英文译本 → 英文面） */
    locale: AppLocale = AppLocale.ZH_CN,
    onOpenSettings: () -> Unit,
    onSizeUp: () -> Unit,
    onSizeDown: () -> Unit,
    onOpenSearch: () -> Unit = {},
    onOpenFavorites: () -> Unit = {},
    theme: Parchment = Parchment.light,
) {
    Box(Modifier.fillMaxSize()) {
        ParchmentBackground(theme = theme)

        // RN tabbar preset：视口从屏幕顶到屏幕底，顶 70 / 底 120 渐隐，正文从透明底栏下面滑过去；
        // 底部留 72 + 导航栏 + 120（SHELL_TAB_BAR_CLEARANCE + readParchmentFadeSafePadding.bottom）
        val insets = WindowInsets.systemBars.asPaddingValues()
        // 右侧竖排最后一个按钮的底边，用来判断哪几行会被它压住
        val density = LocalDensity.current
        val railBottomPx = with(density) {
            (insets.calculateTopPadding() + ShellMetrics.topChromeOffset.dp +
                (ShellMetrics.topChromeButton * 6 + ShellMetrics.topChromeGap * 5).dp).toPx()
        }
        LazyColumn(
            Modifier.fillMaxSize().parchmentFade(ParchmentFadePreset.TABBAR),
            contentPadding = PaddingValues(
                start = 14.dp, end = 14.dp, top = 42.dp + insets.calculateTopPadding(),
                bottom = TAB_BAR_CLEARANCE.dp + insets.calculateBottomPadding() + 120.dp,
            ),
        ) {
            item {
                Text(
                    ReadChrome.catalogTitle(locale),
                    Modifier.fillMaxWidth(),
                    color = theme.ink.toColor(),
                    fontSize = 30.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.height(18.dp))
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(ReadChrome.testamentOld(locale), color = Color(0xFF2F6291),
                         fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    // RN BibleCatalogOutlineContent：MaterialIcons notes 22，未开时 faint
                    MaterialIcon(MI.NOTES, 22f, theme.faint.toColor(), modifier = Modifier.padding(horizontal = 14.dp))
                    Text(ReadChrome.testamentNew(locale), color = Color(0xFFC1660B),
                         fontSize = 20.sp, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.height(16.dp))
            }

            item {
                Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    CatalogColumn(BibleCatalog.oldTestament, size, theme, onOpenBook, Modifier.weight(1f), locale = locale, bookLabel = bookLabel)
                    // 右列顶上那几行正好压在右侧竖排下面：不让开的话点书卷会点到设置 / + / − 上
                    // （Josh 2026-09-10 实测「点 Luc 右边字号变小了」）
                    CatalogColumn(BibleCatalog.newTestament, size, theme, onOpenBook, Modifier.weight(1f),
                                  locale = locale, bookLabel = bookLabel, railBottomPx = railBottomPx)
                }
            }
            // 目录页底下不再放读经计划区块（Josh 2026-09-09「圣经目录面下面不需要展示读经计划」），读经计划走底栏中央键
        }

        CatalogRail(theme, onOpenSettings, onSizeUp, onSizeDown, onOpenSearch = onOpenSearch, onOpenFavorites = onOpenFavorites)
    }
}

/** 右侧竖排占掉的宽度：按钮 50 + 边距 8，再少留 4 让书名多一点位置 */
private const val RAIL_CLEARANCE = 54f

@Composable
private fun CatalogColumn(
    groups: List<BookGroup>,
    size: ReadSize,
    theme: Parchment,
    onOpenBook: (BookRef) -> Unit,
    modifier: Modifier = Modifier,
    locale: AppLocale = AppLocale.ZH_CN,
    /** 书卷名：在线译本用它自己那套 */
    bookLabel: (BookRef) -> String = { it.name(locale) },
    /** >0 时：纵向落在这个位置以上的行，右边留出图标栏的宽度 */
    railBottomPx: Float = 0f,
) {
    // RN 的 catalogBookLine：行高跟着字号档走，放大字号时行距也跟着开，手指更好点
    val rowHeight = size.metrics.catalogBookLine.dp
    Column(modifier) {
        for (group in groups) {
            Text(
                group.title(locale),
                Modifier.padding(top = 7.dp, bottom = 3.dp),
                color = Color(0xFF000000 or group.colorHex.toLong()),
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
            )
            Row {
                Box(Modifier.width(2.5.dp).fillMaxWidth(0f)
                    .height(rowHeight * group.books.size)
                    .background(Color(0xFF000000 or group.colorHex.toLong())))
                Column(Modifier.padding(start = 5.dp)) {
                    for (book in group.books) {
                        var underRail by remember(book.id) { mutableStateOf(false) }
                        Row(
                            Modifier.fillMaxWidth().height(rowHeight)
                                .onGloballyPositioned { c ->
                                    underRail = railBottomPx > 0f &&
                                        c.positionInWindow().y < railBottomPx
                                }
                                .padding(end = if (underRail) RAIL_CLEARANCE.dp else 0.dp)
                                .clickableNoRipple { onOpenBook(book) }
                                .padding(horizontal = 5.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text(book.displayNumber,
                                 color = Color(0xFF000000 or group.colorHex.toLong()),
                                 fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                            // softWrap=false + Ellipsis：否则「1 Thessalonians」装不下时会在空格处折行，
                            // maxLines=1 只留下第一行的「1」。iOS 的 lineLimit(1) 默认就是截断加省略号。
                            Text(bookLabel(book), color = theme.ink.toColor(),
                                 fontSize = (size.metrics.catalogBookSize * 0.85f).sp,
                                 maxLines = 1, softWrap = false, overflow = TextOverflow.Ellipsis,
                                 modifier = Modifier.weight(1f))
                            // RN bookChevron：文字「›」24/400 faint，透明度 .58
                            Text("\u203A", color = theme.faint.toColor().copy(alpha = 0.58f), fontSize = 24.sp, lineHeight = 24.sp)
                        }
                    }
                }
            }
        }
    }
}

/** 目录页的右侧竖排：设置 / 搜索 / 收藏 / + / − / 历史，共 6 个 */
@Composable
private fun CatalogRail(
    theme: Parchment,
    onOpenSettings: () -> Unit,
    onSizeUp: () -> Unit,
    onSizeDown: () -> Unit,
    onOpenSearch: () -> Unit = {},
    onOpenFavorites: () -> Unit = {},
) {
    Column(
        Modifier.fillMaxWidth()
            .statusBarsPadding()
            .padding(horizontal = ShellMetrics.topChromeSideInset.dp,
                     vertical = ShellMetrics.topChromeOffset.dp),
        horizontalAlignment = Alignment.End,
        verticalArrangement = Arrangement.spacedBy(ShellMetrics.topChromeGap.dp),
    ) {
        RailIcon(MI.SETTINGS, onOpenSettings)
        RailIcon(MI.SEARCH, onOpenSearch)
        RailIcon(MI.BOOKMARK_BORDER, onOpenFavorites)
        RailLabel("+", onSizeUp)
        RailLabel("\u2212", onSizeDown)
        RailIcon(MI.HISTORY) {}
    }
}

@Composable
private fun RailIcon(glyph: String, onClick: () -> Unit) {
    Box(Modifier.size(ShellMetrics.topChromeButton.dp).clickableNoRipple(onClick),
        contentAlignment = Alignment.Center) {
        MaterialIcon(glyph, ShellMetrics.topChromeIcon, Color.White, shadow = true)
    }
}

@Composable
private fun RailLabel(text: String, onClick: () -> Unit) {
    Box(Modifier.size(ShellMetrics.topChromeButton.dp).clickableNoRipple(onClick),
        contentAlignment = Alignment.Center) {
        // 与旁边的图标一样带投影（Josh 真机：「右边 + - 没有阴影」）
        Text(text, color = Color.White,
             fontSize = ShellMetrics.topChromeSizeLabel.sp, fontWeight = FontWeight.Medium,
             style = androidx.compose.ui.text.TextStyle(shadow = ShellIconShadow))
    }
}
