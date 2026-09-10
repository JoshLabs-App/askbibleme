package me.askbible.native_.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import me.askbible.native_.data.AmbientScenes
import me.askbible.native_.data.Brand
import me.askbible.native_.data.GoldenVerse
import me.askbible.native_.data.HomeVerseTypography
import me.askbible.native_.data.NatureScene
import me.askbible.native_.data.NatureScenes
import me.askbible.native_.data.ShellMetrics

/** RN homeNatureLayoutMetrics / homeNatureScreenConstants 逐值 */
private object HomeMetrics {
    const val EDGE_PAD = 16f            // HOME_SCENE_STRIP_EDGE_PAD
    const val ICON_GAP = 16f            // AMBIENT_ICON_GAP
    const val ROW_GAP = 22f             // HOME_BOTTOM_ICON_ROW_GAP
    const val BAND_PAD_TOP = 12f        // HOME_NATURE_BOTTOM_BAND_PAD_TOP
    const val AMBIENT_ICON = 36f        // AMBIENT_ICON_SIZE（芯片 = 图标）
    const val SCALE_TIMER_ROW_H = 36f   // HOME_SCALE_TIMER_ROW_H
    const val SCALE_TIMER_ICON = 26f
    const val THUMB = 64f               // HOME_SCENE_THUMB_SIZE
    const val THUMB_SLOT_PAD = 10f      // HOME_SCENE_THUMB_SLOT_PAD
    const val THUMB_GAP = 10f
    const val SCENE_ROW_PAD_BOTTOM = 6f
    const val ALBUM_BTN = 52f           // HOME_ALBUM_BTN_SIZE
    const val ALBUM_GAP = 28f           // transportMainGap
    const val TOOLS_AUTO_CLOSE_MS = 7000L
}

/**
 * 首页：全屏场景视频 / 柔焦静帧 + 金句 + 底部「场景与音效」带。与 RN HomeNatureScreen 对等：
 * 右上齿轮展开 字号/定时 行、环境音九槽、场景条（首格「模糊」），闲置 7 秒自动收起；
 * 最下一排是 放松专辑 / 金句朗读 / 休闲专辑 三个开关（HomeNatureAlbumStrip）。
 */
