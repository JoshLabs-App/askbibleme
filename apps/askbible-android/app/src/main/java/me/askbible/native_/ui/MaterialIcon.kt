package me.askbible.native_.ui

import android.content.Context
import android.graphics.Typeface
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * RN 版所有壳层图标都是 @expo/vector-icons 的 MaterialIcons / MaterialCommunityIcons 字形，
 * 这里内置同两份 TTF 按同码位渲染，形状与 RN 逐像素一致（Compose material-icons 的同名矢量并不一样）。
 */
object IconFonts {
    @Volatile private var material: FontFamily? = null
    @Volatile private var community: FontFamily? = null

    fun material(context: Context): FontFamily = material ?: FontFamily(
        Typeface.createFromAsset(context.assets, "fonts/MaterialIcons.ttf")).also { material = it }

    fun community(context: Context): FontFamily = community ?: FontFamily(
        Typeface.createFromAsset(context.assets, "fonts/MaterialCommunityIcons.ttf")).also { community = it }
}

/** MaterialIcons 码位（glyphmaps/MaterialIcons.json） */
object MI {
    const val HOME = ""
    const val MUSIC_NOTE = ""
    const val MENU_BOOK = ""
    const val EXPLORE = ""
    const val PERSON = "\ue7fd"
    const val SEARCH = ""
    const val PLAY_ARROW = ""
    const val PAUSE = ""
    const val SKIP_NEXT = ""
    const val SKIP_PREVIOUS = ""
    const val ARROW_BACK = ""
    const val SETTINGS = ""
    const val BOOKMARK_BORDER = ""
    const val HISTORY = ""
    const val MENU = ""
    const val VOLUME_UP = ""
    /** local_cafe：音乐页下午茶专辑的咖啡杯 */
    const val LOCAL_CAFE = "\uE541"
    /** graphic_eq：播放页正在出声的那章 */
    const val GRAPHIC_EQ = "\uE1B8"
    const val TIMER = ""
    const val ADD = ""
    const val REMOVE = ""
    const val RECORD_VOICE_OVER = ""
    const val WORK_OUTLINE = ""
    const val DARK_MODE = ""
    const val PIANO = ""
    const val ALBUM = ""
    const val CHEVRON_LEFT = "\uE5CB"
    const val CHEVRON_RIGHT = "\uE5CC"
    const val CLOSE = "\uE5CD"
    const val CHECK = "\uE5CA"
    const val CHECK_CIRCLE = "\uE86C"
    // 读经计划页（手机版精简排版）：要点 chips / 怎么读 / 轨道图标 / 展开收起
    const val TODAY = "\uE8DF"
    const val LOOP = "\uE028"
    const val SWAP_HORIZ = "\uE8D4"
    const val STAIRS = "\uF1A9"
    const val REPEAT = "\uE040"
    const val SYNC = "\uE627"
    const val SPA = "\uEB4C"
    const val REPLAY = "\uE042"
    const val CALENDAR_MONTH = "\uEBCC"
    const val LAYERS = "\uE53B"
    const val HISTORY_EDU = "\uEA3E"
    const val AUTO_STORIES = "\uE666"
    const val LIGHTBULB = "\uE0F0"
    const val EXPAND_MORE = "\uE5CF"
    const val EXPAND_LESS = "\uE5CE"
    const val ARROW_FORWARD = "\uE5C8"
    const val FORMAT_ALIGN_LEFT = "\uE236"
    const val NOTES = "\uE26C"
    const val CONTENT_COPY = "\uE14D"
    /** library_add_check：多选复制 */
    const val LIBRARY_ADD_CHECK = "\uE9B7"
    const val IOS_SHARE = "\uE6B8"
    const val BOOKMARK = "\uE866"
}

/** MaterialCommunityIcons 码位（U+F05CB 等在 BMP 之外，写成代理对） */
object MCI {
    const val ACCOUNT_VOICE = "󰗋"
    const val MUSIC_NOTE_OUTLINE = "󰽴"
    const val COFFEE_OUTLINE = "󰛊"
    const val CHURCH_OUTLINE = "󱬂"
    // 首页环境音九槽（ambientSceneSlots.ts icon）+ 场景条「模糊」
    const val WATER = "󰖌"
    const val WEATHER_RAINY = "󰖗"
    const val BIRD = "󱗆"
    const val RADIO_TOWER = "󰐻"
    const val WEATHER_WINDY = "󰖝"
    const val FIRE = "󰈸"
    const val WAVES = "󰞍"
    const val WEATHER_LIGHTNING = "󰖓"
    const val COFFEE = "󰅶"
    const val BLUR = "󰂵"
}

/** RN `MUSIC_ALBUM_ICON` + `COMMUNITY_ALBUM_ICONS`：专辑 → (字形, 是否 MaterialCommunityIcons) */
object MusicAlbumGlyph {
    fun glyph(album: String): Pair<String, Boolean> = when (album) {
        "安静" -> Pair(MCI.MUSIC_NOTE_OUTLINE, true)
        "下午茶" -> Pair(MCI.COFFEE_OUTLINE, true)
        "赞美诗" -> Pair(MCI.CHURCH_OUTLINE, true)
        "专注工作" -> Pair(MI.WORK_OUTLINE, false)
        "睡眠" -> Pair(MI.DARK_MODE, false)
        "钢琴" -> Pair(MI.PIANO, false)
        else -> Pair(MI.ALBUM, false)
    }
}

/** RN shellIconTextShadow：rgba(0,0,0,.55) 偏移 (0,1) 模糊 6 */
val ShellIconShadow = Shadow(Color(0x8C000000), Offset(0f, 1f), 6f)

/** 一个 Material 字形。`size` 就是 RN `<MaterialIcons size>` 的 size（字号 = 图标框）。 */
@Composable
fun MaterialIcon(
    glyph: String,
    size: Float,
    color: Color,
    modifier: Modifier = Modifier,
    community: Boolean = false,
    shadow: Boolean = false,
) {
    val context = LocalContext.current
    val family = if (community) IconFonts.community(context) else IconFonts.material(context)
    Box(modifier.size(size.dp), contentAlignment = Alignment.Center) {
        Text(
            glyph,
            style = TextStyle(
                fontFamily = family,
                fontSize = size.sp,
                lineHeight = size.sp,
                color = color,
                shadow = if (shadow) ShellIconShadow else null,
                platformStyle = PlatformTextStyle(includeFontPadding = false),
            ),
            softWrap = false,
            maxLines = 1,
            overflow = TextOverflow.Visible,
        )
    }
}
