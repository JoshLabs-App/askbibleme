package me.askbible.native_.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import me.askbible.native_.data.AchievementFeedback
import android.content.Context
import android.graphics.BitmapFactory
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material3.Icon
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
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import me.askbible.native_.data.AchievementStore
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.BibleCatalog
import me.askbible.native_.data.MedalCatalog
import me.askbible.native_.data.MedalDef
import me.askbible.native_.data.MedalLevels
import me.askbible.native_.data.MedalXP
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.SiteCopy
import me.askbible.native_.data.name
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/** 与 iOS MedalIcon 一致的档位配色：单档给金，多档从铜走到金 */
private val Bronze = Color(0xFFB87333)
private val Silver = Color(0xFFB9BFC6)
private val Gold = Color(0xFFE8B44A)
internal val XPGold = Color(0xFFFFB101)
private val XPGoldSoft = Color(0xFFFFC94D)
private val StreakOrange = Color(0xFFE06C2A)

/**
 * 勋章 / 印章图：R2 按需下载（512px WebP，约 55KB），存 cacheDir 下次直接读。
 * 不打进安装包（95 张共 6.2M），清掉了会自己重下。与 iOS `MedalImage` 对等。
 */
object MedalImages {
    private val memory = HashMap<String, ImageBitmap?>()

    private fun dir(context: Context): File =
        File(context.cacheDir, "medals").also { if (!it.exists()) it.mkdirs() }

    fun cached(context: Context, key: String): ImageBitmap? {
        memory[key]?.let { return it }
        if (memory.containsKey(key)) return null
        val f = File(dir(context), "$key.webp")
        if (!f.exists()) return null
        val bmp = runCatching { BitmapFactory.decodeFile(f.absolutePath)?.asImageBitmap() }.getOrNull()
        if (bmp != null) memory[key] = bmp
        return bmp
    }

    /** 下载并落盘；失败返回 null（下次进页面再试，不缓存失败） */
    suspend fun load(context: Context, key: String): ImageBitmap? = withContext(Dispatchers.IO) {
        cached(context, key)?.let { return@withContext it }
        val bytes = runCatching {
            val conn = URL(MedalCatalog.imageUrl(key)).openConnection() as HttpURLConnection
            conn.connectTimeout = 10_000
            conn.readTimeout = 20_000
            try {
                if (conn.responseCode != 200) return@runCatching null
                conn.inputStream.use { it.readBytes() }
            } finally { conn.disconnect() }
        }.getOrNull() ?: return@withContext null
        val bmp = runCatching { BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap() }.getOrNull()
            ?: return@withContext null
        runCatching { File(dir(context), "$key.webp").writeBytes(bytes) }
        memory[key] = bmp
        bmp
    }
}

/** 一枚勋章图：未获得显示压暗的灰度剪影，获得后按档位上铜 / 银 / 金的暖色 */
@Composable
fun MedalIcon(
    key: String,
    tier: Int = 0,
    tierCount: Int = 1,
    size: Dp = 64.dp,
    theme: Parchment = LocalParchment.current,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    var image by remember(key) { mutableStateOf(MedalImages.cached(context, key)) }
    LaunchedEffect(key) { if (image == null) image = MedalImages.load(context, key) }

    val tint = remember(tier, tierCount) {
        if (tier <= 0) Color.Transparent
        else {
            val t = if (tierCount <= 1) 1.0 else (tier - 1).toDouble() / (tierCount - 1).toDouble()
            if (t < 0.34) Bronze else if (t < 0.67) Silver else Gold
        }
    }
    val gray = remember { ColorMatrix().apply { setToSaturation(0f) } }

    Box(modifier.size(size), contentAlignment = Alignment.Center) {
        val bmp = image
        if (bmp != null) {
            Image(
                bitmap = bmp,
                contentDescription = null,
                modifier = Modifier.size(size),
                contentScale = ContentScale.Fit,
                alpha = if (tier > 0) 1f else 0.28f,
                colorFilter = if (tier > 0) null else ColorFilter.colorMatrix(gray),
            )
            if (tier > 0) {
                Image(
                    bitmap = bmp,
                    contentDescription = null,
                    modifier = Modifier.size(size),
                    contentScale = ContentScale.Fit,
                    alpha = 0.45f,
                    colorFilter = ColorFilter.tint(tint, BlendMode.SrcIn),
                )
            }
        } else {
            Box(Modifier.size(size * 0.86f).clip(CircleShape)
                    .background(theme.border.toColor().copy(alpha = 0.35f)))
        }
    }
}

