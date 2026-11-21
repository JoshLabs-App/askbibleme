package me.askbible.native_.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas as AndroidCanvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.Brand
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.ReadSize
import me.askbible.native_.data.ScriptureTranslation
import me.askbible.native_.data.VerseHighlightRules
import java.io.File
import java.io.FileOutputStream

data class VerseSharePayload(
    val reference: String,
    val translationName: String,
    val text: String,
)

/**
 * 羊皮卷金句书签分享卡弹层（对齐 iOS VerseShareCardSheet）：
 * 支持「浅色羊皮 / 夜读沉香」双底色切换、3x 高清书签图分享与纯文本复制。
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VerseShareCardSheet(
    payload: VerseSharePayload,
    locale: AppLocale,
    theme: Parchment = LocalParchment.current,
    onCopied: () -> Unit = {},
    onClose: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var darkCard by remember { mutableStateOf(theme.isDark) }
    val cardBg = if (darkCard) Color(0xFF1F1A15) else Color(0xFFF5EFE4)
    val cardBorder = if (darkCard) Color(0xFF3E3328) else Color(0xFFDCCCB2)
    val cardInk = if (darkCard) Color(0xFFEDE2CF) else Color(0xFF231A12)
    val cardMuted = if (darkCard) Color(0xFFA99A84) else Color(0xFF7B6751)
    val accent = Color(0xFFD97707)

    ModalBottomSheet(
        onDismissRequest = onClose,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = theme.surfaceSolid.toColor(),
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 22.dp, vertical = 8.dp)
                .padding(bottom = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // 书签卡片预览
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(22.dp))
                    .background(cardBg)
                    .border(1.dp, cardBorder, RoundedCornerShape(22.dp))
                    .padding(horizontal = 24.dp, vertical = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(Modifier.width(34.dp).height(2.5.dp).clip(CircleShape).background(accent))
                Spacer(Modifier.height(22.dp))
                Text(
                    payload.text,
                    color = cardInk,
                    fontSize = 18.sp,
                    lineHeight = 29.sp,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Start,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(24.dp))
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "${payload.reference} · ${payload.translationName}",
                        color = cardMuted,
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        "AskBible.me",
                        color = accent.copy(alpha = 0.85f),
                        fontSize = 11.5.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }

            // 浅色羊皮 / 夜读沉香切换
            Row(
                Modifier
                    .clip(CircleShape)
                    .background(theme.ink.toColor().copy(alpha = 0.08f))
                    .padding(3.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                listOf(false to AppLocale.pick("浅色羊皮", "Light Parchment", locale),
                       true to AppLocale.pick("夜读沉香", "Night Agarwood", locale)).forEach { (isDarkOpt, label) ->
                    val on = darkCard == isDarkOpt
                    Box(
                        Modifier
                            .clip(CircleShape)
                            .background(if (on) theme.surface.toColor() else Color.Transparent)
                            .clickableNoRipple { darkCard = isDarkOpt }
                            .padding(horizontal = 16.dp, vertical = 7.dp),
                    ) {
                        Text(label, color = if (on) theme.ink.toColor() else theme.muted.toColor(), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            // 主按钮：生成并分享高清书签图
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(theme.accentOt.toColor())
                    .clickableNoRipple {
                        scope.launch {
                            val uri = withContext(Dispatchers.IO) { renderBookmarkPng(context, payload, darkCard) }
                            if (uri != null) {
                                val intent = Intent(Intent.ACTION_SEND).apply {
                                    type = "image/png"
                                    putExtra(Intent.EXTRA_STREAM, uri)
                                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                }
                                context.startActivity(Intent.createChooser(intent, null))
                            }
                            onClose()
                        }
                    },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    AppLocale.pick("发送金句书签图", "Share Verse Card", locale),
                    color = Color(0xFFFFFBF4),
                    fontSize = 15.5.sp,
                    fontWeight = FontWeight.Bold,
                )
            }

            Text(
                AppLocale.pick("仅复制文字", "Copy Text Only", locale),
                Modifier.clickableNoRipple {
                    val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    cm.setPrimaryClip(ClipData.newPlainText("verse", "${payload.reference} ${payload.text}"))
                    onCopied()
                    onClose()
                }.padding(vertical = 4.dp),
                color = theme.muted.toColor(),
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Medium,
            )
        }
    }
}

private fun renderBookmarkPng(context: Context, payload: VerseSharePayload, dark: Boolean): android.net.Uri? = runCatching {
    val width = 1080
    val padH = 96f
    val textWidth = (width - padH * 2).toInt()
    val bodyPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
        color = if (dark) 0xFFEDE2CF.toInt() else 0xFF231A12.toInt()
        textSize = 52f
        typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
    }
    val layout = StaticLayout.Builder.obtain(payload.text, 0, payload.text.length, bodyPaint, textWidth)
        .setAlignment(Layout.Alignment.ALIGN_NORMAL)
        .setLineSpacing(22f, 1f)
        .build()

    val height = (220 + layout.height + 200).coerceAtLeast(680)
    val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = AndroidCanvas(bmp)
    val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = if (dark) 0xFF1F1A15.toInt() else 0xFFF5EFE4.toInt()
    }
    canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), bgPaint)

    val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 3f
        color = if (dark) 0xFF3E3328.toInt() else 0xFFDCCCB2.toInt()
    }
    canvas.drawRoundRect(RectF(36f, 36f, width - 36f, height - 36f), 42f, 42f, borderPaint)

    val barPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFD97707.toInt() }
    canvas.drawRoundRect(RectF(width / 2f - 54f, 108f, width / 2f + 54f, 116f), 4f, 4f, barPaint)

    canvas.save()
    canvas.translate(padH, 180f)
    layout.draw(canvas)
    canvas.restore()

    val footerY = height - 104f
    val refPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = if (dark) 0xFFA99A84.toInt() else 0xFF7B6751.toInt()
        textSize = 34f
        typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
    }
    canvas.drawText("${payload.reference} · ${payload.translationName}", padH, footerY, refPaint)

    val brandPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFFD97707.toInt()
        textSize = 32f
        textAlign = Paint.Align.RIGHT
        typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
    }
    canvas.drawText("AskBible.me", width - padH, footerY, brandPaint)

    val dir = File(context.cacheDir, "share").also { if (!it.exists()) it.mkdirs() }
    val outFile = File(dir, "askbible-verse-card.png")
    FileOutputStream(outFile).use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    bmp.recycle()
    FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", outFile)
}.getOrNull()

/**
 * 阅读页右上「Aa」排版与双语对照抽屉（对齐 iOS ReaderTypographySheet）：
 * 7 档柔和步进圆点字号 + 一键双语对照开关 + 译本面板入口。
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ReaderTypographySheet(
    size: ReadSize,
    onSelectSize: (ReadSize) -> Unit,
    bilingualEnabled: Boolean,
    secondaryLabel: String?,
    onToggleBilingual: (Boolean) -> Unit,
    onOpenFullTranslations: () -> Unit,
    locale: AppLocale,
    theme: Parchment = LocalParchment.current,
    onClose: () -> Unit,
) {
    val stops = listOf(ReadSize.XS, ReadSize.S, ReadSize.M, ReadSize.L, ReadSize.XL, ReadSize.XXL, ReadSize.XXXL)
    val currentStopIdx = stops.indexOf(size).let { if (it >= 0) it else 2 }
    val ink = theme.ink.toColor()
    val muted = theme.muted.toColor()
    val accent = theme.accentOt.toColor()

    ModalBottomSheet(
        onDismissRequest = onClose,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = theme.surfaceSolid.toColor(),
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 22.dp, vertical = 6.dp)
                .padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            Text(AppLocale.pick("阅读版式与对照", "Typography & Parallel", locale), color = ink, fontSize = 18.sp, fontWeight = FontWeight.Bold)

            // 7 档圆点字号步进器
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(theme.canvas.toColor().copy(alpha = 0.55f))
                    .border(1.dp, theme.border.toColor(), RoundedCornerShape(16.dp))
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("A", color = muted, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    Row(Modifier.weight(1f).padding(horizontal = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        stops.forEachIndexed { idx, s ->
                            val selected = idx == currentStopIdx
                            Box(
                                Modifier
                                    .size(32.dp)
                                    .clickableNoRipple { onSelectSize(s) },
                                contentAlignment = Alignment.Center,
                            ) {
                                Box(
                                    Modifier
                                        .size(if (selected) 16.dp else 8.dp)
                                        .clip(CircleShape)
                                        .background(if (selected) accent else theme.borderStrong.toColor()),
                                )
                            }
                        }
                    }
                    Text("A", color = ink, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                }
            }

            // 双语对照一键开关
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(theme.canvas.toColor().copy(alpha = 0.55f))
                    .border(1.dp, theme.border.toColor(), RoundedCornerShape(16.dp))
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(AppLocale.pick("双语对照阅读", "Parallel Bilingual", locale), color = ink, fontSize = 15.5.sp, fontWeight = FontWeight.SemiBold)
                    Text(
                        secondaryLabel ?: AppLocale.pick("逐节附排对照译本（古典旁注竖线）", "Verse-by-verse classical marginalia", locale),
                        color = muted,
                        fontSize = 12.5.sp,
                    )
                }
                Switch(
                    checked = bilingualEnabled,
                    onCheckedChange = onToggleBilingual,
                    colors = SwitchDefaults.colors(checkedTrackColor = accent),
                )
            }

            // 全部译本与双语选择面板入口
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(accent.copy(alpha = 0.12f))
                    .border(0.75.dp, accent.copy(alpha = 0.35f), RoundedCornerShape(14.dp))
                    .clickableNoRipple { onClose(); onOpenFullTranslations() }
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    AppLocale.pick("切换主译本与更多对照版本", "Choose Primary & Parallel Versions", locale),
                    color = ink,
                    fontSize = 14.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                MaterialIcon(MI.CHEVRON_RIGHT, 18f, accent)
            }
        }
    }
}

/**
 * 长按经文后一步直达的四色古籍颜料高亮 + 动作胶囊条（无需切换涂抹模式）：
 * 点任意圆点立即给该节染色（再次点同色即擦除），并提供「复制 · 收藏 · 书签图 · 多选」。
 */
