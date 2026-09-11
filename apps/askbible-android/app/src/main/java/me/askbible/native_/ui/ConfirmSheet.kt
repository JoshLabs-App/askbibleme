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
import me.askbible.native_.data.Parchment

/**
 * 不可逆操作的确认单（删除账户等）。用和长按操作单同一张羊皮卡片，不用系统对话框：
 * 整个 App 的弹层都是这套样式，系统对话框会跳出羊皮卷的观感。与 iOS 的 ConfirmSheet 对等。
 */
@Composable
fun ConfirmSheet(
    title: String,
    message: String,
    confirmTitle: String,
    cancelTitle: String,
    onConfirm: () -> Unit,
    onCancel: () -> Unit,
    theme: Parchment = Parchment.light,
) {
    Box(Modifier.fillMaxSize().background(Color(0x591C1410)).clickableNoRipple(onCancel),
        contentAlignment = Alignment.BottomCenter) {
        Column(
            Modifier.fillMaxWidth().navigationBarsPadding().parchmentCard(16.dp)
                .padding(start = 18.dp, end = 18.dp, top = 16.dp, bottom = 28.dp).clickableNoRipple {},
        ) {
            Text(title, color = theme.ink.toColor(), fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            Text(message, color = theme.muted.toColor(), fontSize = 14.sp, lineHeight = 20.sp)
            Spacer(Modifier.height(18.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(
                    Modifier.weight(1f).heightIn(min = 48.dp).clip(RoundedCornerShape(12.dp))
                        .background(Color(0x9EFFFCF5)).border(0.5.dp, theme.border.toColor(), RoundedCornerShape(12.dp))
                        .clickableNoRipple(onCancel),
                    contentAlignment = Alignment.Center,
                ) { Text(cancelTitle, color = theme.ink.toColor(), fontSize = 15.sp, fontWeight = FontWeight.SemiBold) }
                Box(
                    Modifier.weight(1f).heightIn(min = 48.dp).clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFFB42318)).clickableNoRipple(onConfirm),
                    contentAlignment = Alignment.Center,
                ) { Text(confirmTitle, color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold) }
            }
        }
    }
}
