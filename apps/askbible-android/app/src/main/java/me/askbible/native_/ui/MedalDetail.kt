package me.askbible.native_.ui

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas as AndroidCanvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.os.Build
import android.provider.MediaStore
import android.widget.Toast
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.MedalCatalog
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.SiteCopy
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.min

/**
 * 成就大图：点成就墙上的勋章 / 书卷印章弹出来，光束转、奖牌弹出，底下可以写自己的名字，
 * 已获得的能做成一张 1080×1350 的分享图，直接分享或存相册。
 *
 * 版式抄的是「听到」(03MyClass) 的 MedalDetail —— Josh 2026-09-23「要跟听到一样」。
 * 区别只有配色：那边是暖棕，这边跟羊皮卷（canvas #ECD9B9 / ink #1C1410 / 金 #FFB103）。
 *
 * 名字只存本机（SharedPreferences askbible-profile），不进会员同步 —— 它只是印在图上的落款。
 */
data class MedalDetail(
    val key: String,
    val name: String,
    val earned: Boolean,
    val tier: String,
    val caption: String,
    val fraction: Float,
)

// ---------- 落款名字 ----------
private const val PROFILE_PREFS = "askbible-profile"
private const val PROFILE_NAME = "displayName"

fun savedDisplayName(ctx: Context): String =
    ctx.getSharedPreferences(PROFILE_PREFS, Context.MODE_PRIVATE).getString(PROFILE_NAME, "").orEmpty()

fun saveDisplayName(ctx: Context, v: String) {
    ctx.getSharedPreferences(PROFILE_PREFS, Context.MODE_PRIVATE)
        .edit().putString(PROFILE_NAME, v.trim().take(16)).apply()
}

