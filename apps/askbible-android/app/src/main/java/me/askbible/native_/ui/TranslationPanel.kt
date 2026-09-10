package me.askbible.native_.ui

import me.askbible.native_.data.SiteCopy
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.ScriptureTranslation
import me.askbible.native_.data.TranslationDelivery
import me.askbible.native_.data.TranslationDownloader

/**
 * 译本选择浮层 —— 齿轮开出来的就是这个（与 iOS 的 TranslationPanel 对等）。
 * 主译本 / 对照两个下拉，展开后是完整目录（RN 生产目录里拿得到正文的 20 本），按语言分组（简中 / 繁中 / 英文）、按 RN 选择器顺序排；
 * 行尾标记：有朗读（record-voice-over）、在线（逐章抓取）、需下载（KJV，选中后按需拉）。
 */
@Composable
fun TranslationPanel(
    current: ScriptureTranslation,
    secondary: ScriptureTranslation?,
    onSelect: (ScriptureTranslation) -> Unit,
    onSelectSecondary: (ScriptureTranslation?) -> Unit,
    onClose: () -> Unit,
    theme: Parchment = Parchment.light,
    /** 界面语言：标签与分组名按它 */
    locale: AppLocale = AppLocale.ZH_CN,
    downloader: TranslationDownloader? = null,
) {
    var expanded by remember { mutableStateOf(false) }
    var expandedSecondary by remember { mutableStateOf(false) }

    Box(
        Modifier.fillMaxSize()
            .background(theme.modalBackdrop.toColor())
            .clickableNoRipple(onClose)
    ) {
        Column(
            Modifier.statusBarsPadding()
                .padding(top = 38.dp, start = 30.dp, end = 9.dp)
                .parchmentCard(17.dp)
                .padding(horizontal = 16.dp, vertical = 14.dp)
                .clickableNoRipple {},
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                Icon(Icons.Filled.MenuBook, contentDescription = null,
                     tint = theme.ink.toColor(), modifier = Modifier.size(26.dp))
                Dropdown(current.label(locale), theme.parchmentAccent.toColor(), expanded, theme,
                         Modifier.weight(1f)) { expanded = !expanded; if (expanded) expandedSecondary = false }
            }

            if (expanded) {
                TranslationList(selectedId = current.id, excludeId = null, allowNone = false, locale = locale, downloader = downloader, theme = theme) { t ->
                    if (t != null) onSelect(t)
                    expanded = false
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                Spacer(Modifier.width(26.dp))
                Dropdown(secondary?.label(locale) ?: SiteCopy.t("native.none", locale), Color(0xFFE0A100), expandedSecondary, theme,
                         Modifier.weight(1f)) { expandedSecondary = !expandedSecondary; if (expandedSecondary) expanded = false }
            }

            if (expandedSecondary) {
                TranslationList(selectedId = secondary?.id, excludeId = current.id, allowNone = true, locale = locale, downloader = downloader, theme = theme) { t ->
                    onSelectSecondary(t)
                    expandedSecondary = false
                }
            }
        }
    }
}

/** 分组：简中 → 繁中 → 英文（RN LANGUAGE_PRIORITY），组内按 RN 选择器顺序 */
private fun groups(locale: AppLocale): List<Pair<String, List<ScriptureTranslation>>> {
    val ordered = ScriptureTranslation.pickerOrder(locale)
    val keys = listOf("zh-Hans", "zh-Hant", "en")
    val out = ArrayList<Pair<String, List<ScriptureTranslation>>>()
    for (key in keys) {
        val items = ordered.filter { it.language.lowercase().startsWith(key.lowercase()) }
        if (items.isNotEmpty()) out.add(key to items)
    }
    val rest = ordered.filter { t -> keys.none { t.language.lowercase().startsWith(it.lowercase()) } }
    if (rest.isNotEmpty()) out.add("" to rest)
    return out
}

@Composable
private fun TranslationList(
    selectedId: String?, excludeId: String?, allowNone: Boolean, locale: AppLocale,
    downloader: TranslationDownloader?, theme: Parchment, onPick: (ScriptureTranslation?) -> Unit,
) {
    val sections = remember(locale) { groups(locale) }
    LazyColumn(
        Modifier.padding(start = 40.dp).heightIn(max = 380.dp)
            .clip(RoundedCornerShape(9.dp))
            .background(Color(0xFFFFFDF8))
            .border(1.dp, theme.border.toColor().copy(alpha = 0.6f), RoundedCornerShape(9.dp)),
    ) {
        if (allowNone) item { TranslationRow(SiteCopy.t("native.none", locale), selectedId == null, theme, onClick = { onPick(null) }) {} }
        for ((language, items) in sections) {
            item {
                Text(ScriptureTranslation.languageName(language, locale), Modifier.fillMaxWidth().padding(start = 14.dp, end = 14.dp, top = 10.dp, bottom = 4.dp),
                     color = theme.faint.toColor(), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }
            for (t in items.filter { it.id != excludeId }) {
                item(key = t.id) {
                    TranslationRow(t.label(locale), t.id == selectedId, theme, onClick = { onPick(t) }) {
                        if (t.hasChapterAudio) MaterialIcon(MI.RECORD_VOICE_OVER, 16f, theme.muted.toColor())
                        when (t.delivery) {
                            TranslationDelivery.BUNDLED -> Unit
                            TranslationDelivery.ONLINE -> Tag(SiteCopy.t("native.online", locale), theme)
                            TranslationDelivery.DOWNLOAD -> when (downloader?.state(t.id)) {
                                is TranslationDownloader.State.Downloading -> Tag(SiteCopy.t("native.downloading", locale), theme)
                                is TranslationDownloader.State.Failed -> Tag(SiteCopy.t("pages.read.retry", locale), theme)
                                TranslationDownloader.State.Done -> Unit
                                else -> Tag(SiteCopy.t("native.needDownload", locale), theme)
                            }
                        }
                    }
                }
            }
        }
        item { Spacer(Modifier.height(6.dp)) }
    }
}

@Composable
private fun TranslationRow(label: String, selected: Boolean, theme: Parchment, onClick: () -> Unit, badges: @Composable () -> Unit) {
    Row(
        Modifier.fillMaxWidth().heightIn(min = 42.dp).clickableNoRipple(onClick).padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(label, color = theme.ink.toColor(), fontSize = 16.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
        badges()
        if (selected) {
            Icon(Icons.Filled.Check, contentDescription = null, tint = theme.parchmentAccent.toColor(), modifier = Modifier.size(16.dp))
        }
    }
}

@Composable
private fun Tag(text: String, theme: Parchment) {
    Text(text, Modifier.border(1.dp, theme.border.toColor(), CircleShape).padding(horizontal = 6.dp, vertical = 2.dp),
         color = theme.muted.toColor(), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
}

@Composable
private fun Dropdown(
    text: String, color: Color, open: Boolean, theme: Parchment,
    modifier: Modifier, onClick: () -> Unit,
) {
    Row(
        modifier.height(40.dp)
            .clip(RoundedCornerShape(9.dp))
            .background(Color(0xFFFFFDF8))
            .border(1.dp, theme.border.toColor().copy(alpha = 0.6f), RoundedCornerShape(9.dp))
            .clickableNoRipple(onClick)
            .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text, color = color, fontSize = 18.sp, fontWeight = FontWeight.SemiBold,
             maxLines = 1, modifier = Modifier.weight(1f))
        Icon(Icons.Filled.KeyboardArrowDown, contentDescription = null,
             tint = theme.muted.toColor().copy(alpha = 0.55f),
             modifier = Modifier.size(18.dp).rotate(if (open) 180f else 0f))
    }
}
