package me.askbible.native_.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.withLink
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.ReadSize

/**
 * 文章正文用到的 Markdown 子集（与 RN ReadChapterInfoEditionMarkdown 渲染的那套一致）：
 * 段落 / ## ### #### 标题 / 无序与有序列表 / 引用 / 分隔线 / 表格，行内粗体与链接。与 iOS 的 MarkdownParser 对等。
 */
sealed class MarkdownBlock {
    data class Heading(val level: Int, val text: String) : MarkdownBlock()
    data class Paragraph(val text: String) : MarkdownBlock()
    data class Bullets(val items: List<String>) : MarkdownBlock()
    data class Ordered(val items: List<String>) : MarkdownBlock()
    data class Quote(val text: String) : MarkdownBlock()
    object Rule : MarkdownBlock()
    data class Table(val rows: List<List<String>>) : MarkdownBlock()
}

object MarkdownParser {
    private val ORDERED = Regex("^(\\d+)\\. (.*)$")

    fun parse(markdown: String): List<MarkdownBlock> {
        val blocks = ArrayList<MarkdownBlock>()
        val para = ArrayList<String>(); val bullets = ArrayList<String>(); val ordered = ArrayList<String>()
        val quote = ArrayList<String>(); val table = ArrayList<List<String>>()
        fun flush() {
            if (para.isNotEmpty()) { blocks.add(MarkdownBlock.Paragraph(para.joinToString("\n"))); para.clear() }
            if (bullets.isNotEmpty()) { blocks.add(MarkdownBlock.Bullets(bullets.toList())); bullets.clear() }
            if (ordered.isNotEmpty()) { blocks.add(MarkdownBlock.Ordered(ordered.toList())); ordered.clear() }
            if (quote.isNotEmpty()) { blocks.add(MarkdownBlock.Quote(quote.joinToString("\n"))); quote.clear() }
            if (table.isNotEmpty()) { blocks.add(MarkdownBlock.Table(table.toList())); table.clear() }
        }
        fun flushOthers(keep: MutableList<*>) {
            for (l in listOf(para, bullets, ordered, quote, table)) if (l !== keep && l.isNotEmpty()) { flush(); return }
        }
        for (raw in markdown.replace("\r\n", "\n").split("\n")) {
            val line = raw.trim()
            if (line.isEmpty()) { flush(); continue }
            if (line.startsWith("#")) {
                val hashes = line.takeWhile { it == '#' }.length
                if (hashes <= 6 && line.length > hashes && line[hashes] == ' ') {
                    flush(); blocks.add(MarkdownBlock.Heading(hashes, line.substring(hashes).trim())); continue
                }
            }
            if (line == "---" || line == "***" || line == "___") { flush(); blocks.add(MarkdownBlock.Rule); continue }
            if (line.startsWith(">")) { flushOthers(quote); quote.add(line.substring(1).trim()); continue }
            if (line.startsWith("|")) {
                flushOthers(table)
                val cells = line.split("|").drop(1).dropLast(1).map { it.trim() }
                // 表头分隔行 |---|---| 跳过
                if (cells.all { c -> c.isNotEmpty() && c.all { it == '-' || it == ':' } }) continue
                table.add(cells); continue
            }
            if (line.startsWith("- ") || line.startsWith("* ") || line.startsWith("• ")) {
                flushOthers(bullets); bullets.add(line.substring(2).trim()); continue
            }
            val om = ORDERED.matchEntire(line)
            if (om != null) { flushOthers(ordered); ordered.add(om.groupValues[2].trim()); continue }
            flushOthers(para); para.add(line)
        }
        flush()
        return blocks
    }
}

val MARKDOWN_ACCENT = Color(0xFFA56A2D)
private val ACCENT = MARKDOWN_ACCENT
private val QUOTE_INK = Color(0xFF8C562A)
/** RN postReadingTheme.mdBody：rgba(28,20,16,.82)（探索文章与读后两版同一套正文色） */
private val BODY_INK = Color(0xD11C1410)

/** 文章里的站内链接：/read/GEN/3?verse=9 → 章；/explore/articles/<slug> → 文章。完整域名（askbible.me）也认。 */
sealed class ArticleLink {
    data class Chapter(val bookId: String, val chapter: Int, val verse: Int?) : ArticleLink()
    data class Article(val slug: String) : ArticleLink()

    companion object {
        fun resolve(url: String): ArticleLink? {
            val u = runCatching { android.net.Uri.parse(url) }.getOrNull() ?: return null
            val parts = (u.path ?: "").split("/").filter { it.isNotEmpty() }
            if (parts.size >= 3 && parts[0] == "read") {
                val ch = parts[2].toIntOrNull() ?: return null
                return Chapter(parts[1].uppercase(), ch, u.getQueryParameter("verse")?.toIntOrNull())
            }
            if (parts.size >= 3 && parts[0] == "explore" && parts[1] == "articles") return Article(parts[2])
            return null
        }
    }
}

/**
 * 正文渲染。字号随阅读档位缩放：textScale = verseFontSize / 16（RN 同式），body 16/30、h2 18/30、h3 16/27，
 * 强调色 #A56A2D，粗体 600 强调色，链接强调色不加下划线（plainScriptureLinks），引用左线 3 强调色、文字 #8C562A。
 */
