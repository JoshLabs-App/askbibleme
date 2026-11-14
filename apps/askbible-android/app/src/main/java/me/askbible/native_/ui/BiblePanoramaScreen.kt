package me.askbible.native_.ui

import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.askbible.native_.data.*
import kotlinx.coroutines.launch

@Composable
fun BiblePanoramaScreen(
    locale: AppLocale,
    currentBook: String?, currentChapter: Int,
    locateRequest: Int,
    onReturnReading: () -> Unit,
    onRead: (String, Int) -> Unit,
    musicPlaying: Boolean,
    onToggleMusic: () -> Unit,
) {
    val theme = Parchment.light
    val ink = theme.ink.toColor()
    fun t(zh: String, en: String) = AppLocale.pick(zh, en, locale)
    var expandedActs by rememberSaveable { mutableIntStateOf(0) }
    var expandedSections by rememberSaveable { mutableStateOf(listOf<String>()) }
    var expandedBooks by rememberSaveable { mutableStateOf(listOf<String>()) }
    var handledRequest by rememberSaveable { mutableIntStateOf(-1) }
    val list = rememberLazyListState()
    val scope = rememberCoroutineScope()
    val current = currentBook?.let { BiblePanorama.location(it, currentChapter) }
    fun locate() {
        current?.let { (act, section) ->
            expandedActs = expandedActs or (1 shl act)
            expandedSections = (expandedSections + section.id).distinct()
            scope.launch { list.scrollToItem(act + 1) }
        }
    }
    LaunchedEffect(locateRequest) {
        if (locateRequest > 0 && handledRequest != locateRequest) { handledRequest = locateRequest; locate() }
    }
    val gold = Color(0xFFA77832)
    Box(Modifier.fillMaxSize()) {
        ParchmentBackground(theme = theme)
        Column(Modifier.fillMaxSize().statusBarsPadding().padding(bottom = ShellMetrics.tabRowHeight.dp + shellTabBarBottomInset())) {
        if (currentBook != null) Row(Modifier.fillMaxWidth().padding(horizontal = 24.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(t("继续阅读", "Resume reading") + " · ${BibleCatalog.book(currentBook)?.name(locale)} $currentChapter", Modifier.weight(1f).clickable(onClick=onReturnReading).padding(vertical=14.dp),color=ink,fontSize=13.sp)
            Text(t("定位", "Locate"),Modifier.clickable { locate() }.padding(12.dp),color=ink,fontSize=13.sp)
        }
        val contentModifier = Modifier.weight(1f).fillMaxWidth().clipToBounds()
        LazyColumn(contentModifier, state = list, contentPadding = PaddingValues(24.dp, 20.dp, 24.dp, 24.dp)) {
            item {
                Text(t("圣经全景", "Bible panorama"), color = ink, fontSize = 30.sp, fontWeight = FontWeight.Bold)
                Text(t("一个故事，从创造走向新创造。", "One story, from creation to new creation."), color = ink.copy(alpha = .7f), modifier = Modifier.padding(top = 8.dp, bottom = 16.dp))
                if (musicPlaying) Text(t("♫ 暂停音乐", "♫ Pause music"), Modifier.clickable(onClick = onToggleMusic).padding(vertical = 12.dp), color = ink, fontSize = 13.sp)
                Spacer(Modifier.height(12.dp))
            }
            BiblePanorama.acts.forEachIndexed { index, act ->
                val expanded = expandedActs and (1 shl index) != 0
                item(key = "act-$index") {
                    Row(Modifier.fillMaxWidth().drawBehind {
                        if (index < 5) drawLine(gold.copy(alpha=.55f),Offset(14.dp.toPx(),28.dp.toPx()),Offset(14.dp.toPx(),size.height),1.dp.toPx())
                    }, verticalAlignment = Alignment.Top) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Box(Modifier.size(28.dp).clip(CircleShape).background(gold.copy(alpha = .18f)), contentAlignment = Alignment.Center) { Text("${index + 1}", color = ink, fontSize = 13.sp, fontWeight = FontWeight.Bold) }
                        }
                        Column(Modifier.weight(1f).padding(start = 16.dp, bottom = 24.dp).drawBehind {
                            if (expanded) drawLine(gold.copy(alpha=.55f),Offset(-8.dp.toPx(),85.dp.toPx()),Offset(-8.dp.toPx(),size.height),1.dp.toPx())
                        }) {
                            Row(Modifier.fillMaxWidth().clickable {
                                expandedActs = expandedActs xor (1 shl index)
                            }.padding(bottom = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                                PanoramaSketch(index, Modifier.width(66.dp).height(70.dp), gold)
                                Column(Modifier.weight(1f).padding(start = 10.dp)) {
                                    Text(t(act.zh, act.en), color = ink, fontSize = 22.sp, lineHeight = 30.sp, fontWeight = FontWeight.Bold)
                                    Text(t(act.subtitleZh, act.subtitleEn), color = ink.copy(alpha = .7f), fontSize = 14.sp, lineHeight = 22.sp)
                                    if (current?.first == index) Text(t("你正在这里", "You are here"),color=gold,fontSize=12.sp)
                                }
                                Text(if (expanded) "−" else "+", color = ink, fontSize = 24.sp)
                            }
                            if (expanded) act.sections.forEach { s ->
                                val selected = act.sections.size <= 2 || s.id in expandedSections
                                if (act.sections.size > 1) Text((if (current?.second?.id == s.id) "● " else "") + t(s.zh, s.en) + if (act.sections.size <= 2) "" else if (selected) "  −" else "  +",
                                    Modifier.fillMaxWidth().drawBehind {
                                        drawCircle(gold,4.dp.toPx(),Offset(-8.dp.toPx(),34.dp.toPx()))
                                    }.clickable { expandedSections = if (selected) expandedSections - s.id else expandedSections + s.id }.padding(top = 20.dp, bottom = 10.dp), color = ink, fontSize = 18.sp, lineHeight = 26.sp, fontWeight = FontWeight.SemiBold)
                                if (selected) {
                                    Text(t(s.summaryZh, s.summaryEn), color = ink.copy(alpha = .75f), fontSize = 14.sp, lineHeight = 23.sp, modifier = Modifier.padding(bottom = 8.dp))
                                    PanoramaReadingGuide.notes[s.id]?.let { note ->
                                        Text(t("经文脉络", "Scripture in context"), color=ink, fontSize=15.sp, fontWeight=FontWeight.SemiBold, modifier=Modifier.padding(top=12.dp, bottom=6.dp))
                                        Text(t(note.zh, note.en), color=ink.copy(alpha=.85f), fontSize=14.sp, lineHeight=23.sp, modifier=Modifier.padding(bottom=10.dp))
                                        note.links.forEach { link ->
                                            Column(Modifier.fillMaxWidth().padding(bottom=8.dp).clip(RoundedCornerShape(8.dp)).background(gold.copy(alpha=.07f))
                                                .clickable { onRead(link.bookId, link.chapter) }.padding(12.dp)) {
                                                Text(t(link.kindZh,link.kindEn) + " · " + BibleCatalog.book(link.bookId)!!.name(locale) + " " + link.chapter + if(link.verses.isEmpty()) "" else ":${link.verses}", color=ink, fontSize=14.sp, fontWeight=FontWeight.SemiBold)
                                                Text(t(link.reasonZh,link.reasonEn),color=ink.copy(alpha=.8f),fontSize=13.sp,lineHeight=21.sp,modifier=Modifier.padding(top=5.dp))
                                                Text(t("阅读所在章 ›", "Read this chapter ›"),color=ink,fontSize=12.sp,modifier=Modifier.padding(top=8.dp))
                                            }
                                        }
                                    }
                                }
                                s.spans.forEach { entry ->
                                    val key = "${s.id}:${entry.bookId}:${entry.first}"
                                    PanoramaInlineBook(entry, s, locale, currentBook, currentChapter, key in expandedBooks,
                                        onToggle = { expandedBooks = if (key in expandedBooks) expandedBooks - key else expandedBooks + key },
                                        onRead = onRead)
                                }
                            }
                        }
                    }
                }
            }
            item { Text(t("六幕是阅读导览，不是圣经原有的分卷。书卷可跨越多个故事路段；诗歌、智慧与先知书按处境和主题连接。", "The six acts are a reading guide, not the Bible's own divisions. Books can span several parts of the story; poetry, wisdom, and prophecy connect through context and themes."), color = ink.copy(alpha = .6f), fontSize = 12.sp, lineHeight = 20.sp) }
        }
        }
    }
}

