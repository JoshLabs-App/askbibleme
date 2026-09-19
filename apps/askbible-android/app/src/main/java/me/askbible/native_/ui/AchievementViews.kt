package me.askbible.native_.ui

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
    theme: Parchment = Parchment.light,
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

    Box(Modifier.size(size), contentAlignment = Alignment.Center) {
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
 * 常驻等级条：称号 + 等级 + 会动的 XP 进度 + 连续天数倍率。
 * 「一直在涨」的主要载体——XP 变化时条子推进，倍率 > 1 时挂一颗火苗角标。
 */
@Composable
fun XPBar(
    ach: AchievementStore,
    locale: AppLocale = AppLocale.current,
    theme: Parchment = Parchment.light,
    compact: Boolean = false,
) {
    val progress by animateFloatAsState(ach.levelProgress, tween(420), label = "xp")
    Column(verticalArrangement = Arrangement.spacedBy(if (compact) 4.dp else 6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Lv.${ach.level}", color = XPGold,
                 fontSize = (if (compact) 12 else 14).sp, fontWeight = FontWeight.ExtraBold)
            Spacer(Modifier.width(8.dp))
            Text(MedalLevels.title(ach.level, locale), color = theme.muted.toColor(),
                 fontSize = (if (compact) 12 else 14).sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.weight(1f))
            if (ach.streakMultiplier > 1.001) {
                Row(
                    Modifier.clip(CircleShape).background(StreakOrange.copy(alpha = 0.12f))
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Filled.LocalFireDepartment, null, Modifier.size(11.dp), tint = StreakOrange)
                    Spacer(Modifier.width(2.dp))
                    Text("×%.2f".format(ach.streakMultiplier), color = StreakOrange,
                         fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.width(8.dp))
            }
            Text("${ach.xpInLevel} / ${ach.xpForLevel}", color = theme.faint.toColor(),
                 fontSize = (if (compact) 11 else 12).sp, fontWeight = FontWeight.Medium)
        }
        Box(
            Modifier.fillMaxWidth().height(if (compact) 6.dp else 8.dp)
                .clip(CircleShape).background(theme.border.toColor().copy(alpha = 0.3f))
        ) {
            Box(
                Modifier.fillMaxWidth(progress.coerceAtLeast(0.02f)).height(if (compact) 6.dp else 8.dp)
                    .clip(CircleShape)
                    .background(Brush.horizontalGradient(listOf(XPGoldSoft, XPGold)))
            )
        }
    }
}

/** +XP 飘字：从下往上飘、放大再淡出。读 / 听的时候几秒就来一次，就是「一直有反馈」那个手感。 */
@Composable
fun XPFloater(ach: AchievementStore, modifier: Modifier = Modifier) {
    /** id 自增，用来给每条飘字各自挂一个「1.1 秒后消失」的协程 */
    var seq by remember { mutableStateOf(0) }
    var shown by remember { mutableStateOf<List<FloaterItem>>(emptyList()) }

    val context = LocalContext.current
    val head = ach.pending.firstOrNull()
    LaunchedEffect(head) {
        val xp = head as? AchievementStore.Event.Xp ?: return@LaunchedEffect
        ach.consume()
        seq += 1
        AchievementFeedback.play(context, AchievementFeedback.Cue.XP)
        shown = (shown + FloaterItem(seq, "+${xp.amount}", xp.amount >= MedalXP.perChapterRead)).takeLast(3)
    }

    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally,
           verticalArrangement = Arrangement.spacedBy(6.dp)) {
        for (item in shown) {
            androidx.compose.runtime.key(item.id) {
                // 每条各自计时：新飘字进来不该把上一条的消失计时打断
                LaunchedEffect(item.id) {
                    delay(1100)
                    shown = shown.filterNot { it.id == item.id }
                }
                var appeared by remember { mutableStateOf(false) }
                LaunchedEffect(item.id) { appeared = true }
                // 回弹进场（spring 比 tween 更「动态」），同时整条往上飘一截
                val scale by animateFloatAsState(
                    if (appeared) 1f else 0.4f,
                    spring(dampingRatio = 0.45f, stiffness = Spring.StiffnessMediumLow),
                    label = "pop",
                )
                val rise by animateFloatAsState(if (appeared) -10f else 14f, tween(1100), label = "rise")
                val alpha by animateFloatAsState(if (appeared) 1f else 0f, tween(200), label = "fade")
                Text(
                    item.text, color = XPGold,
                    fontSize = (if (item.big) 22 else 16).sp, fontWeight = FontWeight.ExtraBold,
                    modifier = Modifier.graphicsLayer {
                        scaleX = scale; scaleY = scale; translationY = rise; this.alpha = alpha
                    },
                )
            }
        }
    }
}

internal data class FloaterItem(val id: Int, val text: String, val big: Boolean)

/** 获得提示：勋章 / 印章 / 升级各弹一条，2.8 秒收起，点一下提前关 */
@Composable
fun EarnedToast(
    ach: AchievementStore,
    locale: AppLocale = AppLocale.current,
    theme: Parchment = Parchment.light,
    modifier: Modifier = Modifier,
) {
    val event = ach.pending.firstOrNull {
        it !is AchievementStore.Event.Xp && it !is AchievementStore.Event.ChapterRead
    }
    val d = event?.let { describeEarned(it, ach.level, locale) }

    val toastContext = LocalContext.current
    LaunchedEffect(event) {
        if (event == null) return@LaunchedEffect
        // 声音 + 触感：升级用三声上行钟，勋章 / 卷印用单声钟
        AchievementFeedback.play(
            toastContext,
            if (event is AchievementStore.Event.LevelUp) AchievementFeedback.Cue.LEVEL_UP
            else AchievementFeedback.Cue.EARN,
        )
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
                    .border(1.dp, XPGold.copy(alpha = 0.35f), RoundedCornerShape(16.dp))
                    .clickableNoRipple { event?.let { ach.consumeThrough(it) } }
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (d.image != null) {
                    MedalIcon(d.image, d.tier, d.tierCount, 48.dp, theme)
                } else {
                    Box(Modifier.size(48.dp).clip(CircleShape).background(XPGold.copy(alpha = 0.18f)),
                        contentAlignment = Alignment.Center) {
                        Text("Lv.${ach.level}", color = XPGold, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold)
                    }
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(d.title, color = theme.ink.toColor(), fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                    Text(d.subtitle, color = theme.faint.toColor(), fontSize = 13.sp,
                         maxLines = 2, overflow = TextOverflow.Ellipsis)
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
