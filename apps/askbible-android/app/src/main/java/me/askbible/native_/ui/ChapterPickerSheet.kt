package me.askbible.native_.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.askbible.native_.data.BookRef
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.name
import me.askbible.native_.data.AppLocale

/** 章节选择浮层。与 iOS 的 ChapterPickerSheet 对等：6 列章号网格。 */
@Composable
fun ChapterPickerSheet(
    book: BookRef,
    chapterCount: Int,
    onPick: (Int) -> Unit,
    onClose: () -> Unit,
    theme: Parchment = Parchment.light,
    locale: AppLocale = AppLocale.ZH_CN,
) {
    val count = if (chapterCount > 0) chapterCount else book.chapterCount

    Box(
        Modifier.fillMaxSize()
            .background(theme.modalBackdrop.toColor())
            .clickableNoRipple(onClose),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            Modifier.padding(horizontal = 18.dp)
                .heightIn(max = 508.dp)
                .parchmentCard(20.dp)
                .padding(horizontal = 16.dp, vertical = 14.dp)
                // 吃掉点击，避免穿透到 backdrop 把自己关掉
                .clickableNoRipple {},
        ) {
            // RN BibleChapterPickerPanel.header：系统返回（Android 是 arrow-back）+ 标题 17/600 居中 + 「×」28 faint
            Row(Modifier.fillMaxWidth().padding(bottom = 18.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.size(24.dp).clickableNoRipple(onClose), contentAlignment = Alignment.Center) {
                    MaterialIcon(MI.ARROW_BACK, 24f, theme.ink.toColor())
                }
                Text(book.name(locale), Modifier.weight(1f),
                     color = theme.ink.toColor(), fontSize = 17.sp,
                     fontWeight = FontWeight.SemiBold, maxLines = 1,
                     textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                Text("\u00D7", Modifier.padding(horizontal = 4.dp).clickableNoRipple(onClose),
                     color = theme.faint.toColor(), fontSize = 28.sp, lineHeight = 28.sp)
            }

            LazyVerticalGrid(
                columns = GridCells.Fixed(6),
                horizontalArrangement = Arrangement.spacedBy(9.dp),
                verticalArrangement = Arrangement.spacedBy(9.dp),
                contentPadding = PaddingValues(bottom = 4.dp),
            ) {
                items((1..count).toList()) { n ->
                    Box(
                        Modifier.height(46.dp)
                            .clip(RoundedCornerShape(11.dp))
                            .background(theme.chapterCellPressed.toColor())
                            .clickableNoRipple { onPick(n) },
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("$n", color = theme.ink.toColor(),
                             fontSize = 19.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}