@Composable
fun MarkdownBody(markdown: String, size: ReadSize, theme: Parchment, onLink: (String) -> Unit) {
    val blocks = remember(markdown) { MarkdownParser.parse(markdown) }
    val scale = (size.metrics.verseFontSize / 16f).coerceIn(0.8f, 2.8f)
    fun sx(n: Float) = maxOf(1f, Math.round(n * scale * 10f) / 10f)
    val body = BODY_INK

    Column(Modifier.fillMaxWidth()) {
        for (b in blocks) when (b) {
            is MarkdownBlock.Heading -> when (b.level) {
                1 -> Inline(b.text, sx(20f), FontWeight.Bold, ACCENT, sx(32f), onLink,
                            Modifier.fillMaxWidth().padding(bottom = (sx(22f) + sx(8f)).dp), TextAlign.Center, 0.5f)
                2 -> Inline(b.text, sx(18f), FontWeight.Bold, ACCENT, sx(30f), onLink,
                            Modifier.padding(top = sx(24f).dp, bottom = (sx(14f) + sx(5f)).dp), letterSpacing = 0.3f)
                else -> Inline(b.text, sx(16f), FontWeight.SemiBold, ACCENT, sx(27f), onLink,
                               Modifier.padding(top = sx(22f).dp, bottom = sx(10f).dp))
            }
            is MarkdownBlock.Paragraph -> Inline(b.text, sx(16f), FontWeight.Normal, body, sx(30f), onLink,
                                                 Modifier.padding(bottom = sx(18f).dp))
            // RN bullet_list_icon 宽 0：条目不带圆点，逐条成段（间距 10）
            is MarkdownBlock.Bullets -> Column(Modifier.padding(top = sx(6f).dp, bottom = sx(18f).dp),
                                               verticalArrangement = Arrangement.spacedBy(sx(10f).dp)) {
                for (item in b.items) Inline(item, sx(16f), FontWeight.Normal, body, sx(30f), onLink)
            }
            is MarkdownBlock.Ordered -> Column(Modifier.padding(top = sx(6f).dp, bottom = sx(18f).dp),
                                               verticalArrangement = Arrangement.spacedBy(sx(10f).dp)) {
                b.items.forEachIndexed { i, item ->
                    Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(sx(4f).dp)) {
                        Text("${i + 1}.", color = ACCENT, fontSize = sx(15f).sp, lineHeight = sx(30f).sp,
                             fontWeight = FontWeight.Medium, modifier = Modifier.widthIn(min = sx(18f).dp))
                        Inline(item, sx(16f), FontWeight.Normal, body, sx(30f), onLink)
                    }
                }
            }
            // 引用左线要跟文字一样高：Row 用 IntrinsicSize.Min 量高，再让左线 fillMaxHeight
            is MarkdownBlock.Quote -> Row(Modifier.padding(vertical = sx(16f).dp).height(IntrinsicSize.Min)) {
                Box(Modifier.width(3.dp).fillMaxHeight().background(ACCENT))
                Inline(b.text, sx(16f), FontWeight.Normal, QUOTE_INK, sx(30f), onLink, Modifier.padding(start = sx(14f).dp))
            }
            // RN hr：高 0、透明 —— 分隔线不画
            MarkdownBlock.Rule -> Unit
            is MarkdownBlock.Table -> Column(Modifier.padding(bottom = sx(18f).dp)) {
                b.rows.forEachIndexed { r, row ->
                    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.Top,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        for (cell in row) Box(Modifier.weight(1f)) {
                            Inline(cell, sx(14f), if (r == 0) FontWeight.SemiBold else FontWeight.Normal,
                                   if (r == 0) ACCENT else body, sx(22f), onLink)
                        }
                    }
                    Box(Modifier.fillMaxWidth().height(0.5.dp).background(theme.border.toColor().copy(alpha = 0.6f)))
                }
            }
        }
    }
}


private val BOLD = Regex("\\*\\*(.+?)\\*\\*")
private val LINK = Regex("\\[([^\\]]+)\\]\\(([^)]+)\\)")

/** 行内：粗体 → 600 强调色；链接 → 强调色、不加下划线；其余按传入样式 */
@Composable
private fun Inline(
    text: String, fontSize: Float, weight: FontWeight, color: Color, lineHeight: Float,
    onLink: (String) -> Unit, modifier: Modifier = Modifier, align: TextAlign? = null, letterSpacing: Float = 0f,
) {
    val annotated = remember(text, color) { buildInline(text, onLink) }
    Text(
        annotated, modifier, color = color, fontSize = fontSize.sp, lineHeight = lineHeight.sp,
        fontWeight = weight, textAlign = align, letterSpacing = letterSpacing.sp,
    )
}

private fun buildInline(text: String, onLink: (String) -> Unit): AnnotatedString = buildAnnotatedString {
    // 先切链接，再在每段里切粗体
    var idx = 0
    for (m in LINK.findAll(text)) {
        appendBold(text.substring(idx, m.range.first))
        val url = m.groupValues[2]
        withLink(LinkAnnotation.Url(url, TextLinkStyles(SpanStyle(color = ACCENT))) { onLink(url) }) {
            appendBold(m.groupValues[1])
        }
        idx = m.range.last + 1
    }
    appendBold(text.substring(idx))
}

private fun androidx.compose.ui.text.AnnotatedString.Builder.appendBold(s: String) {
    var idx = 0
    for (m in BOLD.findAll(s)) {
        append(s.substring(idx, m.range.first))
        withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = ACCENT)) { append(m.groupValues[1]) }
        idx = m.range.last + 1
    }
    append(s.substring(idx))
}
