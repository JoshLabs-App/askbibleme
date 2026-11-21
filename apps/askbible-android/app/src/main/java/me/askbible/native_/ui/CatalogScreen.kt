package me.askbible.native_.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.BibleCatalog
import me.askbible.native_.data.BookGroup
import me.askbible.native_.data.BookRef
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.ReadChrome
import me.askbible.native_.data.ReadSize
import me.askbible.native_.data.SiteCopy
import me.askbible.native_.data.name
import me.askbible.native_.data.title

/**
 * 圣经目录（对齐 iOS CatalogView）：
 * 移除右侧遮挡新约书名的 6 颗竖排圆钮，改为顶部「圣经 + 译本胶囊 + 收藏」页眉 + 搜索直达入口条 +
 * 「继续上次阅读」暖琥珀书签条 + 对称无遮挡双栏目录。
 */
@Composable
fun CatalogScreen(
    size: ReadSize,
    onOpenBook: (BookRef) -> Unit,
    bookLabel: (BookRef) -> String = { it.name(AppLocale.current) },
    locale: AppLocale = AppLocale.ZH_CN,
    translationLabel: String = "",
    lastReadTitle: String? = null,
    onOpenSettings: () -> Unit,
    onSizeUp: () -> Unit = {},
    onSizeDown: () -> Unit = {},
    onOpenSearch: () -> Unit = {},
    onOpenFavorites: () -> Unit = {},
    onLastRead: (() -> Unit)? = null,
    theme: Parchment = Parchment.light,
) {
    val insets = WindowInsets.systemBars.asPaddingValues()
    val density = LocalDensity.current
    val ink = theme.ink.toColor()
    val muted = theme.muted.toColor()
    val faint = theme.faint.toColor()
    val accent = theme.accentOt.toColor()

    Box(Modifier.fillMaxSize()) {
        ParchmentBackground(theme = theme)

        LazyColumn(
            Modifier.fillMaxSize().parchmentFade(ParchmentFadePreset.TABBAR),
            contentPadding = PaddingValues(
                start = 20.dp,
                end = 20.dp,
                top = 16.dp + insets.calculateTopPadding(),
                bottom = TAB_BAR_CLEARANCE.dp + insets.calculateBottomPadding() + 110.dp,
            ),
        ) {
            item(key = "header") {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        ReadChrome.catalogTitle(locale),
                        color = ink,
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f),
                    )
                    if (translationLabel.isNotEmpty()) {
                        Row(
                            Modifier
                                .clip(CircleShape)
                                .background(theme.surface.toColor().copy(alpha = 0.85f))
                                .border(1.dp, theme.border.toColor(), CircleShape)
                                .clickableNoRipple(onOpenSettings)
                                .padding(horizontal = 11.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(3.dp),
                        ) {
                            Text(translationLabel, color = muted, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                            MaterialIcon(MI.EXPAND_MORE, 15f, muted)
                        }
                        Spacer(Modifier.width(8.dp))
                    }
                    Box(
                        Modifier
                            .size(34.dp)
                            .clip(CircleShape)
                            .background(theme.surface.toColor().copy(alpha = 0.85f))
                            .border(1.dp, theme.border.toColor(), CircleShape)
                            .clickableNoRipple(onOpenFavorites),
                        contentAlignment = Alignment.Center,
                    ) {
                        MaterialIcon(MI.BOOKMARK_BORDER, 18f, muted)
                    }
                }

                // 温润搜索入口条（支持输入 约 3:16 直达）
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(top = 14.dp)
                        .height(42.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(theme.surface.toColor().copy(alpha = 0.86f))
                        .border(1.dp, theme.border.toColor(), RoundedCornerShape(12.dp))
                        .clickableNoRipple(onOpenSearch)
                        .padding(horizontal = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    MaterialIcon(MI.SEARCH, 18f, muted)
                    Text(
                        AppLocale.pick("搜索经文，或输入如 约 3:16 直达…", "Search scripture or jump e.g. John 3:16…", locale),
                        color = faint,
                        fontSize = 14.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }

                // 上次阅读暖琥珀书签条
                if (onLastRead != null && !lastReadTitle.isNullOrEmpty()) {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .padding(top = 10.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(accent.copy(alpha = 0.12f))
                            .border(0.75.dp, accent.copy(alpha = 0.35f), RoundedCornerShape(12.dp))
                            .clickableNoRipple(onLastRead)
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        MaterialIcon(MI.BOOKMARK, 16f, accent)
                        Text(
                            AppLocale.pick("继续上次阅读：$lastReadTitle", "Continue reading: $lastReadTitle", locale),
                            color = ink,
                            fontSize = 13.5.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f),
                        )
                        MaterialIcon(MI.CHEVRON_RIGHT, 16f, accent)
                    }
                }

                Spacer(Modifier.height(20.dp))
            }

            item(key = "columns") {
                if (density.fontScale >= 1.3f) {
                    Column {
                        Text(ReadChrome.testamentOld(locale), color = Color(0xFF2F6291), fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 4.dp))
                        CatalogColumn(BibleCatalog.oldTestament, size, theme, onOpenBook, Modifier.fillMaxWidth(), locale = locale, bookLabel = bookLabel)
                        Spacer(Modifier.height(20.dp))
                        Text(ReadChrome.testamentNew(locale), color = Color(0xFFC1660B), fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 4.dp))
                        CatalogColumn(BibleCatalog.newTestament, size, theme, onOpenBook, Modifier.fillMaxWidth(), locale = locale, bookLabel = bookLabel)
                    }
                } else {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(18.dp), verticalAlignment = Alignment.Top) {
                        Column(Modifier.weight(1f)) {
                            Text(ReadChrome.testamentOld(locale), color = Color(0xFF2F6291), fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 4.dp))
                            CatalogColumn(BibleCatalog.oldTestament, size, theme, onOpenBook, Modifier.fillMaxWidth(), locale = locale, bookLabel = bookLabel)
                        }
                        Column(Modifier.weight(1f)) {
                            Text(ReadChrome.testamentNew(locale), color = Color(0xFFC1660B), fontSize = 19.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 4.dp))
                            CatalogColumn(BibleCatalog.newTestament, size, theme, onOpenBook, Modifier.fillMaxWidth(), locale = locale, bookLabel = bookLabel)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CatalogColumn(
    groups: List<BookGroup>,
    size: ReadSize,
    theme: Parchment,
    onOpenBook: (BookRef) -> Unit,
    modifier: Modifier = Modifier,
    locale: AppLocale = AppLocale.ZH_CN,
    bookLabel: (BookRef) -> String = { it.name(locale) },
) {
    val rowHeight = maxOf(40f, size.metrics.catalogBookLine.toFloat()).dp
    Column(modifier) {
        for (group in groups) {
            Text(
                group.title(locale),
                Modifier.padding(top = 8.dp, bottom = 3.dp),
                color = Color(0xFF000000 or group.colorHex.toLong()),
                fontSize = 15.5.sp,
                fontWeight = FontWeight.Bold,
            )
            Row {
                Box(
                    Modifier
                        .width(2.2.dp)
                        .height(rowHeight * group.books.size)
                        .background(Color(0xFF000000 or group.colorHex.toLong())),
                )
                Column(Modifier.padding(start = 6.dp)) {
                    for (book in group.books) {
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .heightIn(min = rowHeight)
                                .clickableNoRipple { onOpenBook(book) }
                                .padding(horizontal = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text(
                                book.displayNumber,
                                color = Color(0xFF000000 or group.colorHex.toLong()),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Text(
                                bookLabel(book),
                                color = theme.ink.toColor(),
                                fontSize = (size.metrics.catalogBookSize * 0.85f).sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                }
            }
        }
    }
}
