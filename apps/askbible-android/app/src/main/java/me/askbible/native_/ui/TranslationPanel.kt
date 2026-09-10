package me.askbible.native_.ui

import me.askbible.native_.data.LanguageOrder
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
import me.askbible.native_.data.Brand
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.LaunchedEffect
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
    /** 网站译本目录刷新计数：变了就重算分组（几百本在线译本是异步来的） */
    catalogRevision: Int = 0,
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
                TranslationList(selectedId = current.id, excludeId = null, allowNone = false, locale = locale, downloader = downloader, theme = theme, catalogRevision = catalogRevision) { t ->
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
                TranslationList(selectedId = secondary?.id ?: current.id, excludeId = current.id, allowNone = true, locale = locale, downloader = downloader, theme = theme, catalogRevision = catalogRevision) { t ->
                    onSelectSecondary(t)
                    expandedSecondary = false
                }
            }
        }
    }
}

/** 按语言分组：内置的简中 / 繁中 / 英文在前（界面语言那档打头），其余语种按版本数排；组内按 RN 选择器顺序 */
private fun groups(locale: AppLocale): List<Pair<String, List<ScriptureTranslation>>> {
    val bucket = LinkedHashMap<String, MutableList<ScriptureTranslation>>()
    for (t in ScriptureTranslation.pickerOrder(locale)) bucket.getOrPut(t.language.lowercase()) { ArrayList() }.add(t)
    val head = when (locale) {
        AppLocale.EN -> listOf("en", "zh-hans", "zh-hant")
        AppLocale.ZH_TW -> listOf("zh-hant", "zh-hans", "en")
        AppLocale.ZH_CN -> listOf("zh-hans", "zh-hant", "en")
    }
    // 按语言使用人数排（LanguageOrder）；表里没有的排在后面，再按版本数（之前只按版本数，梵语 22 本会顶到最前）
    val rest = bucket.keys.filter { it !in head }
        .sortedWith(compareBy<String> { LanguageOrder.rank(it) }
            .thenByDescending { bucket[it]?.size ?: 0 }.thenBy { it })
    return (head + rest).mapNotNull { key -> bucket[key]?.let { key to it.toList() } }
}

@Composable
private fun TranslationList(
    selectedId: String?, excludeId: String?, allowNone: Boolean, locale: AppLocale,
    downloader: TranslationDownloader?, theme: Parchment, catalogRevision: Int, onPick: (ScriptureTranslation?) -> Unit,
) {
    val sections = remember(locale, catalogRevision) { groups(locale) }
    var query by remember { mutableStateOf("") }
    // 上面一排语言（简中 / 繁中 / 英文），下面只列该语言的版本（RN 选择器顺序 = 常用在前）；Josh 2026-09-10
    val initialFamily = remember(selectedId, excludeId) {
        val id = selectedId ?: excludeId
        sections.firstOrNull { (_, items) -> items.any { it.id == id } }?.first ?: sections.firstOrNull()?.first ?: ""
    }
    var family by remember(initialFamily) { mutableStateOf(initialFamily) }
    val q = query.trim().lowercase()
    val items = if (q.isEmpty()) {
        (sections.firstOrNull { it.first == family }?.second ?: emptyList()).filter { it.id != excludeId }
    } else {
        // 搜索非空时跨语言平铺结果（几百本在线译本，只靠滑语言找不动）
        sections.flatMap { it.second }.filter { t ->
            t.id != excludeId && (t.label(locale).lowercase().contains(q) || t.labelEn.lowercase().contains(q) ||
                t.abbreviation.lowercase().contains(q) || ScriptureTranslation.languageName(t.language, locale).lowercase().contains(q))
        }.take(80)
    }
    Column(
        Modifier.padding(start = 40.dp)
            .clip(RoundedCornerShape(9.dp))
            .background(Color(0xFFFFFDF8))
            .border(1.dp, theme.border.toColor().copy(alpha = 0.6f), RoundedCornerShape(9.dp)),
    ) {
        BasicTextField(
            value = query, onValueChange = { query = it },
            modifier = Modifier.fillMaxWidth().padding(start = 10.dp, end = 10.dp, top = 10.dp, bottom = 4.dp)
                .background(theme.surface.toColor(), RoundedCornerShape(9.dp))
                .border(0.5.dp, theme.border.toColor(), RoundedCornerShape(9.dp))
                .padding(horizontal = 12.dp, vertical = 9.dp),
            textStyle = TextStyle(color = theme.ink.toColor(), fontSize = 14.sp),
            singleLine = true,
            cursorBrush = SolidColor(theme.ink.toColor()),
            decorationBox = { inner ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    MaterialIcon(MI.SEARCH, 15f, theme.muted.toColor())
                    Box(Modifier.weight(1f)) {
                        if (query.isEmpty()) Text(SiteCopy.t("native.searchTranslation", locale), color = theme.faint.toColor(), fontSize = 14.sp)
                        inner()
                    }
                }
            },
        )
        if (q.isEmpty()) {
            // 语言行打开时把当前语言滚到眼前（几百本时当前语言常在最右边）
            val chipState = rememberLazyListState()
            LaunchedEffect(family, sections) {
                val i = sections.indexOfFirst { it.first == family }
                if (i >= 0) chipState.scrollToItem(i)
            }
            LazyRow(state = chipState,
                modifier = Modifier.fillMaxWidth().padding(start = 10.dp, end = 10.dp, top = 4.dp, bottom = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(sections.size, key = { sections[it].first }) { idx ->
                    val language = sections[idx].first
                    val on = language == family
                    Box(
                        Modifier.clip(RoundedCornerShape(10.dp))
                            .background(if (on) Brand.logo.toColor().copy(alpha = 0.28f) else theme.surface.toColor().copy(alpha = 0.6f))
                            .border(if (on) 1.5.dp else 0.5.dp, if (on) Brand.logo.toColor() else theme.border.toColor(), RoundedCornerShape(10.dp))
                            .clickableNoRipple { family = language }.padding(vertical = 8.dp, horizontal = 12.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(ScriptureTranslation.languageName(language, locale), color = theme.ink.toColor(), fontSize = 13.sp,
                             fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
    LazyColumn(Modifier.heightIn(max = 340.dp)) {
        if (allowNone && q.isEmpty()) item { TranslationRow(SiteCopy.t("native.none", locale), selectedId == null || selectedId == excludeId, theme, onClick = { onPick(null) }) {} }
        if (items.isEmpty()) item {
            Text(SiteCopy.t("pages.read.scriptureSearchEmpty", locale), Modifier.fillMaxWidth().padding(vertical = 14.dp),
                 color = theme.faint.toColor(), fontSize = 13.sp, textAlign = TextAlign.Center)
        }
        run {
            for (t in items) {
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