@Composable
fun HomeScreen(
    verse: GoldenVerse,
    textScale: Float,
    sceneId: String,
    scenes: List<NatureScene>,
    liveVideo: Boolean,
    ambientSlotId: String?,
    voiceOn: Boolean,
    /** 金句朗读只有和合本 / WEBP 两套：显示的是别的版本（法语等）时没有对得上的朗读，喇叭不出 */
    voiceAvailable: Boolean = true,
    /** 正在出声的专辑名（没在放 = null） */
    playingAlbum: String?,
    sleepTimerMinutes: Int,
    onSelectScene: (String) -> Unit,
    onToggleLiveVideo: () -> Unit,
    onToggleAmbient: (String) -> Unit,
    onBumpTextScale: (Int) -> Unit,
    onCycleSleepTimer: () -> Unit,
    onToggleVoice: () -> Unit,
    onPressAlbum: (String) -> Unit,
    onOpenMenu: () -> Unit,
) {
    var toolsOpen by remember { mutableStateOf(false) }
    var idleEpoch by remember { mutableIntStateOf(0) }
    val touch = { idleEpoch += 1 }
    LaunchedEffect(toolsOpen, idleEpoch) {
        if (!toolsOpen) return@LaunchedEffect
        delay(HomeMetrics.TOOLS_AUTO_CLOSE_MS)
        toolsOpen = false
    }

    Box(Modifier.fillMaxSize().background(Color(0xFF1A1512))) {
        // 底图：柔焦静帧一直垫着，live 时视频出首帧后盖上来
        val poster = rememberAssetImage(
            if (liveVideo) NatureScenes.posterAsset(sceneId)
            else NatureScenes.softPosterAsset(sceneId))
        if (poster != null) {
            Image(poster, contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        }
        if (liveVideo) HomeSceneVideo(sceneId, Modifier.fillMaxSize())

        // 顶部渐变，保图标可读
        Box(Modifier.fillMaxWidth().height(180.dp).background(
            Brush.verticalGradient(listOf(Color(0x6B1C1410), Color.Transparent))))

        Column(Modifier.fillMaxSize().statusBarsPadding()) {
            Row(
                Modifier.fillMaxWidth().padding(
                    horizontal = ShellMetrics.topChromeSideInset.dp,
                    vertical = ShellMetrics.topChromeOffset.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                // RN ShellMenuButton menu 28 / HomeNatureScreenTopChrome settings 28（展开或环境音开着时点亮）
                ChromeButton(MI.MENU, Color.White, onOpenMenu)
                val settingsLit = toolsOpen || ambientSlotId != null
                ChromeButton(MI.SETTINGS, if (settingsLit) Brand.logo.toColor() else Color.White) {
                    touch(); toolsOpen = !toolsOpen
                }
            }

            Column(
                Modifier.fillMaxWidth().padding(horizontal = 22.dp, vertical = 40.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                val shadow = Shadow(Color(0x8C000000), Offset(0f, 2f), 8f)
                Text(
                    verse.text,
                    style = TextStyle(
                        color = Color.White,
                        fontSize = HomeVerseTypography.bodySize(textScale).sp,
                        lineHeight = HomeVerseTypography.bodyLineHeight(textScale).sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                        shadow = shadow,
                    ),
                )
                Spacer(Modifier.height(HomeVerseTypography.refTopGap(textScale).dp))
                Text(
                    verse.reference,
                    style = TextStyle(
                        color = Color.White,
                        fontSize = HomeVerseTypography.refSize(textScale).sp,
                        lineHeight = HomeVerseTypography.refLineHeight(textScale).sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                        shadow = shadow,
                    ),
                )
            }

            Spacer(Modifier.weight(1f))

            // bottomBand：paddingTop 12，各排之间 22
            Column(
                Modifier.fillMaxWidth().padding(top = HomeMetrics.BAND_PAD_TOP.dp),
                verticalArrangement = Arrangement.spacedBy(HomeMetrics.ROW_GAP.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                if (toolsOpen) {
                    ScaleTimerRow(
                        atMin = false, sleepTimerMinutes = sleepTimerMinutes,
                        onBump = { touch(); onBumpTextScale(it) },
                        onTimer = { touch(); onCycleSleepTimer() },
                    )
                    AmbientRow(ambientSlotId) { touch(); onToggleAmbient(it) }
                    SceneStrip(scenes, sceneId, liveVideo,
                        onPick = { touch(); onSelectScene(it) },
                        onToggleLive = { touch(); onToggleLiveVideo() })
                }
                // HomeNatureAlbumStrip：安静 / 金句 / 下午茶，52 触控、间距 28、图标 36
                Row(
                    Modifier.height(HomeMetrics.ALBUM_BTN.dp),
                    horizontalArrangement = Arrangement.spacedBy(HomeMetrics.ALBUM_GAP.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    AlbumButton(MCI.MUSIC_NOTE_OUTLINE, community = true, on = playingAlbum == "安静") { touch(); onPressAlbum("安静") }
                    if (voiceAvailable) AlbumButton(MI.VOLUME_UP, on = voiceOn) { touch(); onToggleVoice() }
                    AlbumButton(MCI.COFFEE_OUTLINE, community = true, on = playingAlbum == "下午茶") { touch(); onPressAlbum("下午茶") }
                }
            }
            Spacer(Modifier.height(shellTabBarBottomInset() + (ShellMetrics.tabRowHeight + 38f).dp))
        }
    }
}

@Composable
private fun ChromeButton(glyph: String, color: Color, onClick: () -> Unit) {
    Box(Modifier.size(ShellMetrics.topChromeButton.dp).clickableNoRipple(onClick),
        contentAlignment = Alignment.Center) {
        MaterialIcon(glyph, 28f, color, shadow = true)
    }
}

@Composable
private fun AlbumButton(glyph: String, community: Boolean = false, on: Boolean, onClick: () -> Unit) {
    Box(Modifier.size(HomeMetrics.ALBUM_BTN.dp).clickableNoRipple(onClick), contentAlignment = Alignment.Center) {
        MaterialIcon(glyph, ShellMetrics.tabIconSize, if (on) Brand.logo.toColor() else Color.White,
                     community = community, shadow = true)
    }
}

/** HomeVerseScaleTimerControl：减 / 加 / 定时（定时开着亮黄并角标分钟数） */
@Composable
private fun ScaleTimerRow(atMin: Boolean, sleepTimerMinutes: Int, onBump: (Int) -> Unit, onTimer: () -> Unit) {
    val idle = Color.White.copy(alpha = 0.78f)
    Row(
        Modifier.height(HomeMetrics.SCALE_TIMER_ROW_H.dp),
        horizontalArrangement = Arrangement.spacedBy(HomeMetrics.ICON_GAP.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(HomeMetrics.SCALE_TIMER_ROW_H.dp).clickableNoRipple { onBump(-1) }, contentAlignment = Alignment.Center) {
            MaterialIcon(MI.REMOVE, HomeMetrics.SCALE_TIMER_ICON, idle)
        }
        Box(Modifier.size(HomeMetrics.SCALE_TIMER_ROW_H.dp).clickableNoRipple { onBump(1) }, contentAlignment = Alignment.Center) {
            MaterialIcon(MI.ADD, HomeMetrics.SCALE_TIMER_ICON, idle)
        }
        Box(Modifier.size(HomeMetrics.SCALE_TIMER_ROW_H.dp).clickableNoRipple(onTimer), contentAlignment = Alignment.Center) {
            val on = sleepTimerMinutes > 0
            MaterialIcon(MI.TIMER, HomeMetrics.SCALE_TIMER_ICON, if (on) Brand.logo.toColor() else idle)
            if (on) {
                // quickControlTimerBadge：右上角 -2/-6，黑 .55 圆角 8，黄字 10/700
                Box(
                    Modifier.align(Alignment.TopEnd).offset(x = 6.dp, y = (-2).dp)
                        .clip(RoundedCornerShape(8.dp)).background(Color(0x8C000000))
                        .padding(horizontal = 3.dp, vertical = 1.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(sleepTimerMinutes.toString(), color = Brand.logo.toColor(), fontSize = 10.sp,
                         lineHeight = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

private fun ambientGlyph(id: String): String = when (id) {
    "scene-water" -> MCI.WATER
    "scene-rain" -> MCI.WEATHER_RAINY
    "scene-birds" -> MCI.BIRD
    "scene-white-noise" -> MCI.RADIO_TOWER
    "scene-wind" -> MCI.WEATHER_WINDY
    "scene-fire" -> MCI.FIRE
    "scene-waves" -> MCI.WAVES
    "scene-thunder" -> MCI.WEATHER_LIGHTNING
    else -> MCI.COFFEE
}

/** 环境音九槽横条：选中黄 + 放大 1.06，其余白 .6 */
@Composable
private fun AmbientRow(active: String?, onToggle: (String) -> Unit) {
    val state = rememberLazyListState()
    var viewportW by remember { mutableIntStateOf(0) }
    val slots = AmbientScenes.slots
    CenterOnSelected(state, slots.indexOfFirst { it.id == active }, viewportW, HomeMetrics.AMBIENT_ICON)
    LazyRow(
        state = state,
        modifier = Modifier.fillMaxWidth().height(HomeMetrics.AMBIENT_ICON.dp).onSizeChanged { viewportW = it.width },
        contentPadding = PaddingValues(horizontal = HomeMetrics.EDGE_PAD.dp),
        horizontalArrangement = Arrangement.spacedBy(HomeMetrics.ICON_GAP.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        items(slots.size) { i ->
            val slot = slots[i]
            val selected = slot.id == active
            Box(
                Modifier.size(HomeMetrics.AMBIENT_ICON.dp)
                    .scale(if (selected) 1.06f else 1f)
                    .alpha(if (selected) 1f else 0.6f)
                    .clickableNoRipple { onToggle(slot.id) },
                contentAlignment = Alignment.Center,
            ) {
                MaterialIcon(ambientGlyph(slot.id), HomeMetrics.AMBIENT_ICON,
                             if (selected) Brand.logo.toColor() else Color.White, community = true)
            }
        }
    }
}

/** 场景条：首格「模糊」（关 live 时选中），后面按点选次数排的九个场景圆图 */
@Composable
private fun SceneStrip(
    scenes: List<NatureScene>, sceneId: String, liveVideo: Boolean,
    onPick: (String) -> Unit, onToggleLive: () -> Unit,
) {
    val state = rememberLazyListState()
    var viewportW by remember { mutableIntStateOf(0) }
    val slotW = HomeMetrics.THUMB + HomeMetrics.THUMB_SLOT_PAD
    val selectedIndex = scenes.indexOfFirst { it.id == sceneId }.let { if (it < 0) 0 else it + 1 }
    CenterOnSelected(state, selectedIndex, viewportW, slotW)
    LazyRow(
        state = state,
        modifier = Modifier.fillMaxWidth().onSizeChanged { viewportW = it.width },
        // sceneLeftPad = 16 - (slot - thumb)/2
        contentPadding = PaddingValues(
            start = (HomeMetrics.EDGE_PAD - HomeMetrics.THUMB_SLOT_PAD / 2).dp, end = HomeMetrics.EDGE_PAD.dp,
            bottom = HomeMetrics.SCENE_ROW_PAD_BOTTOM.dp),
        horizontalArrangement = Arrangement.spacedBy(HomeMetrics.THUMB_GAP.dp),
        verticalAlignment = Alignment.Top,
    ) {
        item { SceneThumb(selected = !liveVideo, posterAsset = null, onClick = onToggleLive) }
        items(scenes.size) { i ->
            val s = scenes[i]
            SceneThumb(selected = s.id == sceneId,
                       posterAsset = NatureScenes.posterAsset(s.id)) { onPick(s.id) }
        }
    }
}

/** HomeSceneThumb：64 圆图，未选中缩 .9 / 60% 不透明，弹簧过渡 */
@Composable
private fun SceneThumb(selected: Boolean, posterAsset: String?, onClick: () -> Unit) {
    val focus by animateFloatAsState(if (selected) 1f else 0f, spring(dampingRatio = 0.75f, stiffness = 400f), label = "thumb")
    val slot = HomeMetrics.THUMB + HomeMetrics.THUMB_SLOT_PAD
    Box(
        Modifier.width(slot.dp).height((HomeMetrics.THUMB + HomeMetrics.THUMB_SLOT_PAD * 2).dp).clickableNoRipple(onClick),
        contentAlignment = Alignment.TopCenter,
    ) {
        Box(
            Modifier.padding(top = HomeMetrics.THUMB_SLOT_PAD.dp)
                .scale(0.9f + 0.1f * focus).alpha(0.6f + 0.4f * focus)
                .shadow(if (selected) 5.dp else 3.dp, CircleShape)
                .size(HomeMetrics.THUMB.dp).clip(CircleShape)
                .background(Color(0xBF1C1814)),
            contentAlignment = Alignment.Center,
        ) {
            val img = posterAsset?.let { rememberAssetThumb(it) }
            if (img != null) {
                Image(img, contentDescription = null, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
            } else {
                MaterialIcon(MCI.BLUR, 28f, Color.White.copy(alpha = 0.88f), community = true)
            }
        }
    }
}

/** RN homeSceneStripScrollX / ambientStripScrollX：把选中项滚到视口居中 */
@Composable
private fun CenterOnSelected(state: LazyListState, index: Int, viewportWpx: Int, itemWdp: Float) {
    val density = androidx.compose.ui.platform.LocalDensity.current
    LaunchedEffect(index, viewportWpx) {
        if (index < 0 || viewportWpx <= 0) return@LaunchedEffect
        val itemPx = with(density) { itemWdp.dp.roundToPx() }
        state.animateScrollToItem(index, -((viewportWpx - itemPx) / 2))
    }
}