/**
 * 去游戏化「手抄本藏书票」（对齐 iOS XPBar / ScriptoriumBookplate）：
 * 移除 Lv.X、XP 进度条与火焰连击倍率，展示「安静相伴(天) | 已读章节 | 书卷火漆印 X/66」及 5 枚代表性书卷浮雕印。
 */
@Composable
fun XPBar(
    ach: AchievementStore,
    locale: AppLocale = AppLocale.current,
    theme: Parchment = LocalParchment.current,
    compact: Boolean = false,
    readDaysOverride: Int? = null,
) {
    val calmDays = maxOf(readDaysOverride ?: 0, ach.streakDays)
    val previewBookIds = listOf("GEN", "EXO", "PSA", "ISA", "JHN")
    val ink = theme.ink.toColor()
    val muted = theme.muted.toColor()
    val accent = theme.accentOt.toColor()

    Column(verticalArrangement = Arrangement.spacedBy(if (compact) 10.dp else 14.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            BookplateStat(
                value = "$calmDays",
                label = AppLocale.pick("安静相伴 (天)", "Quiet Days", locale),
                valueColor = Color(0xFF4F7A54),
                muted = muted,
                modifier = Modifier.weight(1f),
            )
            Box(Modifier.width(1.dp).height(32.dp).background(theme.border.toColor()))
            BookplateStat(
                value = "${ach.chaptersReadCount}",
                label = AppLocale.pick("已读章节", "Chapters Read", locale),
                valueColor = ink,
                muted = muted,
                modifier = Modifier.weight(1f),
            )
            Box(Modifier.width(1.dp).height(32.dp).background(theme.border.toColor()))
            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Row(verticalAlignment = Alignment.Bottom) {
                    Text("${ach.seals.size}", color = accent, fontSize = 23.sp, fontWeight = FontWeight.Bold)
                    Text(" /66", color = ink.copy(alpha = 0.72f), fontSize = 13.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 2.dp))
                }
                Text(AppLocale.pick("书卷火漆印", "Book Seals", locale), color = muted, fontSize = 11.5.sp)
            }
        }

        if (!compact) {
            Box(Modifier.fillMaxWidth().height(0.5.dp).background(theme.border.toColor()))
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    previewBookIds.forEach { bid ->
                        val book = BibleCatalog.book(bid)
                        val n = book?.number ?: 1
                        val file = MedalCatalog.seals[n.coerceIn(1, MedalCatalog.seals.size) - 1]
                        val lit = ach.seals[bid] != null
                        MedalIcon(file, if (lit) 1 else 0, 1, 40.dp, theme)
                    }
                }
                Spacer(Modifier.weight(1f))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(AppLocale.pick("印鉴墙", "Seals", locale), color = ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    MaterialIcon(MI.CHEVRON_RIGHT, 16f, ink)
                }
            }
        }
    }
}

@Composable
private fun BookplateStat(value: String, label: String, valueColor: Color, muted: Color, modifier: Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(value, color = valueColor, fontSize = 23.sp, fontWeight = FontWeight.Bold)
        Text(label, color = muted, fontSize = 11.5.sp)
    }
}