@Composable
fun InstantVerseHighlightBar(
    verseNumber: Int,
    bookmarked: Boolean,
    currentHex: String?,
    locale: AppLocale,
    theme: Parchment = LocalParchment.current,
    onPickColor: (String?) -> Unit,
    onCopy: () -> Unit,
    onBookmark: () -> Unit,
    onShareCard: () -> Unit,
    onMultiSelect: () -> Unit,
    onDismiss: () -> Unit,
) {
    val ink = theme.ink.toColor()
    val muted = theme.muted.toColor()
    Box(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 14.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            Modifier
                .clip(RoundedCornerShape(20.dp))
                .background(theme.surfaceSolid.toColor())
                .border(1.dp, theme.borderStrong.toColor(), RoundedCornerShape(20.dp))
                .padding(horizontal = 14.dp, vertical = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    AppLocale.pick("第 $verseNumber 节", "v.$verseNumber", locale),
                    color = muted,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                VerseHighlightRules.PALETTE.forEach { hex ->
                    val selected = currentHex?.equals(hex, ignoreCase = true) == true
                    Box(
                        Modifier
                            .size(28.dp)
                            .clip(CircleShape)
                            .background(hexColor(hex))
                            .border(if (selected) 2.2.dp else 0.8.dp, if (selected) ink else Color.Black.copy(alpha = 0.16f), CircleShape)
                            .clickableNoRipple { onPickColor(if (selected) null else hex) },
                    )
                }
                if (currentHex != null) {
                    Box(
                        Modifier
                            .size(26.dp)
                            .clip(CircleShape)
                            .background(theme.ink.toColor().copy(alpha = 0.08f))
                            .clickableNoRipple { onPickColor(null) },
                        contentAlignment = Alignment.Center,
                    ) {
                        MaterialIcon(MI.CLOSE, 14f, muted)
                    }
                }
                Spacer(Modifier.width(2.dp))
                Box(Modifier.size(24.dp).clickableNoRipple(onDismiss), contentAlignment = Alignment.Center) {
                    MaterialIcon(MI.EXPAND_MORE, 18f, muted)
                }
            }

            Box(Modifier.fillMaxWidth().height(0.5.dp).background(theme.border.toColor()))

            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                InstantActionChip(MI.CONTENT_COPY, AppLocale.pick("复制", "Copy", locale), ink, onCopy)
                InstantActionChip(
                    if (bookmarked) MI.BOOKMARK else MI.BOOKMARK_BORDER,
                    if (bookmarked) AppLocale.pick("已收藏", "Saved", locale) else AppLocale.pick("收藏", "Save", locale),
                    if (bookmarked) Brand.logo.toColor() else ink,
                    onBookmark,
                )
                InstantActionChip(MI.IOS_SHARE, AppLocale.pick("书签图", "Card", locale), ink, onShareCard)
                InstantActionChip(MI.LIBRARY_ADD_CHECK, AppLocale.pick("多选", "Select", locale), ink, onMultiSelect)
            }
        }
    }
}

@Composable
private fun InstantActionChip(glyph: String, label: String, color: Color, onClick: () -> Unit) {
    Row(
        Modifier.clickableNoRipple(onClick).padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        MaterialIcon(glyph, 16f, color)
        Text(label, color = color, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
    }
}
