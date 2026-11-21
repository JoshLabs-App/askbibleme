package me.askbible.native_.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.BibleCatalog
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.ReadSize
import me.askbible.native_.data.ScriptureDatabase
import me.askbible.native_.data.ScriptureTranslation
import me.askbible.native_.data.SiteCopy
import me.askbible.native_.data.VerseBookmark
import me.askbible.native_.data.VerseBookmarkStore
import me.askbible.native_.data.VerseHighlightRules
import me.askbible.native_.data.VerseHighlightStore
import me.askbible.native_.data.name

data class UnifiedNoteEntry(
    val id: String,
    val translationId: String,
    val bookId: String,
    val bookName: String,
    val chapter: Int,
    val verse: Int,
    val text: String,
    val pigmentHex: String,
    val isBookmarked: Boolean,
    val highlightMap: Map<Int, String>,
)

/**
 * 书房与收藏页共用的「摘录与印记」模块（对齐 iOS UnifiedNotesBlock）：
 * - 合并收藏（VerseBookmarkStore）与四色划重点（VerseHighlightStore）
 * - 顶部四色古籍颜料筛选胶囊（全部 · 灯油黄 · 橄榄绿 · 青石蓝 · 石榴红）
 * - 支持一键生成书签分享卡、带 3.4 秒「撤销」防误删胶囊提示
 */