// ---------- 大图 ----------
@Composable
fun MedalDetailDialog(
    d: MedalDetail,
    locale: AppLocale = AppLocale.current,
    theme: Parchment = Parchment.light,
    onDismiss: () -> Unit,
) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf(savedDisplayName(ctx)) }
    var editing by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }

    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { shown = true }
    // 弹出来是「翻出来」的感觉：回弹放大 + 淡入，光束慢慢转
    val pop by animateFloatAsState(
        if (shown) 1f else 0.35f,
        spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow),
        label = "pop",
    )
    val fade by animateFloatAsState(if (shown) 1f else 0f, tween(260), label = "fade")
    val spin by rememberInfiniteTransition(label = "rays").animateFloat(
        0f, 360f, infiniteRepeatable(tween(14000, easing = LinearEasing)), label = "spin",
    )

    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(
            Modifier.fillMaxSize()
                .background(theme.modalBackdrop.toColor())
                .clickableNoRipple(onDismiss),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                Modifier.padding(20.dp).widthIn(max = 380.dp).fillMaxWidth()
                    .scale(pop).alpha(fade)
                    .background(theme.surfaceSolid.toColor(), RoundedCornerShape(26.dp))
                    .border(1.dp, theme.border.toColor(), RoundedCornerShape(26.dp))
                    // 卡片自己吃掉点击，不然点卡片也会关掉
                    .clickableNoRipple {}
                    .padding(horizontal = 22.dp, vertical = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Box(Modifier.size(230.dp), contentAlignment = Alignment.Center) {
                    if (d.earned) {
                        Canvas(Modifier.fillMaxSize().rotate(spin)) {
                            val r = size.minDimension / 2
                            repeat(24) { i ->
                                if (i % 2 == 0) drawArc(
                                    Color(0x45D97707), i * 15f, 7f, true,
                                    Offset(size.width / 2 - r, size.height / 2 - r), Size(r * 2, r * 2),
                                )
                            }
                        }
                        Box(
                            Modifier.size(200.dp).background(
                                Brush.radialGradient(listOf(Color(0xCCFFF0CE), Color(0x00FFF0CE))), CircleShape,
                            ),
                        )
                    }
                    MedalIcon(d.key, if (d.earned) 3 else 0, 3, 168.dp, theme,
                              modifier = Modifier.alpha(if (d.earned) 1f else 0.5f))
                }
                Text(d.name, fontSize = 24.sp, fontWeight = FontWeight.SemiBold,
                     color = theme.ink.toColor(), textAlign = TextAlign.Center)
                Text(d.tier, fontSize = 15.sp, fontWeight = FontWeight.SemiBold,
                     color = (if (d.earned) theme.accentOt else theme.muted).toColor())
                if (d.caption.isNotEmpty()) {
                    Text(d.caption, fontSize = 13.sp, color = theme.muted.toColor(), textAlign = TextAlign.Center)
                }
                if (!d.earned) {
                    Box(
                        Modifier.padding(top = 10.dp).width(220.dp).height(5.dp)
                            .clip(CircleShape).background(theme.border.toColor().copy(alpha = 0.3f)),
                    ) {
                        Box(
                            Modifier.fillMaxWidth(d.fraction.coerceAtLeast(0.02f)).height(5.dp)
                                .clip(CircleShape).background(XPGold.copy(alpha = 0.85f)),
                        )
                    }
                }

                Text(
                    if (name.isNotBlank()) name else SiteCopy.t("native.medalNamePrompt", locale),
                    fontSize = 15.sp, color = theme.ink.toColor(), textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 12.dp)
                        .clip(CircleShape)
                        .background(theme.hover.toColor())
                        .clickableNoRipple { editing = true }
                        .padding(horizontal = 16.dp, vertical = 7.dp),
                )

                if (d.earned) {
                    Row(Modifier.padding(top = 14.dp).fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        MedalActionButton(
                            if (busy) SiteCopy.t("native.medalShareBusy", locale)
                            else SiteCopy.t("native.medalShare", locale),
                            Modifier.weight(1f), theme, enabled = !busy,
                        ) {
                            busy = true
                            scope.launch { shareMedalCard(ctx, d, name, locale, save = false); busy = false }
                        }
                        MedalActionButton(
                            SiteCopy.t("native.medalSaveToAlbum", locale),
                            Modifier.weight(1f), theme, ghost = true, enabled = !busy,
                        ) {
                            busy = true
                            scope.launch { shareMedalCard(ctx, d, name, locale, save = true); busy = false }
                        }
                    }
                } else {
                    Text(SiteCopy.t("native.medalLockedShareHint", locale), fontSize = 13.sp,
                         color = theme.muted.toColor(), textAlign = TextAlign.Center,
                         modifier = Modifier.padding(top = 14.dp))
                }
            }
        }
    }

    if (editing) {
        var draft by remember { mutableStateOf(name) }
        AlertDialog(
            onDismissRequest = { editing = false },
            containerColor = theme.surfaceSolid.toColor(),
            title = {
                Text(SiteCopy.t("native.medalNameTitle", locale), fontSize = 17.sp,
                     fontWeight = FontWeight.SemiBold, color = theme.ink.toColor())
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(SiteCopy.t("native.medalNameHint", locale), fontSize = 13.sp, color = theme.muted.toColor())
                    BasicTextField(
                        draft, { draft = it.take(16) }, singleLine = true,
                        textStyle = TextStyle(color = theme.ink.toColor(), fontSize = 16.sp),
                        cursorBrush = SolidColor(theme.accentOt.toColor()),
                        modifier = Modifier.fillMaxWidth()
                            .background(theme.hover.toColor(), RoundedCornerShape(12.dp)).padding(12.dp),
                    )
                }
            },
            confirmButton = {
                TextButton({ saveDisplayName(ctx, draft); name = draft.trim().take(16); editing = false }) {
                    Text(SiteCopy.t("native.save", locale), color = theme.accentOt.toColor())
                }
            },
            dismissButton = {
                TextButton({ editing = false }) {
                    Text(SiteCopy.t("native.cancel", locale), color = theme.muted.toColor())
                }
            },
        )
    }
}

