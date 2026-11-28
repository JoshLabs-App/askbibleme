package me.askbible.native_.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.BibleBookIntroductions
import me.askbible.native_.data.BibleCatalog
import me.askbible.native_.data.BiblePanorama
import me.askbible.native_.data.BookRef
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.name

/**
 * 圣经全景 —— 直接引用全站唯一 [ParchmentPageKit]（与「今日同行」完全同一套羊皮卷骨架、页头、卡片与字体），
 * 只承载全景内容，不造第二套版面。
 */
@OptIn(ExperimentalLayoutApi::class)
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
    onSelectTab: ((String) -> Unit)? = null,
) {
    val ink = theme.ink.toColor()
    val muted = theme.muted.toColor()
    val faint = theme.faint.toColor()
    val accent = theme.accentOt.toColor()
    val surface = theme.surface.toColor()
    val border = theme.border.toColor()

    val currentLocation = remember(currentBook, currentChapter) {
        currentBook?.let { BiblePanorama.location(it, maxOf(1, currentChapter)) }
    }
    val currentBookObj = remember(currentBook) { currentBook?.let { BibleCatalog.book(it) } }
    var expandedActIndex by remember { mutableIntStateOf(currentLocation?.first ?: 0) }
    var query by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    LaunchedEffect(locateRequest, currentLocation) {
        val targetAct = currentLocation?.first ?: return@LaunchedEffect
        expandedActIndex = targetAct
        if (locateRequest > 0) {
            listState.animateScrollToItem(targetAct + 2)
        }
    }

    val allBooks = remember { BibleCatalog.groups.flatMap { it.books } }
    val matchedBooks = remember(query, locale) {
        val q = query.trim().lowercase()
        if (q.isEmpty()) emptyList()
        else allBooks.filter { b ->
            val intro = BibleBookIntroductions.get(b.id).text(locale).lowercase()
            b.name(locale).lowercase().contains(q) ||
                b.name(AppLocale.ZH_CN).lowercase().contains(q) ||
                b.name(AppLocale.EN).lowercase().contains(q) ||
                b.id.lowercase().contains(q) ||
                intro.contains(q)
        }
    }

    val subtitleText = remember(currentBookObj, currentChapter, currentLocation, locale) {
        if (currentBookObj != null && currentLocation != null) {
            val act = BiblePanorama.acts[currentLocation.first]
            val actName = if (locale.isZh) locale.zh(act.zh) else act.en
            val bookName = currentBookObj.name(locale)
            if (locale.isZh) "当前位置：$actName · $bookName 第 $currentChapter 章"
            else "You are here: $actName · $bookName $currentChapter"
        } else {
            AppLocale.pick("六幕救赎历史 · 全本 66 卷脉络", "Six acts of Scripture · All 66 books", locale)
        }
    }

    ParchmentScreenScaffold(theme = theme, listState = listState) {
        item(key = "header") {
            ParchmentPageHeader(
                title = AppLocale.pick("圣经全景", "Bible Panorama", locale),
                subtitle = subtitleText,
                theme = theme,
                trailing = {
                    ParchmentPillButton(
                        label = AppLocale.pick("回经文", "Read", locale),
                        onClick = onReturnReading,
                        theme = theme,
                    )
                },
            )
            Spacer(Modifier.height(12.dp))
        }

        item(key = "search") {
            ParchmentSearchBar(
                value = query,
                onValueChange = { query = it },
                placeholder = AppLocale.pick("检索 66 卷书名或主题…", "Search all 66 books…", locale),
                clearLabel = AppLocale.pick("清除", "Clear", locale),
                theme = theme,
            )
            Spacer(Modifier.height(14.dp))
        }

        if (query.trim().isNotEmpty()) {
            item(key = "search_title") {
                ParchmentSectionHeader(
                    title = AppLocale.pick("匹配书卷", "Matching Books", locale),
                    modifier = Modifier.padding(bottom = 8.dp),
                    theme = theme,
                    trailing = {
                        Text("${matchedBooks.size}", color = muted, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    },
                )
            }
            if (matchedBooks.isEmpty()) {
                item(key = "search_empty") {
                    Text(
                        AppLocale.pick("没有找到匹配的书卷，请换个书名或简称试试。", "No matching books found.", locale),
                        color = muted,
                        fontSize = 14.sp,
                        modifier = Modifier.padding(vertical = 24.dp),
                    )
                }
            } else {
                itemsIndexed(matchedBooks, key = { _, b -> "hit_${b.id}" }) { index, book ->
                    PanoramaBookRow(
                        index = index,
                        book = book,
                        locale = locale,
                        isCurrent = book.id == currentBook,
                        theme = theme,
                        onClick = { onRead(book.id, 1) },
                    )
                    Spacer(Modifier.height(8.dp))
                }
            }
        } else {
            item(key = "acts_heading") {
                ParchmentSectionHeader(
                    title = AppLocale.pick("六幕故事", "Six Acts", locale),
                    modifier = Modifier.padding(bottom = 8.dp),
                    theme = theme,
                    trailing = {
                        Text(AppLocale.pick("点选书卷进入阅读", "Tap a book to read", locale), color = muted, fontSize = 12.5.sp)
                    },
                )
            }

            itemsIndexed(BiblePanorama.acts, key = { idx, act -> "act_${idx}_${act.en}" }) { index, act ->
                val isExpanded = expandedActIndex == index
                val isCurrentAct = currentLocation?.first == index
                val actTitle = if (locale.isZh) locale.zh(act.zh) else act.en
                val actSubtitle = if (locale.isZh) locale.zh(act.subtitleZh) else act.subtitleEn
                val bookCount = remember(act) { act.sections.flatMap { it.spans }.map { it.bookId }.distinct().size }

                ParchmentCard(active = isExpanded || isCurrentAct, theme = theme) {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clickableNoRipple { expandedActIndex = if (isExpanded) -1 else index },
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Text(
                            "%02d".format(index + 1),
                            Modifier.width(26.dp),
                            color = if (isExpanded || isCurrentAct) accent else faint,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        Column(Modifier.weight(1f)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                            ) {
                                Text(actTitle, color = ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                                if (isCurrentAct) {
                                    Text(
                                        AppLocale.pick("当前所在", "Here", locale),
                                        color = accent,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(ParchmentMetrics.PillRadius))
                                            .background(accent.copy(alpha = 0.14f))
                                            .padding(horizontal = 7.dp, vertical = 2.dp),
                                    )
                                }
                            }
                            Text(
                                "$actSubtitle · ${if (locale.isZh) "$bookCount 卷" else "$bookCount books"}",
                                color = muted,
                                fontSize = 13.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.padding(top = 2.dp),
                            )
                        }
                        Text(
                            AppLocale.pick(if (isExpanded) "收起" else "展开", if (isExpanded) "Hide" else "Open", locale),
                            color = if (isExpanded) accent else muted,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier
                                .clip(RoundedCornerShape(ParchmentMetrics.PillRadius))
                                .background(if (isExpanded) accent.copy(alpha = 0.12f) else border.copy(alpha = 0.35f))
                                .padding(horizontal = 10.dp, vertical = 4.dp),
                        )
                    }

                    AnimatedVisibility(visible = isExpanded) {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            act.sections.forEach { section ->
                                val isCurrentSection = currentLocation?.second?.id == section.id
                                val secTitle = if (locale.isZh) locale.zh(section.zh) else section.en
                                val secSummary = if (locale.isZh) locale.zh(section.summaryZh) else section.summaryEn

                                Column(
                                    Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(ParchmentMetrics.SubCardRadius))
                                        .background(theme.canvas.toColor().copy(alpha = if (theme.isDark) 0.38f else 0.48f))
                                        .border(
                                            0.75.dp,
                                            if (isCurrentSection) accent.copy(alpha = 0.5f) else border.copy(alpha = 0.7f),
                                            RoundedCornerShape(ParchmentMetrics.SubCardRadius),
                                        )
                                        .padding(12.dp),
                                ) {
                                    Text(secTitle, color = if (isCurrentSection) accent else ink, fontSize = 14.5.sp, fontWeight = FontWeight.SemiBold)
                                    Text(secSummary, color = muted, fontSize = 12.5.sp, lineHeight = 18.sp, modifier = Modifier.padding(top = 3.dp, bottom = 8.dp))
                                    FlowRow(
                                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                                        verticalArrangement = Arrangement.spacedBy(6.dp),
                                    ) {
                                        section.spans.forEach { span ->
                                            val b = BibleCatalog.book(span.bookId) ?: return@forEach
                                            val isHere = b.id == currentBook && currentChapter in span.first..span.last
                                            val rangeSuffix =
                                                if (span.first == 1 && span.last == b.chapterCount) ""
                                                else if (span.first == span.last) " ${span.first}"
                                                else " ${span.first}–${span.last}"
                                            Text(
                                                "${b.name(locale)}$rangeSuffix",
                                                color = if (isHere) Color(0xFFFFFBF4) else ink,
                                                fontSize = 12.5.sp,
                                                fontWeight = if (isHere) FontWeight.SemiBold else FontWeight.Medium,
                                                modifier = Modifier
                                                    .clip(RoundedCornerShape(ParchmentMetrics.PillRadius))
                                                    .background(if (isHere) accent else surface)
                                                    .border(0.75.dp, if (isHere) accent else border, RoundedCornerShape(ParchmentMetrics.PillRadius))
                                                    .clickableNoRipple { onRead(b.id, span.first) }
                                                    .padding(horizontal = 10.dp, vertical = 5.dp),
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                Spacer(Modifier.height(10.dp))
            }
        }
    }
}

@Composable
private fun PanoramaBookRow(
    index: Int,
    book: BookRef,
    locale: AppLocale,
    isCurrent: Boolean,
    theme: Parchment,
    onClick: () -> Unit,
) {
    val ink = theme.ink.toColor()
    val muted = theme.muted.toColor()
    val faint = theme.faint.toColor()
    val accent = theme.accentOt.toColor()
    val intro = remember(book.id, locale) { BibleBookIntroductions.get(book.id).text(locale) }

    ParchmentCard(
        active = isCurrent,
        theme = theme,
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
        onClick = onClick,
    ) {
        Row(
            Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                "%02d".format(index + 1),
                Modifier.width(26.dp),
                color = if (isCurrent) accent else faint,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
            )
            Column(Modifier.weight(1f)) {
                Text(book.name(locale), color = ink, fontSize = 16.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (intro.isNotEmpty()) {
                    Text(intro, color = muted, fontSize = 12.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 2.dp))
                }
            }
            Text("${book.chapterCount}${if (locale.isZh) " 章" else " ch"}", color = muted, fontSize = 12.sp, fontWeight = FontWeight.Medium)
        }
    }
}