@Composable
fun UnifiedNotesBlock(
    bookmarks: VerseBookmarkStore,
    highlights: VerseHighlightStore?,
    locale: AppLocale,
    theme: Parchment = Parchment.light,
    limit: Int? = null,
    onOpenVerse: (bookId: String, chapter: Int, verse: Int) -> Unit,
    onOpenMore: (() -> Unit)? = null,
    onShareCard: (VerseSharePayload) -> Unit = {},
    onUndoAvailable: (message: String, restore: () -> Unit) -> Unit = { _, _ -> },
) {
    val context = LocalContext.current
    var selectedHex by remember { mutableStateOf<String?>(null) }
    val ink = theme.ink.toColor()
    val muted = theme.muted.toColor()
    val faint = theme.faint.toColor()
    val accent = theme.accentOt.toColor()

    val entries: List<UnifiedNoteEntry> = remember(bookmarks.list, highlights?.store, locale) {
        val merged = LinkedHashMap<String, UnifiedNoteEntry>()
        val hlStore = highlights?.store ?: emptyMap()

        for (bm in bookmarks.list) {
            val k = "${bm.translationId}:${bm.bookId}:${bm.chapter}:${bm.verse}"
            val byIdx = hlStore[k] ?: emptyMap()
            val domHex = dominantPigment(byIdx) ?: VerseHighlightRules.DEFAULT_COLOR
            merged[k] = UnifiedNoteEntry(
                id = k,
                translationId = bm.translationId,
                bookId = bm.bookId,
                bookName = bm.bookName,
                chapter = bm.chapter,
                verse = bm.verse,
                text = bm.text,
                pigmentHex = domHex,
                isBookmarked = true,
                highlightMap = byIdx,
            )
        }

        for ((k, byIdx) in hlStore) {
            if (byIdx.isEmpty() || merged.containsKey(k)) continue
            val parts = k.split(":")
            if (parts.size != 4) continue
            val tid = parts[0]
            val bid = parts[1].uppercase()
            val ch = parts[2].toIntOrNull() ?: continue
            val vs = parts[3].toIntOrNull() ?: continue
            val book = BibleCatalog.book(bid) ?: continue
            val domHex = dominantPigment(byIdx) ?: VerseHighlightRules.DEFAULT_COLOR
            val verseText = ScriptureDatabase.open(context, tid)?.let { db ->
                try { db.loadChapter(bid, ch).firstOrNull { it.number == vs }?.text } finally { db.close() }
            } ?: ScriptureDatabase.open(context, AppLocale.primaryTranslationId(locale))?.let { db ->
                try { db.loadChapter(bid, ch).firstOrNull { it.number == vs }?.text } finally { db.close() }
            }.orEmpty()
            merged[k] = UnifiedNoteEntry(
                id = k,
                translationId = tid,
                bookId = bid,
                bookName = book.name(locale),
                chapter = ch,
                verse = vs,
                text = verseText,
                pigmentHex = domHex,
                isBookmarked = false,
                highlightMap = byIdx,
            )
        }
        merged.values.toList()
    }

    val filtered = remember(entries, selectedHex) {
        if (selectedHex == null) entries
        else entries.filter { it.pigmentHex.equals(selectedHex, ignoreCase = true) }
    }
    val displayed = if (limit != null) filtered.take(limit) else filtered

    val filterOptions = listOf(
        null to AppLocale.pick("全部", "All", locale),
        "#FFB103" to AppLocale.pick("灯油黄", "Amber", locale),
        "#A3B565" to AppLocale.pick("橄榄绿", "Olive", locale),
        "#4E86A0" to AppLocale.pick("青石蓝", "Slate", locale),
        "#C0625F" to AppLocale.pick("石榴红", "Garnet", locale),
    )

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                AppLocale.pick("摘录与印记", "Notes & Highlights", locale),
                color = ink,
                fontSize = 19.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f),
            )
            if (onOpenMore != null && entries.size > (limit ?: Int.MAX_VALUE)) {
                Row(
                    Modifier.clickableNoRipple(onOpenMore).padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    Text(AppLocale.pick("全部 (${entries.size})", "All (${entries.size})", locale), color = accent, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    MaterialIcon(MI.CHEVRON_RIGHT, 15f, accent)
                }
            }
        }

        // 四色古籍颜料筛选条
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            filterOptions.forEach { (hex, label) ->
                val active = selectedHex == hex
                Row(
                    Modifier
                        .clip(CircleShape)
                        .background(if (active) ink else theme.surface.toColor())
                        .border(0.8.dp, if (active) ink else theme.border.toColor(), CircleShape)
                        .clickableNoRipple { selectedHex = hex }
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    if (hex != null) {
                        Box(Modifier.size(9.dp).clip(CircleShape).background(hexColor(hex)))
                    }
                    Text(
                        label,
                        color = if (active) theme.surfaceSolid.toColor() else ink,
                        fontSize = 12.5.sp,
                        fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                    )
                }
            }
        }

        if (displayed.isEmpty()) {
            Text(
                AppLocale.pick("阅读时双击经文收藏，或长按经文点选四色颜料，都会安静收在这里。", "Double-tap a verse to save, or long-press to highlight in four antique pigments.", locale),
                color = faint,
                fontSize = 13.5.sp,
                lineHeight = 20.sp,
                modifier = Modifier.padding(vertical = 6.dp),
            )
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                displayed.forEach { entry ->
                    val bookDisplay = BibleCatalog.book(entry.bookId)?.name(locale) ?: entry.bookName
                    val transLabel = ScriptureTranslation.find(entry.translationId)?.label(locale) ?: entry.translationId
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(theme.surface.toColor())
                            .border(1.dp, theme.border.toColor(), RoundedCornerShape(16.dp))
                            .clickableNoRipple { onOpenVerse(entry.bookId, entry.chapter, entry.verse) }
                            .padding(14.dp),
                        verticalAlignment = Alignment.Top,
                    ) {
                        Box(
                            Modifier
                                .padding(top = 3.dp)
                                .width(3.dp)
                                .height(42.dp)
                                .clip(CircleShape)
                                .background(hexColor(entry.pigmentHex)),
                        )
                        Spacer(Modifier.width(11.dp))
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                            Text(
                                "$bookDisplay ${entry.chapter}:${entry.verse} · $transLabel",
                                color = muted,
                                fontSize = 12.5.sp,
                                fontWeight = FontWeight.SemiBold,
                            )
                            if (entry.text.isNotEmpty()) {
                                Text(
                                    entry.text,
                                    color = ink,
                                    fontSize = 15.sp,
                                    lineHeight = 23.sp,
                                    maxLines = 3,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (entry.text.isNotEmpty()) {
                                Box(
                                    Modifier.size(30.dp).clickableNoRipple {
                                        onShareCard(
                                            VerseSharePayload(
                                                reference = "$bookDisplay ${entry.chapter}:${entry.verse}",
                                                translationName = transLabel,
                                                text = entry.text,
                                            ),
                                        )
                                    },
                                    contentAlignment = Alignment.Center,
                                ) {
                                    MaterialIcon(MI.IOS_SHARE, 17f, muted)
                                }
                            }
                            Box(
                                Modifier.size(30.dp).clickableNoRipple {
                                    val savedBm = entry.isBookmarked
                                    val savedText = entry.text
                                    val savedHl = entry.highlightMap
                                    if (savedBm) {
                                        bookmarks.toggle(entry.bookId, entry.bookName, entry.chapter, entry.verse, entry.translationId, savedText)
                                    }
                                    if (savedHl.isNotEmpty() && highlights != null) {
                                        val maxIdx = savedHl.keys.maxOrNull() ?: 0
                                        highlights.paint(entry.translationId, entry.bookId, entry.chapter, entry.verse, 0..maxIdx, null)
                                    }
                                    onUndoAvailable(AppLocale.pick("已移除该条摘录", "Removed note", locale)) {
                                        if (savedBm) {
                                            bookmarks.toggle(entry.bookId, entry.bookName, entry.chapter, entry.verse, entry.translationId, savedText)
                                        }
                                        if (savedHl.isNotEmpty() && highlights != null) {
                                            for ((idx, hex) in savedHl) {
                                                highlights.paint(entry.translationId, entry.bookId, entry.chapter, entry.verse, idx..idx, hex)
                                            }
                                        }
                                    }
                                },
                                contentAlignment = Alignment.Center,
                            ) {
                                MaterialIcon(MI.CLOSE, 16f, faint)
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun dominantPigment(byIndex: Map<Int, String>): String? {
    if (byIndex.isEmpty()) return null
    return byIndex.values.groupingBy { VerseHighlightRules.normalizeColor(it) }.eachCount().maxByOrNull { it.value }?.key
}

@Composable
fun UndoCapsuleToast(
    message: String,
    locale: AppLocale,
    onUndo: () -> Unit,
) {
    Row(
        Modifier
            .clip(CircleShape)
            .background(Color(0xEB231B14))
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text(message, color = Color(0xFFF5EFE4), fontSize = 13.5.sp, fontWeight = FontWeight.Medium)
        Text(
            AppLocale.pick("撤销", "Undo", locale),
            Modifier.clickableNoRipple(onUndo),
            color = Color(0xFFFFC94D),
            fontSize = 13.5.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

/** 独立全部摘录与印记页（从圣经目录书签钮或书房「全部」进入） */
@Composable
fun FavoritesScreen(
    bookmarks: VerseBookmarkStore,
    highlights: VerseHighlightStore? = null,
    size: ReadSize,
    onBack: () -> Unit,
    onOpen: (VerseBookmark) -> Unit,
    onOpenVerse: ((String, Int, Int) -> Unit)? = null,
    theme: Parchment = Parchment.light,
    locale: AppLocale = AppLocale.ZH_CN,
) {
    val insets = WindowInsets.systemBars.asPaddingValues()
    var sharePayload by remember { mutableStateOf<VerseSharePayload?>(null) }
    var undoState by remember { mutableStateOf<Pair<String, () -> Unit>?>(null) }

    LaunchedEffect(undoState) {
        if (undoState != null) {
            delay(3400)
            undoState = null
        }
    }

    Box(Modifier.fillMaxSize()) {
        ParchmentBackground(theme = theme)
        LazyColumn(
            Modifier.fillMaxSize().parchmentFade(ParchmentFadePreset.TABBAR),
            contentPadding = PaddingValues(
                start = 20.dp,
                end = 20.dp,
                top = 14.dp + insets.calculateTopPadding(),
                bottom = TAB_BAR_CLEARANCE.dp + 36.dp + insets.calculateBottomPadding() + 90.dp,
            ),
        ) {
            item {
                Box(Modifier.size(40.dp).clickableNoRipple(onBack), contentAlignment = Alignment.CenterStart) {
                    MaterialIcon(MI.CHEVRON_LEFT, 26f, theme.ink.toColor())
                }
                Spacer(Modifier.height(6.dp))
                UnifiedNotesBlock(
                    bookmarks = bookmarks,
                    highlights = highlights,
                    locale = locale,
                    theme = theme,
                    limit = null,
                    onOpenVerse = { bid, ch, vs ->
                        if (onOpenVerse != null) onOpenVerse(bid, ch, vs)
                        else onOpen(VerseBookmark(bid, bid, ch, vs, AppLocale.primaryTranslationId(locale), "", 0.0))
                    },
                    onShareCard = { sharePayload = it },
                    onUndoAvailable = { msg, restore -> undoState = msg to restore },
                )
            }
        }

        AnimatedVisibility(
            visible = undoState != null,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = TAB_BAR_CLEARANCE.dp + insets.calculateBottomPadding() + 20.dp),
        ) {
            undoState?.let { (msg, restore) ->
                UndoCapsuleToast(msg, locale) {
                    restore()
                    undoState = null
                }
            }
        }

        sharePayload?.let { payload ->
            VerseShareCardSheet(payload = payload, locale = locale, theme = theme, onClose = { sharePayload = null })
        }
    }
}