@Composable
private fun MedalActionButton(
    label: String,
    modifier: Modifier = Modifier,
    theme: Parchment,
    ghost: Boolean = false,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Box(
        modifier
            .clip(RoundedCornerShape(14.dp))
            .background(if (ghost) Color.Transparent else theme.accentOt.toColor().copy(alpha = if (enabled) 1f else 0.5f))
            .then(if (ghost) Modifier.border(1.dp, theme.border.toColor(), RoundedCornerShape(14.dp)) else Modifier)
            .clickableNoRipple { if (enabled) onClick() }
            .padding(vertical = 12.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, fontSize = 15.sp, fontWeight = FontWeight.SemiBold,
             color = if (ghost) theme.ink.toColor() else Color.White,
             maxLines = 1, textAlign = TextAlign.Center)
    }
}

// ---------- 分享 ----------

private suspend fun shareMedalCard(
    ctx: Context, d: MedalDetail, name: String, locale: AppLocale, save: Boolean,
) {
    val bmp = withContext(Dispatchers.IO) { runCatching { medalCardBitmap(ctx, d, name, locale) }.getOrNull() }
    if (bmp == null) {
        Toast.makeText(ctx, SiteCopy.t("native.medalShareFailed", locale), Toast.LENGTH_SHORT).show()
        return
    }
    if (save) {
        val ok = withContext(Dispatchers.IO) { saveToGallery(ctx, bmp) }
        Toast.makeText(
            ctx,
            SiteCopy.t(if (ok) "native.medalShareSaved" else "native.medalShareSaveFailed", locale),
            Toast.LENGTH_SHORT,
        ).show()
        return
    }
    val uri = withContext(Dispatchers.IO) {
        val dir = File(ctx.cacheDir, "share").apply { mkdirs() }
        val f = File(dir, "medal.png")
        FileOutputStream(f).use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
        FileProvider.getUriForFile(ctx, ctx.packageName + ".fileprovider", f)
    }
    val intent = Intent(Intent.ACTION_SEND).setType("image/png")
        .putExtra(Intent.EXTRA_STREAM, uri)
        .putExtra(Intent.EXTRA_TEXT, medalShareText(d, name, locale))
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    ctx.startActivity(Intent.createChooser(intent, null))
}

fun medalShareText(d: MedalDetail, name: String, locale: AppLocale = AppLocale.current): String {
    val who = if (name.isBlank()) "" else "$name "
    val tier = if (d.tier.isBlank()) "" else " · ${d.tier}"
    return SiteCopy.f("native.medalShareText", mapOf("who" to who, "name" to d.name, "tier" to tier), locale) +
        "\nhttps://askbible.me\nhttps://askbible-media.joshlabs.app/download.html"
}

private fun saveToGallery(ctx: Context, bmp: Bitmap): Boolean = runCatching {
    // Android 10 起写相册不用存储权限（RELATIVE_PATH + MediaStore）；9 及以下不做，
    // 免得为了一张分享图去要 WRITE_EXTERNAL_STORAGE —— 那种权限弹窗吓退的人比省下的多。
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return false
    val values = ContentValues().apply {
        put(MediaStore.Images.Media.DISPLAY_NAME, "askbible-${System.currentTimeMillis()}.png")
        put(MediaStore.Images.Media.MIME_TYPE, "image/png")
        put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/AskBible")
    }
    val uri = ctx.contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values) ?: return false
    ctx.contentResolver.openOutputStream(uri)!!.use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    true
}.getOrDefault(false)

/** 原始位图（Compose 的 ImageBitmap 画不进 android.graphics.Canvas，这里单独取一份） */
private fun rawMedalBitmap(ctx: Context, key: String): Bitmap? {
    val f = File(File(ctx.cacheDir, "medals"), "$key.webp")
    if (f.exists()) runCatching { BitmapFactory.decodeFile(f.absolutePath) }.getOrNull()?.let { return it }
    return runCatching {
        val conn = URL(MedalCatalog.imageUrl(key)).openConnection() as HttpURLConnection
        conn.connectTimeout = 8000
        conn.readTimeout = 8000
        conn.inputStream.use { BitmapFactory.decodeStream(it) }
    }.getOrNull()
}

