package me.askbible.native_.ui

import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
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
    var layout by remember { mutableStateOf<TextLayoutResult?>(null) }
    // 已收藏的节不再画跟读高亮（RN audioActive = !bookmarked && …）
    val activeRange = activeVerse?.takeIf { it !in bookmarked }?.let { a -> ranges.firstOrNull { it.first == a }?.second }
    val focusRange = searchFocus?.let { f -> ranges.firstOrNull { it.first == f }?.second }
    // 收藏高亮盖住整节（含节号与节末空格）：Josh 2026-09-11「标高亮时连节号也一起包含进去，
    // 不会在两句中断开」——原来只铺正文段，节号和两节之间会露白
    val bookmarkRanges = ranges.filter { it.first in bookmarked }.map { it.second }
    val bookmarkFill = theme.verseBookmarkMarker.toColor()
    val focusFill = theme.verseSearchFocusBg.toColor()
    fun verseAt(pos: Offset, list: List<Pair<Int, IntRange>>): Int? {
        val l = layout ?: return null
        val offset = l.getOffsetForPosition(pos)
        return list.firstOrNull { offset in it.second }?.first
    }
    Text(
        text,
        Modifier.fillMaxWidth()
            .onGloballyPositioned { coords ->
                val report = onVerseBounds ?: return@onGloballyPositioned
                val l = layout ?: return@onGloballyPositioned
                val rootY = coords.positionInRoot().y
                val out = HashMap<Int, Pair<Float, Float>>(ranges.size)
                for ((n, r) in ranges) {
                    if (r.isEmpty()) continue
                    out[n] = (rootY + l.getLineTop(l.getLineForOffset(r.first))) to (rootY + l.getLineBottom(l.getLineForOffset(r.last)))
                }
                report(out)
            }
            .drawBehind {
                val l = layout ?: return@drawBehind
                // 圆角 8 整行框：跟读高亮 #FFB103 / 搜索定位 verseSearchFocusBg（RN verseAudioFollowOverlay / verseSearchFocusBg）
                for ((r, fill) in listOf(activeRange to AUDIO_ACTIVE, focusRange to focusFill)) {
                    if (r == null || r.isEmpty()) continue
                    val top = l.getLineTop(l.getLineForOffset(r.first))
                    val bottom = l.getLineBottom(l.getLineForOffset(r.last))
                    drawRoundRect(fill, topLeft = Offset(0f, top), size = Size(size.width, bottom - top), cornerRadius = CornerRadius(8.dp.toPx()))
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
            .pointerInput(text) {
                detectTapGestures(
                    onTap = { pos -> verseAt(pos, if (tapWholeVerse) ranges else numberRanges)?.let(onTapVerseNumber) },
                    onDoubleTap = { pos -> verseAt(pos, ranges)?.let(onDoubleTapVerse) },
                    onLongPress = { pos -> verseAt(pos, ranges)?.let(onLongPressVerse) },
                )
            },
        fontSize = metrics.verseFontSize.sp,
        lineHeight = metrics.verseLineHeight.sp,
        fontWeight = FontWeight.Medium,
        onTextLayout = { layout = it },
    )
}
