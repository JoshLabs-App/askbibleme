package me.askbible.native_.ui

import me.askbible.native_.data.SiteCopy
import androidx.compose.foundation.background
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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.askbible.native_.data.BibleCatalog
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.name
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.ReadSize
import me.askbible.native_.data.ScriptureTranslation
import me.askbible.native_.data.VerseBookmark
import me.askbible.native_.data.VerseBookmarkStore

/**
 * 收藏页。对应 RN ReadFavoritesScreen，与 iOS 的 FavoritesView 对等：标题「收藏」22/600、引导语 13/20 muted、
 * 每条：书名 章:节 · 译本（14/600 faint，译本 400）+ 经文（verse 字号 500，最多 4 行）+ 右侧 bookmark 图标（点了取消收藏）。
 */
@Composable
fun FavoritesScreen(
    bookmarks: VerseBookmarkStore,
    size: ReadSize,
    onBack: () -> Unit,
    onOpen: (VerseBookmark) -> Unit,
    theme: Parchment = Parchment.light,
    locale: AppLocale = AppLocale.ZH_CN,
) {
    val insets = WindowInsets.systemBars.asPaddingValues()
    val list = bookmarks.list
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
                Text(SiteCopy.t("pages.read.favoritesTitle", locale), Modifier.fillMaxWidth().padding(bottom = 8.dp), color = theme.ink.toColor(), fontSize = 22.sp,
                     fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
                Text(SiteCopy.t("pages.read.favoritesLead", locale), Modifier.fillMaxWidth().padding(bottom = 16.dp), color = theme.muted.toColor(),
                     fontSize = 13.sp, lineHeight = 20.sp, textAlign = TextAlign.Center)
                if (list.isEmpty()) {
                    Text(SiteCopy.t("pages.read.favoritesEmpty", locale), Modifier.fillMaxWidth().padding(top = 24.dp), color = theme.muted.toColor(),
                         fontSize = 14.sp, lineHeight = 22.sp, textAlign = TextAlign.Center)
                }
            }
            items(list, key = { it.key }) { item ->
                Column(Modifier.fillMaxWidth()) {
                    Box(Modifier.fillMaxWidth().height(0.5.dp).background(theme.border.toColor()))
                    Row(Modifier.fillMaxWidth().padding(vertical = 14.dp), verticalAlignment = Alignment.Top,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Column(Modifier.weight(1f).clickableNoRipple { onOpen(item) }) {
                            val label = ScriptureTranslation.find(item.translationId)?.labelZh ?: item.translationId
                            Text(buildAnnotatedString {
                                withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) {
                                    append("${BibleCatalog.book(item.bookId)?.name(locale) ?: item.bookName} ${item.chapter}:${item.verse}")
                                }
                                append(" · $label")
                            }, color = theme.faint.toColor(), fontSize = 14.sp, modifier = Modifier.padding(bottom = 6.dp))
                            Text(item.text, color = theme.inkSoft.toColor(), fontSize = size.metrics.verseFontSize.sp,
                                 lineHeight = size.metrics.verseLineHeight.sp, fontWeight = FontWeight.Medium, maxLines = 4, overflow = TextOverflow.Ellipsis)
                        }
                        Box(Modifier.padding(top = 2.dp, start = 4.dp).clickableNoRipple {
                            bookmarks.toggle(item.bookId, item.bookName, item.chapter, item.verse, item.translationId, item.text)
                        }) { MaterialIcon(MI.BOOKMARK, 22f, theme.faint.toColor()) }
                    }
                }
            }
        }
    }
}
