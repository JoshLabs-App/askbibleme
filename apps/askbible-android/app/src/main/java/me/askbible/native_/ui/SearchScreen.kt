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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.ScriptureTranslation
import me.askbible.native_.data.ChapterLoader
import me.askbible.native_.data.name
import me.askbible.native_.data.BibleCatalog
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.ReadSize
import me.askbible.native_.data.ScriptureDatabase
import me.askbible.native_.data.ScriptureSearchHit
import me.askbible.native_.data.ScriptureSearchRules
import me.askbible.native_.data.ScriptureSearchScope
import me.askbible.native_.data.SearchChapterRef
import me.askbible.native_.data.SearchPrefs

/**
 * 经文搜索页。对应 RN ReadScriptureSearchScreen，与 iOS 的 SearchView 对等：标题 / 引导语 / 范围分段（全本 · 旧约 · 新约 · 本章）/
 * 输入框 / 最近搜索 chips / 命中列表（书名 章:节 + 经文，关键词高亮）。输入停顿 360ms 后查库；字号随阅读档位。
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SearchScreen(
    prefs: SearchPrefs,
    translationId: String,
    size: ReadSize,
    chapterRef: SearchChapterRef?,
    onBack: () -> Unit,
    onOpenHit: (ScriptureSearchHit) -> Unit,
    theme: Parchment = Parchment.light,
    /** 命中条目的书名按读经展示语言 */
    locale: AppLocale = AppLocale.ZH_CN,
) {
    val context = LocalContext.current
    val scale = (size.metrics.verseFontSize / 16f).coerceIn(0.85f, 2.8f)
    fun sx(n: Float) = maxOf(1f, Math.round(n * scale * 10f) / 10f)
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<ScriptureSearchHit>>(emptyList()) }
    var searched by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(false) }
    // 在线译本没有本机库：改用同语言内置译本搜，并说明
    var fallbackNote by remember { mutableStateOf<String?>(null) }
    val focus = remember { FocusRequester() }
    val insets = WindowInsets.systemBars.asPaddingValues()

    fun run(raw: String) {
        val q = ScriptureSearchRules.normalize(raw)
        if (q.isEmpty()) { results = emptyList(); searched = false; return }
        if (prefs.scope == ScriptureSearchScope.CHAPTER && chapterRef == null) { results = emptyList(); searched = true; return }
        loading = true
        val fallbackId = ChapterLoader.searchFallbackId(context, translationId)
        fallbackNote = fallbackId?.let { ScriptureTranslation.find(it) }?.let { "当前译本是在线译本，暂不支持搜索；已改用「${it.label(locale)}」搜索" }
        results = ScriptureDatabase.open(context, fallbackId ?: translationId)?.let { db -> try { db.search(q, prefs.scope, chapterRef) } finally { db.close() } } ?: emptyList()
        searched = true
        loading = false
        prefs.push(q)
    }
    LaunchedEffect(query, prefs.scope) {
        if (query.trim().isEmpty()) { results = emptyList(); searched = false; return@LaunchedEffect }
        delay(360)
        run(query)
    }
    LaunchedEffect(Unit) { focus.requestFocus() }

    Box(Modifier.fillMaxSize()) {
        ParchmentBackground(theme = theme)
        LazyColumn(
            Modifier.fillMaxSize().parchmentFade(ParchmentFadePreset.TABBAR),
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 20.dp + insets.calculateTopPadding(),
                                           bottom = TAB_BAR_CLEARANCE.dp + 28.dp + insets.calculateBottomPadding() + 120.dp),
        ) {
            item {
                Box(Modifier.size(44.dp).clickableNoRipple(onBack), contentAlignment = Alignment.CenterStart) {
                    MaterialIcon(MI.ARROW_BACK, 24f, theme.ink.toColor())
                }
                Text("经文搜索", Modifier.fillMaxWidth().padding(bottom = 8.dp), color = theme.ink.toColor(), fontSize = sx(24f).sp,
                     fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
                Text("在当前译本中按关键词查找经文。", Modifier.fillMaxWidth().padding(bottom = 12.dp), color = theme.muted.toColor(),
                     fontSize = sx(16f).sp, lineHeight = sx(24f).sp, textAlign = TextAlign.Center)

                // 范围分段：surface 底、hairline 边、圆角 10、内边 3、间隔 2；选中 ink 底 surface 字
                Box(Modifier.fillMaxWidth().padding(bottom = 14.dp), contentAlignment = Alignment.Center) {
                    Row(Modifier.background(theme.surface.toColor(), RoundedCornerShape(10.dp))
                            .border(0.5.dp, theme.border.toColor(), RoundedCornerShape(10.dp)).padding(3.dp),
                        horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                        for ((scope, label) in listOf(ScriptureSearchScope.ALL to "全本", ScriptureSearchScope.OLD to "旧约",
                                                      ScriptureSearchScope.NEW to "新约", ScriptureSearchScope.CHAPTER to "本章")) {
                            val on = prefs.scope == scope
                            Text(label, Modifier.background(if (on) theme.ink.toColor() else Color.Transparent, RoundedCornerShape(8.dp))
                                    .clickableNoRipple { prefs.updateScope(scope) }
                                    .padding(horizontal = sx(12f).dp, vertical = sx(8f).dp),
                                 color = if (on) theme.surface.toColor() else theme.muted.toColor(), fontSize = sx(15f).sp, fontWeight = FontWeight.Medium)
                        }
                    }
                }

                BasicTextField(
                    value = query, onValueChange = { query = it },
                    modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)
                        .background(theme.surface.toColor(), RoundedCornerShape(10.dp))
                        .border(0.5.dp, theme.border.toColor(), RoundedCornerShape(10.dp))
                        .padding(horizontal = 14.dp, vertical = 12.dp).focusRequester(focus),
                    textStyle = TextStyle(color = theme.ink.toColor(), fontSize = size.metrics.verseFontSize.sp),
                    singleLine = true,
                    cursorBrush = SolidColor(theme.ink.toColor()),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search, autoCorrect = false),
                    keyboardActions = KeyboardActions(onSearch = { run(query) }),
                    decorationBox = { inner ->
                        if (query.isEmpty()) Text("输入关键词", color = theme.faint.toColor(), fontSize = size.metrics.verseFontSize.sp)
                        inner()
                    },
                )

                if (prefs.recent.isNotEmpty()) {
                    Text("最近搜索", Modifier.padding(top = 2.dp, bottom = 6.dp), color = theme.muted.toColor(), fontSize = sx(14f).sp, fontWeight = FontWeight.Medium)
                    FlowRow(Modifier.fillMaxWidth().padding(bottom = 2.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        for (term in prefs.recent) {
                            Text(term, Modifier.background(theme.surface.toColor(), CircleShape).border(0.5.dp, theme.border.toColor(), CircleShape)
                                    .clickableNoRipple { query = term; run(term) }
                                    .padding(horizontal = sx(12f).dp, vertical = sx(7f).dp),
                                 color = theme.ink.toColor(), fontSize = sx(15f).sp, fontWeight = FontWeight.Medium)
                        }
                    }
                }
                fallbackNote?.let { note ->
                    Text(note, Modifier.fillMaxWidth().padding(bottom = 8.dp), color = theme.faint.toColor(), fontSize = sx(13f).sp, textAlign = TextAlign.Center)
                }
                if (prefs.scope == ScriptureSearchScope.CHAPTER && chapterRef == null) {
                    Text("暂无当前章节，请先打开一章后再搜索本章。", Modifier.fillMaxWidth().padding(bottom = 8.dp), color = theme.faint.toColor(),
                         fontSize = sx(14f).sp, textAlign = TextAlign.Center)
                }
                if (loading) Box(Modifier.fillMaxWidth().padding(vertical = 20.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = theme.muted.toColor(), strokeWidth = 2.dp, modifier = Modifier.size(24.dp))
                }
                if (!loading && searched && results.isEmpty() && !(prefs.scope == ScriptureSearchScope.CHAPTER && chapterRef == null)) {
                    Text("没有找到匹配的经文", Modifier.fillMaxWidth().padding(top = 24.dp), color = theme.muted.toColor(),
                         fontSize = sx(16f).sp, lineHeight = sx(24f).sp, textAlign = TextAlign.Center)
                }
            }
            items(results, key = { "${it.bookId}:${it.chapter}:${it.verse}" }) { hit ->
                Column(Modifier.fillMaxWidth().clickableNoRipple { onOpenHit(hit) }) {
                    Box(Modifier.fillMaxWidth().height(0.5.dp).background(theme.border.toColor()))
                    Spacer(Modifier.height(sx(12f).dp))
                    Text("${BibleCatalog.book(hit.bookId)?.name(locale) ?: hit.bookName} ${hit.chapter}:${hit.verse}", color = theme.faint.toColor(), fontSize = size.metrics.verseNumFontSize.sp,
                         fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 3.dp))
                    // 命中经文：关键词段 ink 字 700；其余 verse 字号 500 正文色。
                    // 关键词底色不走 span background（方角），而是 drawBehind 逐行画圆角 4 的 verseBookmarkMarker 框（Josh：高亮也要弧形）
                    val matchRanges = ArrayList<IntRange>()
                    val annotated = buildAnnotatedString {
                        for (seg in ScriptureSearchRules.split(hit.text, query)) {
                            if (seg.match) {
                                val start = length
                                withStyle(SpanStyle(color = theme.ink.toColor(), fontWeight = FontWeight.Bold)) { append(seg.text) }
                                if (length > start) matchRanges.add(start until length)
                            } else append(seg.text)
                        }
                    }
                    var layout by remember { mutableStateOf<TextLayoutResult?>(null) }
                    val markerFill = theme.verseBookmarkMarker.toColor()
                    Text(annotated, modifier = Modifier.drawBehind {
                        val l = layout ?: return@drawBehind
                        // 截到 4 行时，被省略号吃掉的那段不画
                        val visibleEnd = l.getLineEnd(l.lineCount - 1, visibleEnd = true)
                        for (r in matchRanges) {
                            val s = r.first
                            val e = minOf(r.last + 1, visibleEnd)
                            if (s >= e) continue
                            val first = l.getLineForOffset(s)
                            val last = l.getLineForOffset(e - 1)
                            for (line in first..last) {
                                val left = if (line == first) l.getHorizontalPosition(s, true) else l.getLineLeft(line)
                                val right = if (line == last) l.getHorizontalPosition(e, true) else l.getLineRight(line)
                                if (right <= left) continue
                                drawRoundRect(markerFill, topLeft = Offset(left - 1.dp.toPx(), l.getLineTop(line)),
                                              size = Size(right - left + 2.dp.toPx(), l.getLineBottom(line) - l.getLineTop(line)),
                                              cornerRadius = CornerRadius(4.dp.toPx()))
                            }
                        }
                    }, color = theme.inkSoft.toColor(), fontSize = size.metrics.verseFontSize.sp, lineHeight = size.metrics.verseLineHeight.sp,
                       fontWeight = FontWeight.Medium, maxLines = 4, overflow = TextOverflow.Ellipsis, onTextLayout = { layout = it })
                    Spacer(Modifier.height(sx(12f).dp))
                }
            }
        }
    }
}
