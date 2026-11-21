package me.askbible.native_.ui

import me.askbible.native_.data.SiteCopy
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.ui.layout.layout
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
import me.askbible.native_.data.ParsedScriptureRef
import me.askbible.native_.data.ScriptureDatabase
import me.askbible.native_.data.ScriptureReferenceParser
import me.askbible.native_.data.ScriptureSearchHit
import me.askbible.native_.data.ScriptureSearchResult
import me.askbible.native_.data.ScriptureSearchRules
import me.askbible.native_.data.ScriptureSearchScope
import me.askbible.native_.data.SearchChapterRef
import me.askbible.native_.data.SearchPrefs

/**
 * 经文搜索页。对应 RN ReadScriptureSearchScreen，与 iOS 的 SearchView 对等：标题 / 引导语 / 范围分段（全本 · 旧约 · 新约 · 本章）/
 * 输入框 / 最近搜索 chips / 命中列表（书名 章:节 + 经文，关键词高亮）。输入停顿 360ms 后查库；字号随阅读档位。
 */
@Composable
fun SearchScreen(
    prefs: SearchPrefs,
    translationId: String,
    size: ReadSize,
    chapterRef: SearchChapterRef?,
    onBack: () -> Unit,
    /** 点了哪条命中 + 当时的关键词（章页只标关键词） */
    onOpenHit: (ScriptureSearchHit, String) -> Unit,
    theme: Parchment = Parchment.light,
    /** 命中条目的书名按读经展示语言 */
    locale: AppLocale = AppLocale.ZH_CN,
) {
    val context = LocalContext.current
    val scale = (size.metrics.verseFontSize / 16f).coerceIn(0.85f, 2.8f)
    fun sx(n: Float) = maxOf(1f, Math.round(n * scale * 10f) / 10f)
    // 从命中的章页返回：恢复关键词和结果，不弹键盘（挡结果）
    val resumed = remember { prefs.resumeQuery.also { prefs.resumeQuery = null } }
    var query by remember { mutableStateOf(resumed ?: "") }
    var results by remember { mutableStateOf<List<ScriptureSearchHit>>(emptyList()) }
    var total by remember { mutableStateOf(0) }
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
        fallbackNote = fallbackId?.let { ScriptureTranslation.find(it) }?.let { SiteCopy.f("native.searchFallbackNote", mapOf("name" to it.label(locale)), locale) }
        val found = ScriptureDatabase.open(context, fallbackId ?: translationId)?.let { db -> try { db.search(q, prefs.scope, chapterRef) } finally { db.close() } } ?: ScriptureSearchResult.EMPTY
        results = found.hits
        total = found.total
        searched = true
        loading = false
        // 不在这里记最近搜索：边输边搜会把 A、AB、ABC… 每个半截词都存下来（Josh 2026-09-26）。点进经文才记
    }
    LaunchedEffect(query, prefs.scope) {
        if (query.trim().isEmpty()) { results = emptyList(); searched = false; return@LaunchedEffect }
        delay(360)
        run(query)
    }
    LaunchedEffect(Unit) { if (resumed != null) run(resumed) else focus.requestFocus() }

    val parsedJump: ParsedScriptureRef? = remember(query) { ScriptureReferenceParser.parse(query) }
    val jumpPreviewText: String = remember(parsedJump, translationId) {
        val j = parsedJump ?: return@remember ""
        val fallbackId = ChapterLoader.searchFallbackId(context, translationId) ?: translationId
        ScriptureDatabase.open(context, fallbackId)?.let { db ->
            try {
                val rows = db.loadChapter(j.book.id, j.chapter)
                val target = j.verse ?: 1
                rows.firstOrNull { it.number == target }?.text ?: rows.firstOrNull()?.text.orEmpty()
            } finally { db.close() }
        }.orEmpty()
    }

    Box(Modifier.fillMaxSize()) {
        ParchmentBackground(theme = theme)
        LazyColumn(
            Modifier.fillMaxSize().parchmentFade(ParchmentFadePreset.TABBAR),
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 14.dp + insets.calculateTopPadding(),
                                           bottom = TAB_BAR_CLEARANCE.dp + 28.dp + insets.calculateBottomPadding() + 110.dp),
        ) {
            item {
                // 置顶返回键 + 搜索输入框（带 × 一键清空，对齐 iOS SearchView）
                Row(
                    Modifier.fillMaxWidth().padding(bottom = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Box(Modifier.size(38.dp).clickableNoRipple(onBack), contentAlignment = Alignment.CenterStart) {
                        MaterialIcon(MI.CHEVRON_LEFT, 26f, theme.ink.toColor())
                    }
                    Row(
                        Modifier
                            .weight(1f)
                            .height(44.dp)
                            .background(theme.surface.toColor(), RoundedCornerShape(12.dp))
                            .border(1.dp, theme.borderStrong.toColor(), RoundedCornerShape(12.dp))
                            .padding(horizontal = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        MaterialIcon(MI.SEARCH, 18f, theme.muted.toColor())
                        BasicTextField(
                            value = query, onValueChange = { query = it },
                            modifier = Modifier.weight(1f).focusRequester(focus),
                            textStyle = TextStyle(color = theme.ink.toColor(), fontSize = 16.sp),
                            singleLine = true,
                            cursorBrush = SolidColor(theme.ink.toColor()),
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search, autoCorrect = false),
                            keyboardActions = KeyboardActions(onSearch = {
                                parsedJump?.let { j ->
                                    val q = ScriptureSearchRules.normalize(query)
                                    prefs.push(q)
                                    onOpenHit(ScriptureSearchHit(j.book.id, j.book.name(locale), j.chapter, j.verse ?: 1, jumpPreviewText), "")
                                } ?: run(query)
                            }),
                            decorationBox = { inner ->
                                if (query.isEmpty()) {
                                    Text(
                                        AppLocale.pick("搜索经文，或输入如 约 3:16 直达…", "Search text or jump e.g. John 3:16…", locale),
                                        color = theme.faint.toColor(),
                                        fontSize = 14.5.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                }
                                inner()
                            },
                        )
                        if (query.isNotEmpty()) {
                            Box(
                                Modifier
                                    .size(22.dp)
                                    .background(theme.faint.toColor().copy(alpha = 0.25f), CircleShape)
                                    .clickableNoRipple { query = ""; results = emptyList(); searched = false; focus.requestFocus() },
                                contentAlignment = Alignment.Center,
                            ) {
                                MaterialIcon(MI.CLOSE, 13f, theme.surface.toColor())
                            }
                        }
                    }
                }

                // 范围分段：全本 · 旧约 · 新约 · 本章
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(bottom = 14.dp)
                        .background(theme.ink.toColor().copy(alpha = 0.06f), RoundedCornerShape(11.dp))
                        .padding(3.dp),
                    horizontalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    for ((scope, label) in listOf(
                        ScriptureSearchScope.ALL to SiteCopy.t("pages.read.scriptureSearchScopeAll", locale),
                        ScriptureSearchScope.OLD to SiteCopy.t("pages.read.scriptureSearchScopeOld", locale),
                        ScriptureSearchScope.NEW to SiteCopy.t("pages.read.scriptureSearchScopeNew", locale),
                        ScriptureSearchScope.CHAPTER to SiteCopy.t("pages.read.scriptureSearchScopeChapter", locale),
                    )) {
                        val on = prefs.scope == scope
                        Box(
                            Modifier
                                .weight(1f)
                                .background(if (on) theme.surface.toColor() else Color.Transparent, RoundedCornerShape(8.dp))
                                .clickableNoRipple { prefs.updateScope(scope) }
                                .padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(label, color = if (on) theme.ink.toColor() else theme.muted.toColor(), fontSize = 13.5.sp, fontWeight = if (on) FontWeight.SemiBold else FontWeight.Medium)
                        }
                    }
                }

                // 置顶：书卷章节智能直达卡（如输入「约 3:16」「诗 23」）
                parsedJump?.let { j ->
                    val accent = theme.accentOt.toColor()
                    val title = if (j.verse != null) {
                        AppLocale.pick("${j.book.name(locale)} 第 ${j.chapter} 章 ${j.verse} 节", "${j.book.name(locale)} ${j.chapter}:${j.verse}", locale)
                    } else {
                        AppLocale.pick("${j.book.name(locale)} 第 ${j.chapter} 章", "${j.book.name(locale)} ${j.chapter}", locale)
                    }
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .padding(bottom = 14.dp)
                            .background(accent.copy(alpha = 0.12f), RoundedCornerShape(16.dp))
                            .border(1.dp, accent.copy(alpha = 0.42f), RoundedCornerShape(16.dp))
                            .clickableNoRipple {
                                val q = ScriptureSearchRules.normalize(query)
                                prefs.push(q)
                                onOpenHit(ScriptureSearchHit(j.book.id, j.book.name(locale), j.chapter, j.verse ?: 1, jumpPreviewText), "")
                            }
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Row(
                                Modifier
                                    .background(accent, CircleShape)
                                    .padding(horizontal = 9.dp, vertical = 3.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp),
                            ) {
                                MaterialIcon(MI.MENU_BOOK, 12f, Color(0xFFFFFBF4))
                                Text(AppLocale.pick("书卷章节直达", "Direct Jump", locale), color = Color(0xFFFFFBF4), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                            }
                            Text(title, color = theme.ink.toColor(), fontSize = 17.sp, fontWeight = FontWeight.Bold)
                            if (jumpPreviewText.isNotEmpty()) {
                                Text(jumpPreviewText, color = theme.muted.toColor(), fontSize = 13.5.sp, lineHeight = 20.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            }
                        }
                        MaterialIcon(MI.CHEVRON_RIGHT, 20f, accent)
                    }
                }

                if (prefs.recent.isNotEmpty() && query.isEmpty()) {
                    Text(SiteCopy.t("pages.read.scriptureSearchRecentTitle", locale), Modifier.padding(top = 2.dp, bottom = 6.dp), color = theme.muted.toColor(), fontSize = sx(14f).sp, fontWeight = FontWeight.Medium)
                    // 一行，左右滑，不换行挡住下面的结果；出血到屏幕边，首尾留 20 和正文对齐
                    LazyRow(Modifier.fillMaxWidth().layout { measurable, constraints ->
                                val extra = 40.dp.roundToPx()
                                val p = measurable.measure(constraints.copy(maxWidth = constraints.maxWidth + extra, minWidth = constraints.minWidth + extra))
                                layout(constraints.maxWidth, p.height) { p.place(-extra / 2, 0) }
                            }.padding(bottom = 10.dp),
                            contentPadding = PaddingValues(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(prefs.recent, key = { it }) { term ->
                            Text(term, Modifier.background(theme.surface.toColor(), CircleShape).border(0.5.dp, theme.border.toColor(), CircleShape)
                                    .clickableNoRipple { query = term; run(term) }
                                    .padding(horizontal = sx(12f).dp, vertical = sx(7f).dp),
                                 color = theme.ink.toColor(), fontSize = sx(15f).sp, fontWeight = FontWeight.Medium, maxLines = 1)
                        }
                    }
                }
                fallbackNote?.let { note ->
                    Text(note, Modifier.fillMaxWidth().padding(bottom = 8.dp), color = theme.faint.toColor(), fontSize = sx(13f).sp, textAlign = TextAlign.Center)
                }
                if (prefs.scope == ScriptureSearchScope.CHAPTER && chapterRef == null) {
                    Text(SiteCopy.t("pages.read.scriptureSearchNoChapterHint", locale), Modifier.fillMaxWidth().padding(bottom = 8.dp), color = theme.faint.toColor(),
                         fontSize = sx(14f).sp, textAlign = TextAlign.Center)
                }
                if (loading) Box(Modifier.fillMaxWidth().padding(vertical = 20.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = theme.muted.toColor(), strokeWidth = 2.dp, modifier = Modifier.size(24.dp))
                }
                if (!loading && searched && results.isEmpty() && parsedJump == null && !(prefs.scope == ScriptureSearchScope.CHAPTER && chapterRef == null)) {
                    Text(SiteCopy.t("pages.read.scriptureSearchEmpty", locale), Modifier.fillMaxWidth().padding(top = 24.dp), color = theme.muted.toColor(),
                         fontSize = sx(16f).sp, lineHeight = sx(24f).sp, textAlign = TextAlign.Center)
                }
                if (!loading && results.isNotEmpty()) {
                    // 共 N 处；超过上限再补一句「只显示前 500 条」（D-30）
                    Column(Modifier.padding(bottom = 8.dp)) {
                        Text(SiteCopy.f("pages.read.scriptureSearchCount", mapOf("count" to "$total"), locale), color = theme.faint.toColor(), fontSize = sx(13f).sp)
                        if (total > results.size) Text(SiteCopy.f("pages.read.scriptureSearchTruncated", mapOf("limit" to "${results.size}"), locale), color = theme.faint.toColor(), fontSize = sx(13f).sp)
                    }
                }
            }
            items(results, key = { "${it.bookId}:${it.chapter}:${it.verse}" }) { hit ->
                Column(Modifier.fillMaxWidth().clickableNoRipple {
                    // 点进经文才算一次真正的搜索，这时才记进最近搜索
                    val q = ScriptureSearchRules.normalize(query)
                    prefs.push(q)
                    onOpenHit(hit, q)
                }) {
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
