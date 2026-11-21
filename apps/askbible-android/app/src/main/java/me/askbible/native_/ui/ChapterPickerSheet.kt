package me.askbible.native_.ui

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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.BibleCatalog
import me.askbible.native_.data.BookRef
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.name

/**
 * 书卷与章节简易切换浮层（二合一）：
 * - 在目录页点书卷进入时：默认展示该卷 6 列章号网格，顶部可一键切「全部书卷」换书；
 * - 在阅读章页点顶栏「书名 章 ▾」或底栏「圣经」时：支持秒切其它书卷（66 卷双列）→ 再点章号即刻跳转。
 */
@Composable
fun ChapterPickerSheet(
    book: BookRef,
    chapterCount: Int,
    bookLabel: (BookRef) -> String = { it.name(AppLocale.current) },
    currentChapter: Int? = null,
    initialShowBooks: Boolean = false,
    onPick: (Int) -> Unit,
    onPickBookChapter: ((BookRef, Int) -> Unit)? = null,
    onClose: () -> Unit,
    theme: Parchment = LocalParchment.current,
    locale: AppLocale = AppLocale.ZH_CN,
) {
    var selectedBook by remember(book.id) { mutableStateOf(book) }
    var showBooks by remember(book.id, initialShowBooks) { mutableStateOf(initialShowBooks) }
    val activeCount = if (selectedBook.id == book.id && chapterCount > 0) chapterCount else selectedBook.chapterCount
    val ink = theme.ink.toColor()
    val muted = theme.muted.toColor()
    val accent = theme.accentOt.toColor()
    val isDark = theme == Parchment.dark

    val otBooks = remember { BibleCatalog.all.filter { it.number <= BibleCatalog.OLD_TESTAMENT_MAX } }
    val ntBooks = remember { BibleCatalog.all.filter { it.number > BibleCatalog.OLD_TESTAMENT_MAX } }

    Box(
        Modifier
            .fillMaxSize()
            .background(theme.modalBackdrop.toColor())
            .clickableNoRipple(onClose),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            Modifier
                .padding(horizontal = 16.dp)
                .fillMaxWidth()
                .heightIn(max = 560.dp)
                .parchmentCard(20.dp, theme)
                .padding(horizontal = 16.dp, vertical = 14.dp)
                .clickableNoRipple {},
        ) {
            // 顶栏：左侧切换书卷/返回 + 居中标题 + 关闭 ×
            Row(
                Modifier.fillMaxWidth().padding(bottom = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Row(
                    Modifier
                        .clip(CircleShape)
                        .background(accent.copy(alpha = if (isDark) 0.22f else 0.14f))
                        .border(0.8.dp, accent.copy(alpha = 0.45f), CircleShape)
                        .clickableNoRipple { showBooks = !showBooks }
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    MaterialIcon(if (showBooks) MI.CHEVRON_LEFT else MI.MENU_BOOK, 15f, accent)
                    Text(
                        if (showBooks) AppLocale.pick("返回选章", "Chapters", locale)
                        else AppLocale.pick("圣经目录", "Books", locale),
                        color = if (isDark) Color(0xFFFFC845) else accent,
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }

                Text(
                    if (showBooks) AppLocale.pick("选择书卷（66卷）", "Choose a Book", locale)
                    else bookLabel(selectedBook),
                    Modifier.weight(1f),
                    color = ink,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = TextAlign.Center,
                )

                Text(
                    "\u00D7",
                    Modifier.padding(horizontal = 6.dp).clickableNoRipple(onClose),
                    color = theme.faint.toColor(),
                    fontSize = 26.sp,
                    lineHeight = 26.sp,
                )
            }

            if (showBooks) {
                LazyColumn(
                    Modifier.fillMaxWidth().weight(1f, fill = false),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    contentPadding = PaddingValues(bottom = 6.dp),
                ) {
                    item {
                        Text(
                            AppLocale.pick("旧约 · 39卷", "Old Testament · 39", locale),
                            color = accent,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(top = 2.dp, bottom = 2.dp),
                        )
                    }
                    items(otBooks.chunked(2).size) { rowIdx ->
                        val pair = otBooks.chunked(2)[rowIdx]
                        BookPairRow(
                            pair = pair,
                            activeBookId = selectedBook.id,
                            bookLabel = bookLabel,
                            theme = theme,
                            onSelectBook = { picked ->
                                selectedBook = picked
                                showBooks = false
                            },
                        )
                    }
                    item {
                        Spacer(Modifier.height(4.dp))
                        Text(
                            AppLocale.pick("新约 · 27卷", "New Testament · 27", locale),
                            color = if (isDark) Color(0xFF93C5FD) else Color(0xFF2563EB),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(top = 4.dp, bottom = 2.dp),
                        )
                    }
                    items(ntBooks.chunked(2).size) { rowIdx ->
                        val pair = ntBooks.chunked(2)[rowIdx]
                        BookPairRow(
                            pair = pair,
                            activeBookId = selectedBook.id,
                            bookLabel = bookLabel,
                            theme = theme,
                            onSelectBook = { picked ->
                                selectedBook = picked
                                showBooks = false
                            },
                        )
                    }
                }
            } else {
                LazyVerticalGrid(
                    columns = GridCells.Fixed(6),
                    horizontalArrangement = Arrangement.spacedBy(9.dp),
                    verticalArrangement = Arrangement.spacedBy(9.dp),
                    contentPadding = PaddingValues(bottom = 4.dp),
                ) {
                    items((1..activeCount).toList()) { n ->
                        val isCurrent = selectedBook.id == book.id && currentChapter == n
                        Box(
                            Modifier
                                .height(46.dp)
                                .clip(RoundedCornerShape(11.dp))
                                .background(
                                    if (isCurrent) accent.copy(alpha = if (isDark) 0.32f else 0.22f)
                                    else theme.chapterCellPressed.toColor(),
                                )
                                .border(
                                    if (isCurrent) 1.5.dp else 0.6.dp,
                                    if (isCurrent) accent else theme.border.toColor(),
                                    RoundedCornerShape(11.dp),
                                )
                                .clickableNoRipple {
                                    if (onPickBookChapter != null) {
                                        onPickBookChapter(selectedBook, n)
                                    } else {
                                        onPick(n)
                                    }
                                },
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                "$n",
                                color = if (isCurrent && isDark) Color(0xFFFFC845) else ink,
                                fontSize = 18.sp,
                                fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.SemiBold,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun BookPairRow(
    pair: List<BookRef>,
    activeBookId: String,
    bookLabel: (BookRef) -> String,
    theme: Parchment,
    onSelectBook: (BookRef) -> Unit,
) {
    val ink = theme.ink.toColor()
    val accent = theme.accentOt.toColor()
    val isDark = theme == Parchment.dark
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        for (b in pair) {
            val active = b.id == activeBookId
            Row(
                Modifier
                    .weight(1f)
                    .height(42.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(
                        if (active) accent.copy(alpha = if (isDark) 0.28f else 0.16f)
                        else theme.surface.toColor().copy(alpha = if (isDark) 0.72f else 0.85f),
                    )
                    .border(
                        if (active) 1.2.dp else 0.6.dp,
                        if (active) accent else theme.border.toColor(),
                        RoundedCornerShape(10.dp),
                    )
                    .clickableNoRipple { onSelectBook(b) }
                    .padding(horizontal = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    b.displayNumber,
                    color = theme.muted.toColor(),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    bookLabel(b),
                    color = if (active && isDark) Color(0xFFFFC845) else ink,
                    fontSize = 14.sp,
                    fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    "${b.chapterCount}",
                    color = theme.faint.toColor(),
                    fontSize = 11.sp,
                )
            }
        }
        if (pair.size == 1) {
            Spacer(Modifier.weight(1f))
        }
    }
}
