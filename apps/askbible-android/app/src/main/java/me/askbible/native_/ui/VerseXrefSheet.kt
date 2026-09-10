package me.askbible.native_.ui

import me.askbible.native_.data.SiteCopy
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.askbible.native_.audio.ChapterAudioPlayer
import me.askbible.native_.data.BibleCatalog
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.name
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.ReadSize
import me.askbible.native_.data.VerseXrefs
import me.askbible.native_.data.XrefTarget

/**
 * 经文关联弹层。对应 RN 版 ReadChapterVerseXrefSheet：
 * 标题「{书名} {章}:{节} · 经文关联」，两区「被引用于」/「相关经文」，
 * 每条引用带目标经文预览（muted、0.9× 字号），点击跳转该章。
 */
@Composable
fun VerseXrefSheet(
    bookName: String,
    chapter: Int,
    xrefs: VerseXrefs,
    size: ReadSize,
    snippet: (XrefTarget) -> String?,
    onOpen: (XrefTarget) -> Unit,
    onClose: () -> Unit,
    theme: Parchment = Parchment.light,
    locale: AppLocale = AppLocale.ZH_CN,
) {
    val fs = size.metrics.verseFontSize
    Box(Modifier.fillMaxSize().background(theme.modalBackdrop.toColor()).clickableNoRipple(onClose),
        contentAlignment = Alignment.BottomCenter) {
        Column(
            Modifier.fillMaxWidth().padding(horizontal = 10.dp).navigationBarsPadding()
                .parchmentCard(18.dp)
                .padding(start = 18.dp, end = 18.dp, top = 18.dp, bottom = 34.dp)
                .clickableNoRipple {},
        ) {
            Text(SiteCopy.f("pages.read.verseXrefSheetTitle", mapOf("bookName" to bookName, "chapter" to "$chapter", "verse" to "${xrefs.verse}")),
                 color = theme.ink.toColor(), fontSize = maxOf(17f, Math.round(fs * 0.95f).toFloat()).sp,
                 fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 14.dp))
            if (xrefs.isEmpty) {
                Text("暂无关联经文", color = theme.muted.toColor(), fontSize = Math.round(fs * 0.9f).sp)
            } else {
                Column(Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState()),
                       verticalArrangement = Arrangement.spacedBy(18.dp)) {
                    XrefSection(SiteCopy.t("pages.read.verseXrefIncoming"), xrefs.incoming, fs, theme, snippet, onOpen, locale)
                    XrefSection(SiteCopy.t("pages.read.verseXrefOutgoing"), xrefs.outgoing, fs, theme, snippet, onOpen, locale)
                }
            }
        }
    }
}

@Composable
private fun XrefSection(
    title: String, refs: List<XrefTarget>, fs: Float, theme: Parchment,
    snippet: (XrefTarget) -> String?, onOpen: (XrefTarget) -> Unit,
    locale: AppLocale = AppLocale.ZH_CN,
) {
    if (refs.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(title, color = theme.muted.toColor(), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        for (ref in refs) {
            Column(Modifier.fillMaxWidth().clickableNoRipple { onOpen(ref) },
                   verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(ref.label(BibleCatalog.book(ref.bookId)?.name(locale) ?: ref.bookId),
                     color = theme.parchmentAccent.toColor(), fontSize = (fs * 0.9f).sp,
                     fontWeight = FontWeight.SemiBold)
                snippet(ref)?.let {
                    Text(it, color = theme.muted.toColor(), fontSize = Math.round(fs * 0.81f).sp, maxLines = 3)
                }
            }
        }
    }
}

/** 睡眠定时弹层：30 / 60 分钟 / 关闭。到期只暂停。 */
@Composable
/** 睡眠定时是壳层级的：朗读和音乐两个播放器一起设。这里只出 UI，谁来设由 RootScreen 决定。 */
fun SleepTimerSheet(remainingLabel: String?, onPick: (Int?) -> Unit, onClose: () -> Unit, theme: Parchment = Parchment.light) {
    Box(Modifier.fillMaxSize().background(theme.modalBackdrop.toColor()).clickableNoRipple(onClose),
        contentAlignment = Alignment.BottomCenter) {
        Column(
            Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 24.dp).navigationBarsPadding()
                .parchmentCard(18.dp).padding(18.dp)
                .clickableNoRipple {},
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(SiteCopy.t("native.sleepTimer"), color = theme.ink.toColor(), fontSize = 17.sp, fontWeight = FontWeight.Bold)
            remainingLabel?.let { Text(SiteCopy.f("native.sleepTimerLeft", mapOf("left" to it)), color = theme.muted.toColor(), fontSize = 13.sp) }
            for (m in ChapterAudioPlayer.SLEEP_OPTIONS_MINUTES) {
                SleepOption(SiteCopy.f("native.minutes", mapOf("m" to "$m")), theme) { onPick(m); onClose() }
            }
            SleepOption(SiteCopy.t("native.sleepTimerOff"), theme) { onPick(null); onClose() }
        }
    }
}

@Composable
private fun SleepOption(title: String, theme: Parchment, onClick: () -> Unit) {
    Box(Modifier.fillMaxWidth().height(44.dp).clip(RoundedCornerShape(10.dp))
        .background(theme.surface.toColor()).clickableNoRipple(onClick), contentAlignment = Alignment.Center) {
        Text(title, color = theme.ink.toColor(), fontSize = 15.sp, fontWeight = FontWeight.SemiBold,
             textAlign = TextAlign.Center)
    }
}
