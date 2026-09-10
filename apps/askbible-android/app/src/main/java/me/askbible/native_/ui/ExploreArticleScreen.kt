package me.askbible.native_.ui

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.askbible.native_.data.ExploreArticle
import me.askbible.native_.data.ExploreArticles
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.ReadSize
import me.askbible.native_.data.ShellMetrics

/**
 * 探索文章页。对应 RN ExploreArticleScreen：顶距 40 + 状态栏、系统返回、标题 24/600 + 发丝线、
 * 正文 Markdown；分段版式带「点按段落可展开或收起」折叠卡（当前四篇都是长文版式，整篇铺开）。与 iOS 的 ExploreArticleView 对等。
 */
@Composable
fun ExploreArticleScreen(
    article: ExploreArticle,
    size: ReadSize,
    onBack: () -> Unit,
    onOpenChapter: (bookId: String, chapter: Int) -> Unit,
    onOpenArticle: (ExploreArticle) -> Unit,
    theme: Parchment = Parchment.light,
) {
    val context = LocalContext.current
    var expanded by remember(article.slug) { mutableStateOf(article.sections.firstOrNull()?.id) }
    val onLink: (String) -> Unit = { url ->
        when (val t = ArticleLink.resolve(url)) {
            is ArticleLink.Chapter -> onOpenChapter(t.bookId, t.chapter)
            is ArticleLink.Article -> ExploreArticles.article(context, t.slug)?.let(onOpenArticle)
            null -> runCatching {
                context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url)))
            }
        }
    }

    Box(Modifier.fillMaxSize()) {
        ParchmentBackground(theme = theme)
        val insets = WindowInsets.systemBars.asPaddingValues()
        LazyColumn(
            Modifier.fillMaxSize().parchmentFade(ParchmentFadePreset.TABBAR),
            contentPadding = PaddingValues(start = 22.dp, end = 22.dp, top = 40.dp + insets.calculateTopPadding(),
                                           bottom = TAB_BAR_CLEARANCE.dp + insets.calculateBottomPadding() + 120.dp),
        ) {
            item {
                Box(Modifier.size(44.dp).clickableNoRipple(onBack), contentAlignment = Alignment.CenterStart) {
                    MaterialIcon(MI.ARROW_BACK, 24f, theme.ink.toColor())
                }
                // articleHeader：上 12 / 下 18 / 发丝线
                Text(article.title, Modifier.padding(top = 20.dp, bottom = 18.dp), color = theme.ink.toColor(),
                     fontSize = 24.sp, lineHeight = 32.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-0.3).sp)
                Box(Modifier.fillMaxWidth().height(0.5.dp).background(theme.border.toColor()))
                Spacer(Modifier.height(18.dp))
            }
            if (article.sections.isNotEmpty() && !article.prose) {
                item {
                    Text("点按段落可展开或收起", Modifier.fillMaxWidth().padding(bottom = 12.dp), color = theme.muted.toColor(),
                         fontSize = 13.sp, lineHeight = 20.sp, fontWeight = FontWeight.Medium, textAlign = TextAlign.Center)
                }
                // RN ExploreFeaturedArticleSections：14 圆角卡、chapterCell 底、边 2×hairline、头 56 高、序号 + 标题 17/700 强调色、右侧 + / −
                article.sections.forEachIndexed { i, s ->
                    item(key = s.id) {
                        val shape = RoundedCornerShape(14.dp)
                        Column(
                            Modifier.fillMaxWidth().padding(bottom = 10.dp).clip(shape)
                                .background(theme.chapterCell.toColor()).border(1.dp, theme.chapterCellBorder.toColor(), shape)
                                .animateContentSize()
                        ) {
                            Row(
                                Modifier.fillMaxWidth().defaultMinSize(minHeight = 56.dp)
                                    .clickableNoRipple { expanded = if (expanded == s.id) null else s.id }
                                    .padding(horizontal = 14.dp, vertical = 12.dp),
                                verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(12.dp),
                            ) {
                                Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text("${i + 1}", color = theme.parchmentAccent.toColor(), fontSize = 16.sp, lineHeight = 24.sp, fontWeight = FontWeight.Bold)
                                    Text(s.title, color = theme.parchmentAccent.toColor(), fontSize = 17.sp, lineHeight = 24.sp,
                                         fontWeight = FontWeight.Bold, maxLines = 3)
                                }
                                Text(if (expanded == s.id) "−" else "+", Modifier.width(18.dp), color = theme.parchmentAccent.toColor(),
                                     fontSize = 22.sp, lineHeight = 24.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                            }
                            if (expanded == s.id) {
                                Box(Modifier.padding(start = 10.dp, end = 10.dp, top = 2.dp, bottom = 12.dp)) {
                                    MarkdownBody(s.body, size, theme, onLink)
                                }
                            }
                        }
                    }
                }
            } else {
                item { MarkdownBody(article.body, size, theme, onLink) }
            }
        }
    }
}