/** 分享图：1080×1350，羊皮卷底 + 光束 + 奖牌 + 名称/档位 + 落款 + 两个链接 */
private fun medalCardBitmap(ctx: Context, d: MedalDetail, name: String, locale: AppLocale): Bitmap {
    val w = 1080
    val h = 1350
    val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val g = AndroidCanvas(bmp)
    val serif = Typeface.create(Typeface.SERIF, Typeface.NORMAL)
    val serifBold = Typeface.create(Typeface.SERIF, Typeface.BOLD)
    val p = Paint(Paint.ANTI_ALIAS_FLAG)

    // 羊皮卷底：浅纸 → canvas #ECD9B9
    p.shader = LinearGradient(
        0f, 0f, w * 0.3f, h.toFloat(),
        intArrayOf(0xFFFFFCF5.toInt(), 0xFFF5EBE0.toInt(), 0xFFECD9B9.toInt()),
        floatArrayOf(0f, 0.55f, 1f), Shader.TileMode.CLAMP,
    )
    g.drawRect(0f, 0f, w.toFloat(), h.toFloat(), p)
    p.shader = null

    val cx = w / 2f
    val cy = 560f
    val rays = RectF(cx - 470f, cy - 470f, cx + 470f, cy + 470f)
    for (i in 0 until 24) {
        p.color = if (i % 2 == 0) 0x8CFFFFFF.toInt() else 0x24D97707
        g.drawArc(rays, i * 15f, 6.4f, true, p)
    }
    p.shader = RadialGradient(cx, cy, 380f, 0xEBFFFFFF.toInt(), 0x00FFFFFF, Shader.TileMode.CLAMP)
    g.drawCircle(cx, cy, 380f, p)
    p.shader = null

    p.typeface = serif
    p.textAlign = Paint.Align.CENTER
    p.color = 0xFF8A6A33.toInt()
    p.textSize = 34f
    g.drawText(SiteCopy.t("native.medalCardBrand", locale), cx, 128f, p)
    p.strokeWidth = 2f
    p.color = 0x598A6A33
    g.drawLine(cx - 60f, 158f, cx + 60f, 158f, p)

    rawMedalBitmap(ctx, d.key)?.let { art ->
        val box = 520f
        val k = min(box / art.width, box / art.height)
        val dw = art.width * k
        val dh = art.height * k
        g.drawBitmap(art, null, RectF(cx - dw / 2, cy - dh / 2, cx + dw / 2, cy + dh / 2),
                     Paint(Paint.FILTER_BITMAP_FLAG))
    }

    p.typeface = serifBold
    p.color = 0xFF1C1410.toInt()
    p.textSize = 76f
    g.drawText(d.name, cx, 960f, p)
    p.typeface = serif
    if (d.tier.isNotEmpty()) {
        p.color = 0xFFD97707.toInt()
        p.textSize = 40f
        g.drawText(d.tier, cx, 1024f, p)
    }
    if (name.isNotBlank()) {
        p.textSize = 38f
        val tw = p.measureText(name)
        val box = RectF(cx - tw / 2 - 34f, 1062f, cx + tw / 2 + 34f, 1136f)
        p.color = 0xBFFFFFFF.toInt()
        p.style = Paint.Style.FILL
        g.drawRoundRect(box, 37f, 37f, p)
        p.color = 0x4DD97707
        p.style = Paint.Style.STROKE
        p.strokeWidth = 2f
        g.drawRoundRect(box, 37f, 37f, p)
        p.style = Paint.Style.FILL
        p.color = 0xFF5C4030.toInt()
        g.drawText(name, cx, 1112f, p)
    }
    p.color = 0xE65C4030.toInt()
    p.textSize = 32f
    g.drawText("askbible.me", cx, 1222f, p)
    p.color = 0x9E5C4030.toInt()
    p.textSize = 28f
    g.drawText("askbible-media.joshlabs.app/download.html", cx, 1272f, p)
    return bmp
}