@Composable
private fun PanoramaInlineBook(
    entry: PanoramaSpan, section: PanoramaSection, locale: AppLocale,
    currentBook: String?, currentChapter: Int, expanded: Boolean,
    onToggle: () -> Unit, onRead: (String, Int) -> Unit,
) {
    val ink = Parchment.light.ink.toColor()
    val gold = Color(0xFFA77832)
    val book = BibleCatalog.book(entry.bookId)!!
    val intro = BibleBookIntroductions.get(book.id)
    val isCurrent = currentBook == book.id && currentChapter in entry.first..entry.last
    fun t(zh: String, en: String) = AppLocale.pick(zh, en, locale)
    Column(Modifier.fillMaxWidth().padding(vertical=5.dp).clip(RoundedCornerShape(10.dp))
        .background(if(isCurrent) gold.copy(alpha=.12f) else Color.White.copy(alpha=.22f))
        .border(1.dp, if(isCurrent) gold else gold.copy(alpha=.4f), RoundedCornerShape(10.dp))) {
        Row(Modifier.fillMaxWidth().clickable(onClick=onToggle).padding(14.dp), verticalAlignment=Alignment.CenterVertically) {
            PanoramaBookGlyph(Modifier.width(30.dp).height(44.dp), ink)
            Column(Modifier.weight(1f).padding(horizontal=12.dp)) {
                if(isCurrent) Text(t("你正在这里 · 第${currentChapter}章", "You are here · Chapter $currentChapter"),color=gold,fontSize=12.sp)
                Text(book.name(locale),color=ink,fontSize=18.sp,lineHeight=26.sp,fontWeight=FontWeight.Bold)
                Text(intro.text(locale),color=ink.copy(alpha=.85f),fontSize=13.sp,lineHeight=21.sp,modifier=Modifier.padding(top=5.dp,bottom=7.dp))
                Text(if(entry.first==1 && entry.last==book.chapterCount) t("圣经书卷 · ${book.chapterCount}章", "Bible book · ${book.chapterCount} chapters") else t("圣经书卷 · 第${entry.first}—${entry.last}章", "Bible book · chapters ${entry.first}–${entry.last}"),color=ink.copy(alpha=.65f),fontSize=11.sp)
            }
            Text(if(expanded) "−" else "+",color=ink,fontSize=24.sp)
        }
        if(expanded) Column(Modifier.fillMaxWidth().padding(start=14.dp,end=14.dp,bottom=14.dp)) {
            Text(t("在全经中的位置 · ", "In the story · ") + t(section.zh,section.en),color=ink,fontSize=15.sp,fontWeight=FontWeight.SemiBold,modifier=Modifier.padding(top=8.dp,bottom=8.dp))
            Text(t(section.summaryZh,section.summaryEn),color=ink,fontSize=14.sp,lineHeight=23.sp)
            Text(t("阅读线索：", "Reading pointers: ")+intro.references,color=ink.copy(alpha=.7f),fontSize=12.sp,modifier=Modifier.padding(top=10.dp))
            Text(t("选择章节", "Choose a chapter"),color=ink,fontSize=15.sp,fontWeight=FontWeight.SemiBold,modifier=Modifier.padding(top=18.dp,bottom=8.dp))
            BoxWithConstraints {
                val columns = (maxWidth.value / (52f * androidx.compose.ui.platform.LocalDensity.current.fontScale)).toInt().coerceIn(2,5)
                Column {
                    (entry.first..entry.last).toList().chunked(columns).forEach { chapters ->
                        Row(Modifier.fillMaxWidth()) {
                            chapters.forEach { chapter ->
                                Box(Modifier.weight(1f).heightIn(min=48.dp).clickable { onRead(book.id,chapter) }.padding(vertical=10.dp),contentAlignment=Alignment.Center) {
                                    Text(chapter.toString(),color=ink,fontSize=18.sp)
                                }
                            }
                            repeat(columns-chapters.size) { Spacer(Modifier.weight(1f)) }
                        }
                    }
                }
            }
            Text(t("收起详情", "Collapse details"),Modifier.fillMaxWidth().clickable(onClick=onToggle).padding(vertical=12.dp),color=ink,fontSize=13.sp)
        }
    }
}
