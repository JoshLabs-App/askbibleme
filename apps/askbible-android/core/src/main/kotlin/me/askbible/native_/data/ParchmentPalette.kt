package me.askbible.native_.data

/**
 * 羊皮卷配色。与 iOS 的 `ParchmentTheme.swift` 是对等双写的两份实现，
 * 真源都是 RN 的 `src/read/readParchmentTheme.ts`。一致性由 check:tokens 对拍保证。
 *
 * 刻意不用 Compose 的 Color：core 要保持零依赖，对拍才能在 JVM 上跑。
 * app 层再转成 Compose Color。
 */
data class Rgba(val rgb: Int, val alpha: Double = 1.0) {
    /** 转成 Compose/Android 用的 0xAARRGGBB */
    val argb: Long
        get() = ((alpha * 255).toInt().toLong() shl 24) or (rgb.toLong() and 0xFFFFFF)
}

data class Parchment(
    val canvas: Rgba,
    val ink: Rgba,
    val inkSoft: Rgba,
    val muted: Rgba,
    val faint: Rgba,
    val border: Rgba,
    val borderStrong: Rgba,
    val accentOt: Rgba,
    val accentNt: Rgba,
    val hover: Rgba,
    val surface: Rgba,
    val surfaceSolid: Rgba,
    val chapterCell: Rgba,
    val chapterCellPressed: Rgba,
    val chapterCellBorder: Rgba,
    val modalBackdrop: Rgba,
    val verseNumMuted: Rgba,
    val verseNum: Rgba,
    val tabInactive: Rgba,
    val playFabBg: Rgba,
    val playFabBorder: Rgba,
    val verseAudioActiveBg: Rgba,
    val verseAudioActiveBorder: Rgba,
    val verseAudioActiveNum: Rgba,
    val verseSearchFocusBg: Rgba,
    val divineSpeech: Rgba,
    val humanSpeech: Rgba,
    val verseBookmarkMarker: Rgba,
    val parchmentAccent: Rgba,
    val parchmentAccentGlow: Rgba,
) {
    companion object {
        val light = Parchment(
            canvas = Rgba(0xecd9b9),
            ink = Rgba(0x1c1410),
            inkSoft = Rgba(0x1c1410, 0.94),
            muted = Rgba(0x5c4030),
            faint = Rgba(0x6e5240),
            border = Rgba(0x78350f, 0.28),
            borderStrong = Rgba(0x78350f, 0.42),
            accentOt = Rgba(0xD97707),
            accentNt = Rgba(0xA56A2D),
            hover = Rgba(0x2a1810, 0.07),
            surface = Rgba(0xfffcf5, 0.88),
            surfaceSolid = Rgba(0xf5ebe0),
            chapterCell = Rgba(0xf0e4d4),
            chapterCellPressed = Rgba(0xf5ead8),
            chapterCellBorder = Rgba(0x78350f, 0.30),
            modalBackdrop = Rgba(0x1c1410, 0.35),
            verseNumMuted = Rgba(0x5c3a1c, 0.78),
            verseNum = Rgba(0xC98300),
            tabInactive = Rgba(0x1c1410, 0.52),
            playFabBg = Rgba(0x1c1410, 0.08),
            playFabBorder = Rgba(0x1c1410, 0.18),
            verseAudioActiveBg = Rgba(0x8b5a2b, 0.14),
            verseAudioActiveBorder = Rgba(0x784b1e, 0.18),
            verseAudioActiveNum = Rgba(0x5c3a12, 0.95),
            verseSearchFocusBg = Rgba(0x8b5a2b, 0.22),
            divineSpeech = Rgba(0x994812, 0.95),
            humanSpeech = Rgba(0x38486C),
            verseBookmarkMarker = Rgba(0xFFB103),
            parchmentAccent = Rgba(0xD97707),
            parchmentAccentGlow = Rgba(0xD97707, 0.24),
        )

        val dark = Parchment(
            canvas = Rgba(0x1a1512),
            ink = Rgba(0xf4ebe1),
            inkSoft = Rgba(0xf4ebe1, 0.94),
            muted = Rgba(0xd8c8b4),
            faint = Rgba(0xb9a896),
            border = Rgba(0xf4ebe1, 0.16),
            borderStrong = Rgba(0xf4ebe1, 0.24),
            accentOt = Rgba(0xD97707),
            accentNt = Rgba(0xD5A06A),
            hover = Rgba(0xf4ebe1, 0.08),
            surface = Rgba(0x292524, 0.72),
            surfaceSolid = Rgba(0x292524),
            chapterCell = Rgba(0x292524, 0.58),
            chapterCellPressed = Rgba(0x3f3a36, 0.62),
            chapterCellBorder = Rgba(0xf4ebe1, 0.16),
            modalBackdrop = Rgba(0x0c0a08, 0.55),
            verseNumMuted = Rgba(0xeadbc4, 0.72),
            verseNum = Rgba(0xFFB103),
            tabInactive = Rgba(0xf4ebe1, 0.52),
            playFabBg = Rgba(0xf4ebe1, 0.10),
            playFabBorder = Rgba(0xf4ebe1, 0.20),
            verseAudioActiveBg = Rgba(0xf5e6d2, 0.08),
            verseAudioActiveBorder = Rgba(0xf5e6d2, 0.12),
            verseAudioActiveNum = Rgba(0xf0b88a, 0.95),
            verseSearchFocusBg = Rgba(0xf5e6d2, 0.14),
            divineSpeech = Rgba(0xffc68c, 0.95),
            humanSpeech = Rgba(0x38486C),
            verseBookmarkMarker = Rgba(0xFFB103),
            parchmentAccent = Rgba(0xD97707),
            parchmentAccentGlow = Rgba(0xD97707, 0.28),
        )
    }
}

/** 品牌与壳层常量。搬自 splash-branding.generated.ts / shellChromeIcons.ts。 */
object Brand {
    /** SPLASH_BACKGROUND —— 底栏选中态、播放中的播放键底色 */
    val logo = Rgba(0xFFB101)
    val logoTextAccent = Rgba(0xE5A525)
    /** SHELL_TAB_BAR_ICON —— 底栏未选中图标 */
    val tabBarIcon = Rgba(0xFFFFFF)
}
