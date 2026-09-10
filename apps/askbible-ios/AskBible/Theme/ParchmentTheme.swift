import SwiftUI

extension Color {
    init(rgb: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((rgb >> 16) & 0xFF) / 255,
            green: Double((rgb >> 8) & 0xFF) / 255,
            blue: Double(rgb & 0xFF) / 255,
            opacity: opacity
        )
    }
}

/// 羊皮卷配色。逐值搬自 RN 版 `src/read/readParchmentTheme.ts`，
/// 两端各持一份是双写方案的既定代价 —— 改动必须同步，靠 shared-fixtures 的对拍兜底。
struct Parchment {
    let canvas: Color
    let ink: Color
    let inkSoft: Color
    let muted: Color
    let faint: Color
    let border: Color
    let borderStrong: Color
    let accentOt: Color
    let accentNt: Color
    let hover: Color
    let surface: Color
    let surfaceSolid: Color
    let chapterCell: Color
    let chapterCellPressed: Color
    let chapterCellBorder: Color
    let modalBackdrop: Color
    let verseNumMuted: Color
    let verseNum: Color
    let tabInactive: Color
    let playFabBg: Color
    let playFabBorder: Color
    let verseAudioActiveBg: Color
    let verseAudioActiveBorder: Color
    let verseAudioActiveNum: Color
    let verseSearchFocusBg: Color
    let divineSpeech: Color
    let humanSpeech: Color
    let verseBookmarkMarker: Color
    let parchmentAccent: Color
    let parchmentAccentGlow: Color

    static let light = Parchment(
        canvas: Color(rgb: 0xecd9b9),
        ink: Color(rgb: 0x1c1410),
        inkSoft: Color(rgb: 0x1c1410, opacity: 0.94),
        muted: Color(rgb: 0x5c4030),
        faint: Color(rgb: 0x6e5240),
        border: Color(rgb: 0x78350f, opacity: 0.28),
        borderStrong: Color(rgb: 0x78350f, opacity: 0.42),
        accentOt: Color(rgb: 0xD97707),
        accentNt: Color(rgb: 0xA56A2D),
        hover: Color(rgb: 0x2a1810, opacity: 0.07),
        surface: Color(rgb: 0xfffcf5, opacity: 0.88),
        surfaceSolid: Color(rgb: 0xf5ebe0),
        chapterCell: Color(rgb: 0xf0e4d4),
        chapterCellPressed: Color(rgb: 0xf5ead8),
        chapterCellBorder: Color(rgb: 0x78350f, opacity: 0.30),
        modalBackdrop: Color(rgb: 0x1c1410, opacity: 0.35),
        verseNumMuted: Color(rgb: 0x5c3a1c, opacity: 0.78),
        verseNum: Color(rgb: 0xC98300),
        tabInactive: Color(rgb: 0x1c1410, opacity: 0.52),
        playFabBg: Color(rgb: 0x1c1410, opacity: 0.08),
        playFabBorder: Color(rgb: 0x1c1410, opacity: 0.18),
        verseAudioActiveBg: Color(rgb: 0x8b5a2b, opacity: 0.14),
        verseAudioActiveBorder: Color(rgb: 0x784b1e, opacity: 0.18),
        verseAudioActiveNum: Color(rgb: 0x5c3a12, opacity: 0.95),
        verseSearchFocusBg: Color(rgb: 0x8b5a2b, opacity: 0.22),
        divineSpeech: Color(rgb: 0x994812, opacity: 0.95),
        humanSpeech: Color(rgb: 0x38486C),
        verseBookmarkMarker: Color(rgb: 0xFFB103),
        parchmentAccent: Color(rgb: 0xD97707),
        parchmentAccentGlow: Color(rgb: 0xD97707, opacity: 0.24)
    )

    static let dark = Parchment(
        canvas: Color(rgb: 0x1a1512),
        ink: Color(rgb: 0xf4ebe1),
        inkSoft: Color(rgb: 0xf4ebe1, opacity: 0.94),
        muted: Color(rgb: 0xd8c8b4),
        faint: Color(rgb: 0xb9a896),
        border: Color(rgb: 0xf4ebe1, opacity: 0.16),
        borderStrong: Color(rgb: 0xf4ebe1, opacity: 0.24),
        accentOt: Color(rgb: 0xD97707),
        accentNt: Color(rgb: 0xD5A06A),
        hover: Color(rgb: 0xf4ebe1, opacity: 0.08),
        surface: Color(rgb: 0x292524, opacity: 0.72),
        surfaceSolid: Color(rgb: 0x292524),
        chapterCell: Color(rgb: 0x292524, opacity: 0.58),
        chapterCellPressed: Color(rgb: 0x3f3a36, opacity: 0.62),
        chapterCellBorder: Color(rgb: 0xf4ebe1, opacity: 0.16),
        modalBackdrop: Color(rgb: 0x0c0a08, opacity: 0.55),
        verseNumMuted: Color(rgb: 0xeadbc4, opacity: 0.72),
        verseNum: Color(rgb: 0xFFB103),
        tabInactive: Color(rgb: 0xf4ebe1, opacity: 0.52),
        playFabBg: Color(rgb: 0xf4ebe1, opacity: 0.10),
        playFabBorder: Color(rgb: 0xf4ebe1, opacity: 0.20),
        verseAudioActiveBg: Color(rgb: 0xf5e6d2, opacity: 0.08),
        verseAudioActiveBorder: Color(rgb: 0xf5e6d2, opacity: 0.12),
        verseAudioActiveNum: Color(rgb: 0xf0b88a, opacity: 0.95),
        verseSearchFocusBg: Color(rgb: 0xf5e6d2, opacity: 0.14),
        divineSpeech: Color(rgb: 0xffc68c, opacity: 0.95),
        humanSpeech: Color(rgb: 0x38486C),
        verseBookmarkMarker: Color(rgb: 0xFFB103),
        parchmentAccent: Color(rgb: 0xD97707),
        parchmentAccentGlow: Color(rgb: 0xD97707, opacity: 0.28)
    )
}

/// 品牌与壳层常量。搬自 `splash-branding.generated.ts` / `shellChromeIcons.ts`。
enum Brand {
    /// SPLASH_BACKGROUND —— 底栏选中态、播放中的播放键底色
    static let logo = Color(rgb: 0xFFB101)
    static let logoTextAccent = Color(rgb: 0xE5A525)
    /// SHELL_TAB_BAR_ICON —— 底栏未选中图标（羊皮与视频背景上都是白色）
    static let tabBarIcon = Color.white
    static let shellIcon = Color.white.opacity(0.72)
    static let shellIconMuted = Color.white.opacity(0.58)
}

extension View {
    /// SHELL_ICON_TEXT_SHADOW —— 壳层图标在羊皮卷上的可读性阴影。
    /// RN 侧是 textShadow(0,1,6)/0.55；SwiftUI 的 shadow 更"实"，单层压不住羊皮底，叠两层。
    func shellIconShadow() -> some View {
        shadow(color: .black.opacity(0.55), radius: 5, x: 0, y: 1)
            .shadow(color: .black.opacity(0.32), radius: 2, x: 0, y: 1)
    }

    /// 首页金句在照片上的阴影（effectShadow 的 body 档）
    func verseBodyShadow() -> some View {
        shadow(color: .black.opacity(0.55), radius: 4, x: 0, y: 2)
    }
}
