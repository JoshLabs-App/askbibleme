package me.askbible.native_.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.askbible.native_.data.Parchment

/**
 * 选时间的小面板（每日读经提醒用）：羊皮卡片 + 两列滚动（小时 / 分钟），
 * 和其它弹层同一张底，不用系统 TimePickerDialog。与 iOS 的 TimePickerSheet 对等。
 */
@Composable
fun TimePickerSheet(
    title: String,
    hour: Int,
    minute: Int,
    doneTitle: String,
    onDone: (Int, Int) -> Unit,
    onCancel: () -> Unit,
    theme: Parchment = Parchment.light,
) {
    var h by remember { mutableIntStateOf(hour.coerceIn(0, 23)) }
    var m by remember { mutableIntStateOf(minute.coerceIn(0, 59)) }
    Box(Modifier.fillMaxSize().background(Color(0x591C1410)).clickableNoRipple(onCancel),
        contentAlignment = Alignment.BottomCenter) {
        Column(
            Modifier.fillMaxWidth().navigationBarsPadding().parchmentCard(16.dp)
                .padding(start = 18.dp, end = 18.dp, top = 16.dp, bottom = 28.dp).clickableNoRipple {},
        ) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(title, Modifier.weight(1f), color = theme.ink.toColor(), fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
                Text(doneTitle, Modifier.clickableNoRipple { onDone(h, m) },
                     color = theme.ink.toColor(), fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.height(10.dp))
            Row(Modifier.fillMaxWidth().height(180.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                NumberColumn(0..23, h, Modifier.weight(1f), theme) { h = it }
                NumberColumn(0..59, m, Modifier.weight(1f), theme) { m = it }
            }
        }
    }
}

@Composable
private fun NumberColumn(
    range: IntRange,
    selected: Int,
    modifier: Modifier,
    theme: Parchment,
    onPick: (Int) -> Unit,
) {
    val state = rememberLazyListState(initialFirstVisibleItemIndex = (selected - 2).coerceAtLeast(0))
    LazyColumn(modifier, state = state) {
        items(range.toList().size) { i ->
            val value = range.first + i
            val on = value == selected
            Box(
                Modifier.fillMaxWidth().height(40.dp).clip(RoundedCornerShape(10.dp))
                    .background(if (on) Color(0x2EFFB101) else Color.Transparent)
                    .clickableNoRipple { onPick(value) },
                contentAlignment = Alignment.Center,
            ) {
                Text(String.format("%02d", value),
                     color = if (on) theme.ink.toColor() else theme.muted.toColor(),
                     fontSize = if (on) 20.sp else 17.sp,
                     fontWeight = if (on) FontWeight.SemiBold else FontWeight.Normal)
            }
        }
    }
}
