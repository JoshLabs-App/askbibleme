package me.askbible.native_.ui

import me.askbible.native_.data.SiteCopy
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.ReadSize

/**
 * 长按某节弹出的操作单。对应 RN ReadChapterScreenVerseActionModal（ReadChapterBottomSheet 外壳），与 iOS 的 VerseActionSheet 对等：
 * 标题「第 N 节」+ 右上「关闭」，三列格子：本节复制 / 双击收藏（已收藏则不出）/ 分享。RN 还有「多选复制」「划重点」两项，本轮未接。
 */
@Composable
fun VerseActionSheet(
    verse: Int,
    bookmarked: Boolean,
    size: ReadSize,
    onCopy: () -> Unit,
    onBookmark: () -> Unit,
    onShare: () -> Unit,
    onClose: () -> Unit,
    theme: Parchment = Parchment.light,
) {
    val fs = size.metrics.verseFontSize
    val iconSize = maxOf(22f, Math.round(fs * 1.15f).toFloat())
    val labelSize = maxOf(13f, Math.round(fs * 0.78f).toFloat())
    Box(Modifier.fillMaxSize().background(Color(0x591C1410)).clickableNoRipple(onClose), contentAlignment = Alignment.BottomCenter) {
        Column(
            Modifier.fillMaxWidth().navigationBarsPadding().parchmentCard(16.dp)
                .padding(start = 18.dp, end = 18.dp, top = 14.dp, bottom = 28.dp).clickableNoRipple {},
        ) {
            Row(Modifier.fillMaxWidth().padding(bottom = 10.dp), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("第 $verse 节", Modifier.weight(1f), color = theme.ink.toColor(), fontSize = maxOf(17f, Math.round(fs * 0.95f).toFloat()).sp, fontWeight = FontWeight.SemiBold)
                Text("关闭", Modifier.clickableNoRipple(onClose), color = theme.muted.toColor(), fontSize = Math.round(fs * 0.85f).sp)
            }
            Row(Modifier.fillMaxWidth().padding(top = 4.dp, bottom = 8.dp), verticalAlignment = Alignment.Top) {
                Cell(MI.CONTENT_COPY, SiteCopy.t("pages.read.verseActionCopy"), iconSize, labelSize, theme, Modifier.weight(1f), onCopy)
                if (!bookmarked) Cell(MI.BOOKMARK_BORDER, SiteCopy.t("pages.read.verseActionBookmark"), iconSize, labelSize, theme, Modifier.weight(1f), onBookmark)
                Cell(MI.IOS_SHARE, SiteCopy.t("pages.read.verseActionShare"), iconSize, labelSize, theme, Modifier.weight(1f), onShare)
            }
        }
    }
}

@Composable
private fun Cell(glyph: String, label: String, icon: Float, font: Float, theme: Parchment, modifier: Modifier, onClick: () -> Unit) {
    Column(modifier.clickableNoRipple(onClick).padding(horizontal = 6.dp, vertical = 14.dp),
           horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        MaterialIcon(glyph, icon, theme.ink.toColor())
        Text(label, color = theme.ink.toColor(), fontSize = font.sp, lineHeight = 18.sp, fontWeight = FontWeight.Medium, textAlign = TextAlign.Center, maxLines = 2)
    }
}

/** 收藏 / 复制后的轻提示（RN ReadVerseBookmarkFeedback）：深色胶囊，14/500 #f7f4ef */
@Composable
fun VerseFeedbackToast(message: String, modifier: Modifier = Modifier) {
    Box(modifier.background(Color(0xD11C1410), CircleShape).padding(horizontal = 16.dp, vertical = 10.dp)) {
        Text(message, color = Color(0xFFF7F4EF), fontSize = 14.sp, fontWeight = FontWeight.Medium, textAlign = TextAlign.Center)
    }
}

/**
 * 复制 / 分享用的经文文案，与 RN 同一格式：
 * 复制 = 「书名 章:节 经文」一行（lib formatScriptureVerseClipboard）；分享 = 「书名 章:节」换行经文（Share.share message）
 */
object VerseShareText {
    fun clipboard(bookName: String, chapter: Int, verse: Int, text: String) = "$bookName $chapter:$verse ${text.trim()}".trim()
    fun share(bookName: String, chapter: Int, verse: Int, text: String) = "$bookName $chapter:$verse\n$text"
}
