import SwiftUI

extension Color {
    /// 「#RRGGBB」→ Color（划重点的调色板是十六进制字符串，和 RN / 网页共用一份）
    init(hex: String) {
        let raw = hex.trimmingCharacters(in: CharacterSet(charactersIn: "# ")).uppercased()
        let value = UInt32(raw.prefix(6), radix: 16) ?? 0xFFB103
        self.init(rgb: value)
    }

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

extension Color {
    /// 羊皮页上写死的颜色，深色模式下自动换成对应的暗色版本（2026-09-16 深色模式）。
    /// 页面里原来散着 ~70 处 `Color(rgb:)` 字面值（棕墨、纸色底、状态绿蓝），逐个接 theme 改动面太大，
    /// 所以集中在这张表里给每个浅色值配一个暗色值：纸色底 → 深色表面，棕墨 → 暖浅色，绿蓝 → 提亮。
    /// 品牌黄 #FFB101、Google 标志色、错误红**不在表里**，两种模式保持原色。
    init(parchment rgb: UInt32, opacity: Double = 1) {
        let dark = Color.parchmentDarkMap[rgb] ?? rgb
        self.init(uiColor: UIColor { traits in
            let v = traits.userInterfaceStyle == .dark ? dark : rgb
            return UIColor(
                red: CGFloat((v >> 16) & 0xFF) / 255,
                green: CGFloat((v >> 8) & 0xFF) / 255,
                blue: CGFloat(v & 0xFF) / 255,
                alpha: opacity)
        })
    }

    static let parchmentDarkMap: [UInt32: UInt32] = [
        0xFFFCF5: 0x2A2320,
        0xFFF8EB: 0x2A2320,
        0xFFFDF8: 0x2A2320,
        0xF5EFE4: 0x2A2320,
        0xF2E4CF: 0x2E2622,
        0xF7F4EF: 0x2A2320,
        0xFFF3D8: 0x3A2E22,
        0xFFECBF: 0x4A3818,
        0x8C5A2A: 0xD9B48A,
        0x784B1E: 0xD9B48A,
        0x8C562A: 0xD9B48A,
        0x6B4A2A: 0xD9B48A,
        0x7A633A: 0xD9C08A,
        0x70451F: 0xD9B48A,
        0x4D3522: 0xE8DCCB,
        0x452D1C: 0xE8DCCB,
        0x5C4030: 0xD8C8B4,
        0x2B1D15: 0xF4EBE1,
        0x1C1410: 0xF4EBE1,
        0x994812: 0xFFC68C,
        0xA56A2D: 0xD5A06A,
        0x78350F: 0xE0B07A,
        0x8A5A00: 0xF0C060,
        0x5B3A00: 0xF0C060,
        0xC1660B: 0xF29A4A,
        0xB8611E: 0xF29A4A,
        0xE8A017: 0xFFC43D,
        0xE0A100: 0xFFC43D,
        0x4F7A54: 0x8FC79A,
        0x3F7A4A: 0x8FC79A,
        0x2F6291: 0x8DB6E6,
        0x2E5E8C: 0x8DB6E6
    ]
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
        // RN 的暗色板这里照抄了浅色 #38486C（RN 从没启用暗色，没被发现），深底上几乎看不见
        humanSpeech: Color(rgb: 0x9DB2DE),
        verseBookmarkMarker: Color(rgb: 0xFFB103),
        parchmentAccent: Color(rgb: 0xD97707),
        parchmentAccentGlow: Color(rgb: 0xD97707, opacity: 0.28)
    )
}

/// 当前羊皮主题走环境值，由 RootView 按系统深浅色注入。
/// 页面里写 `@Environment(\.parchment) private var theme`，**不要再写 `Parchment.light`** ——
/// 原来 App 入口锁死 `.preferredColorScheme(.light)`，49 处都硬写浅色；深色模式（2026-09-16）起改走这里。
private struct ParchmentKey: EnvironmentKey {
    static let defaultValue: Parchment = .light
}

extension EnvironmentValues {
    var parchment: Parchment {
        get { self[ParchmentKey.self] }
        set { self[ParchmentKey.self] = newValue }
    }
}

extension Parchment {
    var isDark: Bool { canvas == Parchment.dark.canvas }
}

/// 在根视图上挂一次：读系统 colorScheme，注入对应的羊皮主题
struct ParchmentSchemeInjector: ViewModifier {
    @Environment(\.colorScheme) private var scheme
    func body(content: Content) -> some View {
        content.environment(\.parchment, scheme == .dark ? .dark : .light)
    }
}

/// 经文层语义色（DECISIONS 2026-09-15 的 Scripture token）。羊皮配色本身与 RN / 网页双写，
/// 名字不能动；这里给「经文层」一组语义别名，新代码引语义名，调纸张时不用翻几十个页面找 `canvas` / `ink`。
extension Parchment {
    /// 纸：经文所在的平面
    var scriptureBackground: Color { canvas }
    /// 墨：经文正文
    var scripturePrimaryText: Color { ink }
    /// 淡墨：节号、注记、次要说明
    var scriptureSecondaryText: Color { muted }
    /// 琥珀：经文层的强调（标题、选中、划重点）
    var scriptureAccent: Color { accentOt }
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

    /// 首页金句的文字阴影（Josh 2026-09-16：「首页上面不要一层阴影层，而文字金句需要阴影层」）。
    /// 阴影贴着字走，不再铺暗化层：一层紧的压边（保笔画在亮天空上清楚），一层散的托底（与背景拉开）。
    /// 比最早那版双层黑影（0.55 + 0.32）轻，不会把字边染脏。
    func verseTextShadow() -> some View {
        shadow(color: .black.opacity(0.38), radius: 1.5, x: 0, y: 1)
            .shadow(color: .black.opacity(0.30), radius: 8, x: 0, y: 2)
    }

    /// 首页金句在照片上的阴影（effectShadow 的 body 档）
    func verseBodyShadow() -> some View {
        shadow(color: .black.opacity(0.55), radius: 4, x: 0, y: 2)
    }
}
