package me.askbible.native_.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.SiteCopy
import me.askbible.native_.data.VerseHighlightRules

/**
 * 划重点时底部的调色卡片：四个颜色 + 擦除 + 完成。
 * 和长按操作单同一张羊皮卡片；由壳画在播放坞之上。与 iOS 的 HighlightBar 对等。
 */
@Composable
fun HighlightBar(
    locale: AppLocale,
    color: String,
    erasing: Boolean,
    onPickColor: (String) -> Unit,
    onErase: () -> Unit,
    onDone: () -> Unit,
    theme: Parchment = Parchment.light,
) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
        Column(
            Modifier.fillMaxWidth().navigationBarsPadding().parchmentCard(16.dp)
                .padding(start = 18.dp, end = 18.dp, top = 14.dp, bottom = 28.dp).clickableNoRipple {},
        ) {
            Row(Modifier.fillMaxWidth().padding(bottom = 12.dp), verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Text(SiteCopy.t("native.highlight", locale),
                         color = theme.ink.toColor(), fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
                    Text(SiteCopy.t("native.highlightHint", locale),
                         color = theme.muted.toColor(), fontSize = 12.sp)
                }
                Text(SiteCopy.t("native.done", locale), Modifier.clickableNoRipple(onDone),
                     color = theme.ink.toColor(), fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            }
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                for (hex in VerseHighlightRules.PALETTE) {
                    val on = !erasing && hex == color
                    Box(
                        Modifier.size(34.dp).clip(CircleShape).background(hexColor(hex))
                            .border(if (on) 2.dp else 0.5.dp,
                                    theme.ink.toColor().copy(alpha = if (on) 0.75f else 0.12f), CircleShape)
                            .clickableNoRipple { onPickColor(hex) },
                    )
                }
                Spacer(Modifier.weight(1f))
                Box(
                    Modifier.heightIn(min = 34.dp).clip(RoundedCornerShape(999.dp))
                        .background(if (erasing) Color(0x38FFB101) else Color(0x80FFF8EB))
                        .clickableNoRipple(onErase).padding(horizontal = 12.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(SiteCopy.t("native.highlightErase", locale),
                         color = if (erasing) theme.ink.toColor() else theme.muted.toColor(),
                         fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}
