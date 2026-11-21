package me.askbible.native_.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import me.askbible.native_.data.*
import kotlin.math.abs

/** 与原生 iOS 同步：首页左右换景，上拉调整，下拉音乐，长按音乐选专辑。 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun HomeScreen(
    verse: GoldenVerse, textScale: Float, sceneId: String, scenes: List<NatureScene>,
    liveVideo: Boolean, ambientSlotId: String?, voiceOn: Boolean, voiceAvailable: Boolean = true,
    playingAlbum: String?, selectedAlbum: String, sleepTimerMinutes: Int,
    ambientVolume: Float, onAmbientVolume: (Float) -> Unit,
    onSelectScene: (String) -> Unit, onSwipeScene: (Int) -> Unit = {},
    onToggleLiveVideo: () -> Unit, onToggleAmbient: (String) -> Unit,
    onBumpTextScale: (Int) -> Unit, onCycleSleepTimer: () -> Unit,
    onToggleVoice: () -> Unit, onPressAlbum: (String) -> Unit,
    onChooseAlbum: (String) -> Unit, onOpenMusic: () -> Unit, onOpenMenu: () -> Unit,
    onNextMusic: () -> Unit,
    onOpenVerseContext: () -> Unit = {},
    onBookmarkVerse: () -> Unit = {},
    chromeHidden: Boolean = false, onChromeHidden: (Boolean) -> Unit = {},
) {
    var toolsOpen by remember { mutableStateOf(false) }
    var albumsOpen by remember { mutableStateOf(false) }
    var idleEpoch by remember { mutableIntStateOf(0) }
    val dark = LocalParchment.current == Parchment.dark
    val paper = if (dark) Color(0xFF28251F) else Color(0xFFF7F0E4)
    val ink = if (dark) Color(0xFFEEE3D1) else Color(0xFF493B2C)
    val gold = Color(0xFFB88A35)
    fun t(zh: String, en: String) = AppLocale.pick(zh, en)
    fun touch() { idleEpoch++; onChromeHidden(false) }
    fun openTools() { albumsOpen = false; toolsOpen = true; touch() }
    LaunchedEffect(toolsOpen, albumsOpen, idleEpoch) {
        if (toolsOpen || albumsOpen) return@LaunchedEffect
        delay(7000); onChromeHidden(true)
    }
    BackHandler(albumsOpen) { albumsOpen = false; touch() }
    val density = LocalDensity.current
    val swipeThreshold = with(density) { 55.dp.toPx() }
    val swipeCallback by rememberUpdatedState(onSwipeScene)
    val openMusicCallback by rememberUpdatedState(onOpenMusic)
    val hidden by rememberUpdatedState(chromeHidden)
    val wide = LocalConfiguration.current.let { it.screenWidthDp > it.screenHeightDp }
    Box(Modifier.fillMaxSize().background(Color(0xFF1A1512))) {
        val poster = rememberAssetImage(if (liveVideo) NatureScenes.posterAsset(sceneId) else NatureScenes.softPosterAsset(sceneId))
        if (poster != null) Image(poster, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        if (liveVideo) HomeSceneVideo(sceneId, Modifier.fillMaxSize())
        Box(Modifier.fillMaxSize()
            .semantics { contentDescription = t("风景", "Scenery"); customActions = listOf(
                CustomAccessibilityAction(t("调整", "Adjust")) { openTools(); true },
                CustomAccessibilityAction(t("打开音乐", "Open music")) { onOpenMusic(); true }) }
            .pointerInput(Unit) { detectTapGestures {
                if (albumsOpen) { albumsOpen = false; touch() }
                else { idleEpoch++; onChromeHidden(!hidden) }
            } }
            .pointerInput(swipeThreshold) {
                var movement = Offset.Zero
                var startY = 0f
                detectDragGestures(onDragStart = { movement = Offset.Zero; startY = it.y }, onDragEnd = {
                    if (albumsOpen) { albumsOpen = false; touch() }
                    else if (abs(movement.x) > swipeThreshold && abs(movement.x) > abs(movement.y) * 1.5f) {
                        idleEpoch++; swipeCallback(if (movement.x < 0) 1 else -1)
                    } else if (abs(movement.y) > swipeThreshold && abs(movement.y) > abs(movement.x) * 1.5f) {
                        if (movement.y < 0 && startY > size.height * 0.55f) openTools()
                        else if (movement.y > 0) { touch(); openMusicCallback() }
                    }
                }) { change, amount -> change.consume(); movement += amount }
            })
        val vScale = if (wide) textScale * 0.6f else textScale
        Column(
            Modifier.fillMaxWidth().statusBarsPadding().padding(top = if (wide) 24.dp else 108.dp)
                .heightIn(max = (LocalConfiguration.current.screenHeightDp * 0.55f).dp)
                .then(if (wide) Modifier.verticalScroll(rememberScrollState()) else Modifier)
                .padding(horizontal = if (wide) 120.dp else 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            val shadow = Shadow(Color(0x8C000000), Offset(0f, 2f), 8f)
            Text(
                verse.text,
                modifier = Modifier.pointerInput(verse.text) {
                    detectTapGestures(
                        onDoubleTap = { touch(); onBookmarkVerse() },
                        onTap = {
                            if (albumsOpen) { albumsOpen = false; touch() }
                            else { idleEpoch++; onChromeHidden(!hidden) }
                        },
                    )
                },
                style = TextStyle(
                    color = Color.White,
                    fontSize = HomeVerseTypography.bodySize(vScale).sp,
                    lineHeight = HomeVerseTypography.bodyLineHeight(vScale).sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    shadow = shadow,
                ),
            )
            Spacer(Modifier.height(14.dp))
            Row(
                Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(Color.Black.copy(alpha = 0.36f))
                    .border(0.75.dp, Color.White.copy(alpha = 0.24f), RoundedCornerShape(999.dp))
                    .clickableNoRipple { touch(); onOpenVerseContext() }
                    .padding(horizontal = 14.dp, vertical = 7.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    verse.reference,
                    color = Color.White.copy(alpha = 0.96f),
                    fontSize = maxOf(13f, HomeVerseTypography.refSize(vScale) * 0.78f).sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Text("·", color = Color.White.copy(alpha = 0.48f), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Text(
                    t("读上下文", "Read context"),
                    color = Color(0xFFFFE3A3),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                MaterialIcon(MI.CHEVRON_RIGHT, 14f, Color(0xFFFFE3A3))
            }
        }
        Column(
            Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = shellTabBarBottomInset() + (ShellMetrics.tabRowHeight + 38).dp)
                .padding(horizontal = 22.dp)
                .alpha(if (chromeHidden && !albumsOpen) 0.52f else 1f),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            if (albumsOpen) {
                Column(
                    Modifier.widthIn(max = 340.dp).clip(RoundedCornerShape(22.dp)).background(paper).padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Text(t("切换陪伴心境", "Choose mood"), color = ink.copy(alpha = 0.68f), fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                        Row(
                            Modifier.clickableNoRipple { albumsOpen = false; touch(); onOpenMusic() },
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(2.dp),
                        ) {
                            Text(t("完整曲库", "All tracks"), color = Color(0xFFD97707), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                            MaterialIcon(MI.CHEVRON_RIGHT, 14f, Color(0xFFD97707))
                        }
                    }
                    HomeAlbumOptions(selectedAlbum, ink) { onChooseAlbum(it); albumsOpen = false; touch() }
                }
            }
            // 单排对称三触点：音乐(含当前心境) · 朗读 · 境况
            Row(horizontalArrangement = Arrangement.spacedBy(34.dp), verticalAlignment = Alignment.CenterVertically) {
                val glyph = MusicAlbumGlyph.glyph(selectedAlbum)
                val musicActive = playingAlbum != null
                Column(
                    Modifier.widthIn(min = 72.dp).semantics(mergeDescendants = true) {
                        contentDescription = t("音乐", "Music")
                        stateDescription = selectedAlbum + if (musicActive) " On" else " Off"
                    },
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(7.dp),
                ) {
                    Box(
                        Modifier
                            .size(52.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(if (musicActive) Brand.logo.toColor() else Color.Black.copy(alpha = 0.28f))
                            .border(0.75.dp, Color.White.copy(alpha = if (musicActive) 0f else 0.22f), RoundedCornerShape(999.dp))
                            .combinedClickable(
                                onClick = { touch(); onPressAlbum(selectedAlbum) },
                                onLongClickLabel = t("选择专辑", "Choose album"),
                                onLongClick = { touch(); albumsOpen = true },
                            ),
                        contentAlignment = Alignment.Center,
                    ) {
                        MaterialIcon(glyph.first, 22f, if (musicActive) Color(0xFF1C1410) else Color.White, community = glyph.second)
                    }
                    Row(
                        Modifier.clickableNoRipple { touch(); albumsOpen = !albumsOpen }.padding(horizontal = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        Text(
                            t(selectedAlbum, when (selectedAlbum) {
                                "安静" -> "Quiet"; "下午茶" -> "Afternoon tea"; "赞美诗" -> "Hymns"
                                "钢琴" -> "Piano"; "睡眠" -> "Sleep"; else -> "Focus"
                            }),
                            color = Color.White.copy(alpha = 0.92f),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                        )
                        MaterialIcon(MI.EXPAND_MORE, 13f, Color.White.copy(alpha = 0.8f))
                    }
                }

                HomeCircleControl(
                    glyph = MI.VOLUME_UP,
                    title = t("朗读", "Read aloud"),
                    active = voiceOn,
                    enabled = voiceAvailable,
                ) { touch(); onToggleVoice() }

                HomeCircleControl(
                    glyph = MI.SPA,
                    title = t("境况", "Ambience"),
                    active = ambientSlotId != null || sleepTimerMinutes > 0,
                    enabled = true,
                ) { openTools() }
            }

            // 底部微光呼吸条
            Box(
                Modifier.clickableNoRipple { openTools() }.padding(horizontal = 20.dp, vertical = 6.dp),
                contentAlignment = Alignment.Center,
            ) {
                Box(Modifier.size(34.dp, 4.dp).clip(RoundedCornerShape(999.dp)).background(Color.White.copy(alpha = 0.46f)))
            }
        }
    }
    if (toolsOpen) {
        ModalBottomSheet(onDismissRequest = { toolsOpen = false; touch() }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
            containerColor = paper, contentColor = ink) {
            Column(Modifier.fillMaxWidth().heightIn(max = (LocalConfiguration.current.screenHeightDp * 0.66f).dp)
                .verticalScroll(rememberScrollState()).padding(horizontal = 24.dp).navigationBarsPadding().padding(bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text(t("调整", "Adjust"), Modifier.align(Alignment.CenterHorizontally), fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                Text(t("声音", "Sound"), fontSize = 13.sp)
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(t("环境音", "Ambient sound"), Modifier.weight(1f))
                    Switch(ambientSlotId != null, { onToggleAmbient(ambientSlotId ?: NatureScenes.scene(sceneId)?.defaultAmbient ?: AmbientScenes.DEFAULT_SLOT_ID) })
                }
                LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(AmbientScenes.slots.size) { i ->
                        val slot = AmbientScenes.slots[i]
                        HomeOption(ambientGlyph(slot.id), true, t(slot.label, slot.labelEn), slot.id == ambientSlotId, ink,
                            Modifier.width(74.dp)) { onToggleAmbient(slot.id) }
                    }
                }
                Slider(value = ambientVolume, onValueChange = onAmbientVolume, enabled = ambientSlotId != null,
                    modifier = Modifier.semantics { contentDescription = t("环境音音量", "Ambient volume") })
                Text(t("音乐专辑", "Music albums"), fontSize = 13.sp)
                HomeAlbumOptions(selectedAlbum, ink, onChooseAlbum)
                Text(t("画面", "Picture"), fontSize = 13.sp)
                LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    items(scenes.size) { i ->
                        val scene = scenes[i]
                        Column(Modifier.width(90.dp).clickable { onSelectScene(scene.id) }.semantics { selected = scene.id == sceneId }, horizontalAlignment = Alignment.CenterHorizontally) {
                            val thumb = rememberAssetThumb(NatureScenes.posterAsset(scene.id))
                            if (thumb != null) Image(thumb, null, Modifier.size(90.dp, 58.dp).clip(RoundedCornerShape(10.dp))
                                .border(if (scene.id == sceneId) 2.dp else 0.dp, if (scene.id == sceneId) gold else Color.Transparent, RoundedCornerShape(10.dp)), contentScale = ContentScale.Crop)
                            Text(t(scene.title, scene.titleEn), fontSize = 12.sp)
                        }
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically) { Text(t("动态画面", "Live scenery"), Modifier.weight(1f)); Switch(liveVideo, { onToggleLiveVideo() }) }
                Text(t("阅读与休息", "Reading & rest"), fontSize = 13.sp)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(t("字号", "Text size"), Modifier.weight(1f))
                    TextButton(onClick = { onBumpTextScale(-1) }) { Text("−", fontSize = 22.sp) }
                    TextButton(onClick = { onBumpTextScale(1) }) { Text("+", fontSize = 22.sp) }
                }
                Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable(onClick = onCycleSleepTimer), verticalAlignment = Alignment.CenterVertically) {
                    Text(t("睡眠定时", "Sleep timer"), Modifier.weight(1f)); Text(if (sleepTimerMinutes == 0) t("关闭", "Off") else "$sleepTimerMinutes " + t("分钟", "min"))
                }
            }
        }
    }
}

@Composable
private fun HomeCircleControl(
    glyph: String,
    title: String,
    active: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Column(
        Modifier
            .widthIn(min = 72.dp)
            .alpha(if (enabled) 1f else 0.38f)
            .clickableNoRipple { if (enabled) onClick() }
            .semantics(mergeDescendants = true) {
                contentDescription = title
                stateDescription = if (active) "On" else "Off"
            },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        Box(
            Modifier
                .size(52.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(if (active) Brand.logo.toColor() else Color.Black.copy(alpha = 0.28f))
                .border(0.75.dp, Color.White.copy(alpha = if (active) 0f else 0.22f), RoundedCornerShape(999.dp)),
            contentAlignment = Alignment.Center,
        ) {
            MaterialIcon(glyph, 21f, if (active) Color(0xFF1C1410) else Color.White)
        }
        Text(title, color = Color.White.copy(alpha = 0.92f), fontSize = 12.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun HomeAlbumOptions(active: String, ink: Color, onChoose: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        MusicCatalog.albums.chunked(3).forEach { albums ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                albums.forEach { album ->
                    val glyph = MusicAlbumGlyph.glyph(album)
                    HomeOption(glyph.first, glyph.second, AppLocale.pick(album, when(album) {
                        "安静" -> "Quiet"; "下午茶" -> "Afternoon tea"; "赞美诗" -> "Hymns"; "钢琴" -> "Piano"; "睡眠" -> "Sleep"; else -> "Focus"
                    }), active == album, ink, Modifier.weight(1f)) { onChoose(album) }
                }
            }
        }
    }
}
@Composable
private fun HomeOption(glyph: String, community: Boolean, title: String, active: Boolean, ink: Color, modifier: Modifier, onClick: () -> Unit) {
    Column(modifier.clip(RoundedCornerShape(14.dp)).background(if (active) Color(0x38FFB101) else ink.copy(alpha = 0.05f))
        .clickable(onClick = onClick).semantics(mergeDescendants = true) { selected = active; contentDescription = title }
        .padding(8.dp).heightIn(min = 64.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        MaterialIcon(glyph, 24f, ink, community = community)
        Spacer(Modifier.height(6.dp)); Text(title, color = ink, fontSize = 12.sp, textAlign = TextAlign.Center)
    }
}
private fun ambientGlyph(id: String): String = when(id) {
    "scene-water" -> MCI.WATER; "scene-rain" -> MCI.WEATHER_RAINY; "scene-birds" -> MCI.BIRD
    "scene-white-noise" -> MCI.RADIO_TOWER; "scene-wind" -> MCI.WEATHER_WINDY; "scene-fire" -> MCI.FIRE
    "scene-waves" -> MCI.WAVES; "scene-thunder" -> MCI.WEATHER_LIGHTNING; else -> MCI.COFFEE
}
