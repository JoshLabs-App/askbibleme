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
    chromeHidden: Boolean = false, onChromeHidden: (Boolean) -> Unit = {},
) {
    var toolsOpen by remember { mutableStateOf(false) }
    var albumsOpen by remember { mutableStateOf(false) }
    var idleEpoch by remember { mutableIntStateOf(0) }
    val dark = isSystemInDarkTheme()
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
        // 手势只放在背景层，面板滚动、图标点击不触发换景。
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
        Column(Modifier.fillMaxWidth().statusBarsPadding().padding(top = if (wide) 24.dp else 99.dp)
            .heightIn(max = (LocalConfiguration.current.screenHeightDp * 0.55f).dp)
            .then(if (wide) Modifier.verticalScroll(rememberScrollState()) else Modifier)
            .padding(horizontal = if (wide) 120.dp else 22.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            val shadow = Shadow(Color(0x8C000000), Offset(0f, 2f), 8f)
            Text(verse.text, style = TextStyle(color = Color.White, fontSize = HomeVerseTypography.bodySize(vScale).sp,
                lineHeight = HomeVerseTypography.bodyLineHeight(vScale).sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, shadow = shadow))
            Spacer(Modifier.height(HomeVerseTypography.refTopGap(vScale).dp))
            Text(verse.reference, style = TextStyle(color = Color.White, fontSize = HomeVerseTypography.refSize(vScale).sp,
                lineHeight = HomeVerseTypography.refLineHeight(vScale).sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, shadow = shadow))
        }
        Column(Modifier.align(Alignment.BottomCenter).padding(bottom = shellTabBarBottomInset() + (ShellMetrics.tabRowHeight + 90).dp)
            .padding(horizontal = 22.dp).alpha(if (chromeHidden && !albumsOpen) 0.55f else 1f), horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp)) {
            if (albumsOpen) Column(Modifier.widthIn(max = 340.dp).clip(RoundedCornerShape(22.dp)).background(paper).padding(14.dp)) {
                HomeAlbumOptions(selectedAlbum, ink) { onChooseAlbum(it); albumsOpen = false; touch() }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(32.dp)) {
                val glyph = MusicAlbumGlyph.glyph(selectedAlbum)
                Column(Modifier.size(72.dp).combinedClickable(
                    onClick = { touch(); onPressAlbum(selectedAlbum) },
                    onLongClickLabel = t("选择专辑", "Choose album"), onLongClick = { touch(); albumsOpen = true })
                    .semantics(mergeDescendants = true) { contentDescription = t("音乐", "Music"); stateDescription = selectedAlbum + if (playingAlbum != null) " On" else " Off" },
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                    MaterialIcon(glyph.first, 28f, if (playingAlbum != null) Brand.logo.toColor() else Color.White, community = glyph.second, shadow = true)
                    Text(t("音乐", "Music"), color = Color.White, fontSize = 12.sp)
                }
                Column(Modifier.size(72.dp).alpha(if (voiceAvailable) 1f else 0.35f).clickable(enabled = voiceAvailable) { touch(); onToggleVoice() }
                    .semantics(mergeDescendants = true) { contentDescription = t("朗读", "Read aloud"); stateDescription = if (voiceOn) "On" else "Off" },
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                    MaterialIcon(MI.VOLUME_UP, 28f, if (voiceOn) Brand.logo.toColor() else Color.White, shadow = true)
                    Text(t("朗读", "Read aloud"), color = Color.White, fontSize = 12.sp)
                }
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
                TextButton(onClick = { toolsOpen = false; onOpenMenu() }, modifier = Modifier.fillMaxWidth()) { Text(t("更多设置", "More settings"), color = ink) }
            }
        }
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
