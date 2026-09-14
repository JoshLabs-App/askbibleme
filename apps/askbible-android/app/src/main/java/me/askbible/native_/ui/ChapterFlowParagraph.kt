package me.askbible.native_.ui

import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.unit.dp
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.draw.drawBehind
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.sp
import me.askbible.native_.data.LoadedVerse
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.VerseHighlightRules
import me.askbible.native_.data.ReadTypographyMetrics
import me.askbible.native_.data.SpeechKind

/** Android 用 em space 作节号与正文的间隔（READ_VERSE_NUM_BODY_GAP） */
private const val NUMBER_GAP = " "
private val AUDIO_ACTIVE = Color(0xFFFFB103)

/**
 * 连排段落：一段里的各节接排成一个文本块（RN 默认 verseParagraphFlow = true）。
 * 点击用 TextLayoutResult.getOffsetForPosition 反查落在哪一节的字符区间；跟读高亮是该节区间的 background span。
 */
@Composable
fun ChapterFlowParagraph(
    verses: List<LoadedVerse>,
    metrics: ReadTypographyMetrics,
    theme: Parchment,
    xrefVerses: Set<Int>,
    activeVerse: Int?,
    /** 已收藏的节：正文铺 verseBookmarkMarker 底（圆角 2），并压过跟读高亮（RN：bookmarked 时不画 audioActive） */
    bookmarked: Set<Int> = emptySet(),
    /** 搜索结果跳进来的那节：verseSearchFocusBg 整行框 */
    searchFocus: Int? = null,
    /** 点节号（有串珠的才亮）→ 经文关联 */
    onTapVerseNumber: (Int) -> Unit = {},
    /** 双击正文 → 收藏 / 取消收藏 */
    onDoubleTapVerse: (Int) -> Unit = {},
    /** 长按正文 → 操作单（复制 / 收藏 / 分享） */
    onLongPressVerse: (Int) -> Unit = {},
    /** 每节在窗口坐标里的 top/bottom（px），滚动 / 排版后都会报：跟读时按「节」把高亮滚到可读区中心 */
    onVerseBounds: ((Map<Int, Pair<Float, Float>>) -> Unit)? = null,
    /** 多节选择态：单击整节都算切换选中，不再只认节号（Josh 2026-09-11） */
    tapWholeVerse: Boolean = false,
    /** 划重点：节号 → （节内字符下标 → 颜色） */
    highlights: Map<Int, Map<Int, String>> = emptyMap(),
    /** 划重点模式：手指划过即上色；null 且 eraseMode 为假 = 不在该模式 */
    paintColor: String? = null,
    eraseMode: Boolean = false,
    /** 划过一段：节号 + 节内字符区间 */
    onPaint: (Int, IntRange) -> Unit = { _, _ -> },
    /** 由 ChapterScreen 统一维护的 dispatch 表；key = 段落首节号，value = 接受根坐标触点的回调 */
    paintDispatch: MutableMap<Int, (Offset) -> Unit>? = null,
) {
    val ranges = ArrayList<Pair<Int, IntRange>>(verses.size)
    val numberRanges = ArrayList<Pair<Int, IntRange>>(verses.size)
    val textRanges = ArrayList<Pair<Int, IntRange>>(verses.size)
    // 对应 displayedParagraphVerseChunk：`${节号}${gap}${正文} `，节号加粗按有无串珠分色，正文按神言 / 人言着色
    val text = buildAnnotatedString {
        for (v in verses) {
            val start = length
            val numColor = if (v.number in xrefVerses) theme.verseNum.toColor() else theme.verseNumMuted.toColor()
            withStyle(SpanStyle(color = numColor, fontSize = metrics.verseNumFontSize.sp, fontWeight = FontWeight.Bold)) {
                append(v.number.toString())
            }
            numberRanges.add(v.number to (start until length))
            append(NUMBER_GAP)
            val textStart = length
            val parts = v.speechParts
            if (parts == null) {
                withStyle(SpanStyle(color = theme.inkSoft.toColor())) { append(v.text) }
            } else {
                for (p in parts) {
                    val c = when (p.kind) {
                        SpeechKind.DIVINE -> theme.divineSpeech.toColor()
                        SpeechKind.HUMAN -> theme.humanSpeech.toColor()
                        SpeechKind.PLAIN -> theme.inkSoft.toColor()
                    }
                    withStyle(SpanStyle(color = c)) { append(p.text) }
                }
            }
            // 跟读高亮由 drawBehind 画圆角整行框（RN verseAudioFollowOverlay，圆角 8），不再给字符区间加 background span
            textRanges.add(v.number to (textStart until length))
            append(" ")
            ranges.add(v.number to (start until length))
        }
    }
    // rememberUpdatedState：pointerInput(text) 的 key 只跟 text 走，不随 callback 重建而重启协程，
    // 不用 `by` 委托——直接保留 State<T> 引用，协程里访问 .value 确保读到最新值
    val currentOnTapVerseNumber = rememberUpdatedState(onTapVerseNumber)
    val currentOnDoubleTapVerse = rememberUpdatedState(onDoubleTapVerse)
    val currentOnLongPressVerse = rememberUpdatedState(onLongPressVerse)
    val currentTapWholeVerse = rememberUpdatedState(tapWholeVerse)
    var layout by remember { mutableStateOf<TextLayoutResult?>(null) }
    var textRootPos by remember { mutableStateOf(Offset.Zero) }
    // 已收藏的节不再画跟读高亮（RN audioActive = !bookmarked && …）
    val activeRange = activeVerse?.takeIf { it !in bookmarked }?.let { a -> ranges.firstOrNull { it.first == a }?.second }
    val focusRange = searchFocus?.let { f -> ranges.firstOrNull { it.first == f }?.second }
    // 收藏高亮盖住整节（含节号与节末空格）：Josh 2026-09-11「标高亮时连节号也一起包含进去，
    // 不会在两句中断开」——原来只铺正文段，节号和两节之间会露白
    val bookmarkRanges = ranges.filter { it.first in bookmarked }.map { it.second }
    val bookmarkFill = theme.verseBookmarkMarker.toColor()
    val focusFill = theme.verseSearchFocusBg.toColor()
    // 划重点：把「节内字符下标 → 颜色」压成连续同色区间，换算到整段文本坐标，少画几次
    val highlightRuns = remember(highlights, textRanges) {
        val out = ArrayList<Pair<IntRange, Color>>()
        for ((verse, byIndex) in highlights) {
            val base = textRanges.firstOrNull { it.first == verse }?.second ?: continue
            // runStart==0 时从节号开头画（含节号），让高亮不在序号处留白
            val verseStart = ranges.firstOrNull { it.first == verse }?.second?.first ?: base.first
            if (byIndex.isEmpty()) continue
            val sorted = byIndex.keys.sorted()
            var runStart = sorted.first(); var prev = sorted.first()
            var color = byIndex[sorted.first()] ?: VerseHighlightRules.DEFAULT_COLOR
            fun flush(end: Int) {
                val from = if (runStart == 0) verseStart else base.first + runStart
                val to = base.first + end
                if (to in base) out.add((from..to) to hexColor(color))
            }
            for (i in sorted.drop(1)) {
                val c = byIndex[i] ?: VerseHighlightRules.DEFAULT_COLOR
                if (i == prev + 1 && c == color) { prev = i; continue }
                flush(prev); runStart = i; prev = i; color = c
            }
            flush(prev)
        }
        out
    }
    /** 触点 → 「哪一节的第几个字」；落在节号或间隔区时等价于正文第 0 个字，避免节号处出现空洞 */
    fun paintAt(pos: Offset) {
        val l = layout ?: return
        val offset = l.getOffsetForPosition(pos)
        val textHit = textRanges.firstOrNull { offset in it.second }
        if (textHit != null) {
            val local = offset - textHit.second.first
            if (local >= 0) onPaint(textHit.first, local..local)
            return
        }
        // 触在节号 / 间隔 → 等价于正文 index 0
        val rangeHit = ranges.firstOrNull { offset in it.second } ?: return
        onPaint(rangeHit.first, 0..0)
    }
    fun verseAt(pos: Offset, list: List<Pair<Int, IntRange>>): Int? {
        val l = layout ?: return null
        val offset = l.getOffsetForPosition(pos)
        return list.firstOrNull { offset in it.second }?.first
    }
    // 向外层 Box 注册本段落的 paint 回调：SideEffect 每次 recompose 后刷新（保持 paintAt / textRootPos 最新），
    // DisposableEffect 在段落离开 composition 时清除，避免悬空引用
    val firstVerse = verses.first().number
    SideEffect {
        paintDispatch?.set(firstVerse) { rootOffset ->
            val l = layout ?: return@set
            val local = rootOffset - textRootPos
            if (local.y < -4f || local.y > l.size.height + 4f) return@set
            paintAt(local)
        }
    }
    DisposableEffect(firstVerse, paintDispatch) {
        onDispose { paintDispatch?.remove(firstVerse) }
    }
    Text(
        text,
        Modifier.fillMaxWidth()
            .onGloballyPositioned { coords ->
                val rootPos = coords.positionInRoot()
                textRootPos = rootPos
                val report = onVerseBounds ?: return@onGloballyPositioned
                val l = layout ?: return@onGloballyPositioned
                val out = HashMap<Int, Pair<Float, Float>>(ranges.size)
                for ((n, r) in ranges) {
                    if (r.isEmpty()) continue
                    out[n] = (rootPos.y + l.getLineTop(l.getLineForOffset(r.first))) to (rootPos.y + l.getLineBottom(l.getLineForOffset(r.last)))
                }
                report(out)
            }
            .drawBehind {
                // 诊断：固定红色矩形，确认 drawBehind 有效
                drawRect(androidx.compose.ui.graphics.Color.Red, topLeft = Offset(0f, 0f), size = androidx.compose.ui.geometry.Size(100f, 40f))
                val l = layout ?: return@drawBehind
                // 圆角 8 整行框：跟读高亮 #FFB103 / 搜索定位 verseSearchFocusBg（RN verseAudioFollowOverlay / verseSearchFocusBg）
                for ((r, fill) in listOf(activeRange to AUDIO_ACTIVE, focusRange to focusFill)) {
                    if (r == null || r.isEmpty()) continue
                    val top = l.getLineTop(l.getLineForOffset(r.first))
                    val bottom = l.getLineBottom(l.getLineForOffset(r.last))
                    drawRoundRect(fill, topLeft = Offset(0f, top), size = Size(size.width, bottom - top), cornerRadius = CornerRadius(8.dp.toPx()))
                }
                // 划重点：逐行铺用户选的颜色，压在正文底下
                for ((r, c) in highlightRuns) {
                    val first = l.getLineForOffset(r.first); val last = l.getLineForOffset(r.last)
                    for (line in first..last) {
                        val left = if (line == first) l.getHorizontalPosition(r.first, true) else l.getLineLeft(line)
                        // r.last+1 可能落在下一行开头（getHorizontalPosition 会返回 0），改用 getLineRight 兜底
                        val right = if (line != last) l.getLineRight(line) else {
                            val lineEnd = l.getLineEnd(line, visibleEnd = false)
                            if (r.last + 1 < lineEnd) l.getHorizontalPosition(r.last + 1, true)
                            else l.getLineRight(line)
                        }
                        if (right <= left) continue
                        drawRoundRect(c.copy(alpha = 0.45f), topLeft = Offset(left, l.getLineTop(line) - 1.dp.toPx()),
                                      size = Size(right - left, l.getLineBottom(line) - l.getLineTop(line) + 2.dp.toPx()),
                                      cornerRadius = CornerRadius(3.dp.toPx()))
                    }
                }
                // 收藏：正文逐行铺 verseBookmarkMarker，圆角 6、四周各撑 2/1（RN verseTextHighlightStyle("bookmark") 圆角 2）
                for (r in bookmarkRanges) {
                    if (r.isEmpty()) continue
                    val first = l.getLineForOffset(r.first); val last = l.getLineForOffset(r.last)
                    for (line in first..last) {
                        val left = if (line == first) l.getHorizontalPosition(r.first, true) else l.getLineLeft(line)
                        val right = if (line == last) l.getHorizontalPosition(r.last + 1, true) else l.getLineRight(line)
                        if (right <= left) continue
                        drawRoundRect(bookmarkFill, topLeft = Offset(left - 2.dp.toPx(), l.getLineTop(line) - 1.dp.toPx()),
                                      size = Size(right - left + 4.dp.toPx(), l.getLineBottom(line) - l.getLineTop(line) + 2.dp.toPx()),
                                      // RN 是圆角 2，真机上看还是方的；Josh 2026-09-09「四角要加弧边」→ 6
                                      cornerRadius = CornerRadius(6.dp.toPx()))
                    }
                }
            }
            .pointerInput(text, paintColor, eraseMode) {
                if (paintColor != null || eraseMode) return@pointerInput
                detectTapGestures(
                    onTap = { pos -> verseAt(pos, if (currentTapWholeVerse.value) ranges else numberRanges)?.let(currentOnTapVerseNumber.value) },
                    onDoubleTap = { pos -> verseAt(pos, ranges)?.let(currentOnDoubleTapVerse.value) },
                    onLongPress = { pos -> verseAt(pos, ranges)?.let(currentOnLongPressVerse.value) },
                )
            },
        fontSize = metrics.verseFontSize.sp,
        lineHeight = metrics.verseLineHeight.sp,
        fontWeight = FontWeight.Medium,
        onTextLayout = { layout = it },
    )
}

/** 「#RRGGBB」→ Compose Color（划重点的调色板是十六进制字符串，和 RN / 网页共用一份） */
fun hexColor(hex: String): Color {
    val raw = hex.trim().removePrefix("#")
    val v = raw.take(6).toLongOrNull(16) ?: 0xFFB103L
    return Color(0xFF000000L or v)
}