/** 去游戏化后：静默消化队列里的 Xp / Streak / LevelUp / PlanDayDone 事件，不再弹出 +XP 飘字。 */
@Composable
fun XPFloater(ach: AchievementStore, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val head = ach.pending.firstOrNull()
    LaunchedEffect(head) {
        when (head) {
            is AchievementStore.Event.Xp -> {
                ach.consume()
                if (head.amount >= MedalXP.perChapterRead) {
                    AchievementFeedback.playXp(context, milestone = true)
                }
            }
            is AchievementStore.Event.Streak,
            is AchievementStore.Event.PlanDayDone,
            is AchievementStore.Event.LevelUp -> {
                ach.consume()
            }
            else -> Unit
        }
    }
}

internal data class FloaterItem(val id: Int, val text: String, val big: Boolean)

/** 获得提示：仅保留书卷火漆印与安静阅读里程碑提示，移除 Lv.X 升级横幅。 */
@Composable
fun EarnedToast(
    ach: AchievementStore,
    locale: AppLocale = AppLocale.current,
    theme: Parchment = LocalParchment.current,
    modifier: Modifier = Modifier,
) {
    val event = ach.pending.firstOrNull {
        it !is AchievementStore.Event.Xp &&
            it !is AchievementStore.Event.ChapterRead &&
            it !is AchievementStore.Event.Streak &&
            it !is AchievementStore.Event.PlanDayDone &&
            it !is AchievementStore.Event.LevelUp
    }
    val d = event?.let { describeEarned(it, ach.level, locale) }

    val toastContext = LocalContext.current
    LaunchedEffect(event) {
        if (event == null) return@LaunchedEffect
        AchievementFeedback.play(toastContext, AchievementFeedback.Cue.EARN)
        delay(2800)
        ach.consumeThrough(event)
    }

    AnimatedVisibility(
        visible = d != null,
        enter = slideInVertically { -it } + fadeIn(),
        exit = slideOutVertically { -it } + fadeOut(),
        modifier = modifier,
    ) {
        if (d != null) {
            Row(
                Modifier.fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(theme.surfaceSolid.toColor())
                    .border(1.dp, theme.borderStrong.toColor(), RoundedCornerShape(16.dp))
                    .clickableNoRipple { event?.let { ach.consumeThrough(it) } }
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (d.image != null) {
                    MedalIcon(d.image, d.tier, d.tierCount, 48.dp, theme)
                    Spacer(Modifier.width(12.dp))
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(d.title, color = theme.ink.toColor(), fontSize = 15.5.sp, fontWeight = FontWeight.SemiBold)
                    Text(d.subtitle, color = theme.muted.toColor(), fontSize = 13.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }
        }
    }
}

internal data class EarnedCopy(
    val title: String,
    val subtitle: String,
    val image: String?,
    val tier: Int,
    val tierCount: Int,
)

internal fun describeEarned(e: AchievementStore.Event, level: Int, locale: AppLocale): EarnedCopy = when (e) {
    is AchievementStore.Event.Medal -> {
        val def: MedalDef? = MedalCatalog.def(e.key)
        if (def == null) EarnedCopy("", "", null, 0, 1)
        else EarnedCopy(def.localizedName(locale), def.localizedCondition(e.tier, locale), e.key, e.tier, def.tiers.size)
    }
    is AchievementStore.Event.SealEarned -> {
        val book = BibleCatalog.book(e.bookId)
        val n = book?.number ?: 1
        val file = MedalCatalog.seals[n.coerceIn(1, MedalCatalog.seals.size) - 1]
        EarnedCopy(SiteCopy.t("native.sealEarned", locale), book?.name(locale) ?: e.bookId, file, 1, 1)
    }
    is AchievementStore.Event.LevelUp ->
        EarnedCopy(SiteCopy.f("native.levelUp", mapOf("level" to e.level.toString()), locale),
                   MedalLevels.title(e.level, locale), null, 0, 1)
    else -> EarnedCopy("", "", null, 0, 1)
}
