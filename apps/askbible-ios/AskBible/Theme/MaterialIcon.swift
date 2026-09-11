import SwiftUI
import CoreText

/// RN 版所有壳层图标都是 @expo/vector-icons 的 MaterialIcons / MaterialCommunityIcons 字形，
/// 这里直接内置同两份 TTF 按同码位渲染，形状与 RN 逐像素一致（SF Symbols 的同名图标形状并不一样）。
enum IconFont {
    static let material = register("MaterialIcons")
    static let community = register("MaterialCommunityIcons")

    /// 运行时注册字体并取 PostScript 名，省掉 Info.plist 的 UIAppFonts
    private static func register(_ file: String) -> String {
        let url = Bundle.main.url(forResource: file, withExtension: "ttf", subdirectory: "Fonts")
            ?? Bundle.main.url(forResource: file, withExtension: "ttf")
        guard let url else { return "" }
        CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        guard let descs = CTFontManagerCreateFontDescriptorsFromURL(url as CFURL) as? [CTFontDescriptor],
              let d = descs.first,
              let name = CTFontDescriptorCopyAttribute(d, kCTFontNameAttribute) as? String else { return "" }
        return name
    }
}

/// MaterialIcons 码位（glyphmaps/MaterialIcons.json）
enum MI {
    static let home = "\u{e88a}"
    static let musicNote = "\u{e405}"
    static let menuBook = "\u{ea19}"
    static let explore = "\u{e87a}"
    static let person = "\u{e7fd}"
    static let search = "\u{e8b6}"
    static let playArrow = "\u{e037}"
    static let pause = "\u{e034}"
    static let skipNext = "\u{e044}"
    static let skipPrevious = "\u{e045}"
    static let arrowBack = "\u{e5c4}"
    static let settings = "\u{e8b8}"
    static let bookmarkBorder = "\u{e867}"
    static let history = "\u{e889}"
    static let menu = "\u{e5d2}"
    static let volumeUp = "\u{e050}"
    /// local_cafe：音乐页下午茶专辑的咖啡杯
    static let localCafe = "\u{e541}"
    /// graphic_eq：播放页正在出声的那章
    static let graphicEq = "\u{e1b8}"
    static let timer = "\u{e425}"
    static let add = "\u{e145}"
    static let remove = "\u{e15b}"
    static let recordVoiceOver = "\u{e91f}"
    static let workOutline = "\u{e943}"
    static let darkMode = "\u{e51c}"
    static let piano = "\u{e521}"
    static let album = "\u{e019}"
    static let chevronLeft = "\u{e5cb}"
    static let chevronRight = "\u{e5cc}"
    static let close = "\u{e5cd}"
    static let check = "\u{e5ca}"
    static let checkCircle = "\u{e86c}"
    static let formatAlignLeft = "\u{e236}"
    static let notes = "\u{e26c}"
    static let contentCopy = "\u{e14d}"
    /// library_add_check：多选复制
    static let libraryAddCheck = "\u{e9b7}"
    static let iosShare = "\u{e6b8}"
    static let bookmark = "\u{e866}"
    // 读经计划页（手机版精简排版）：要点 chips / 怎么读 / 轨道图标 / 展开收起
    static let today = "\u{e8df}"
    static let loop = "\u{e028}"
    static let swapHoriz = "\u{e8d4}"
    static let stairs = "\u{f1a9}"
    static let repeatGlyph = "\u{e040}"
    static let sync = "\u{e627}"
    static let spa = "\u{eb4c}"
    static let replay = "\u{e042}"
    static let calendarMonth = "\u{ebcc}"
    static let layers = "\u{e53b}"
    static let historyEdu = "\u{ea3e}"
    static let autoStories = "\u{e666}"
    static let lightbulb = "\u{e0f0}"
    static let expandMore = "\u{e5cf}"
    static let expandLess = "\u{e5ce}"
    static let arrowForward = "\u{e5c8}"
}

/// MaterialCommunityIcons 码位
enum MCI {
    static let accountVoice = "\u{f05cb}"
    static let musicNoteOutline = "\u{f0f74}"
    static let coffeeOutline = "\u{f06ca}"
    // 首页环境音九槽 + 场景条「模糊」（RN NATURE_AMBIENT_SCENE_SLOTS icon / HomeSceneThumb icon="blur"）
    static let water = "\u{f058c}"
    static let weatherRainy = "\u{f0597}"
    static let bird = "\u{f15c6}"
    static let radioTower = "\u{f043b}"
    static let weatherWindy = "\u{f059d}"
    static let fire = "\u{f0238}"
    static let waves = "\u{f078d}"
    static let weatherLightning = "\u{f0593}"
    static let coffee = "\u{f0176}"
    static let blur = "\u{f00b5}"
    static let churchOutline = "\u{f1b02}"
}

/// RN `MUSIC_ALBUM_ICON` + `COMMUNITY_ALBUM_ICONS`：专辑 → 字形（安静 / 下午茶 / 赞美诗 走 MaterialCommunityIcons）
enum MusicAlbumGlyph {
    static func glyph(_ album: String) -> (glyph: String, community: Bool) {
        switch album {
        case "安静": return (MCI.musicNoteOutline, true)
        case "下午茶": return (MCI.coffeeOutline, true)
        case "赞美诗": return (MCI.churchOutline, true)
        case "专注工作": return (MI.workOutline, false)
        case "睡眠": return (MI.darkMode, false)
        case "钢琴": return (MI.piano, false)
        default: return (MI.album, false)
        }
    }
}

/// 一个 Material 字形。`size` 就是 RN `<MaterialIcons size>` 的 size（字号 = 图标框）。
struct MaterialIcon: View {
    let glyph: String
    var size: CGFloat
    var color: Color
    var community = false

    var body: some View {
        Text(glyph)
            .font(.custom(community ? IconFont.community : IconFont.material, fixedSize: size))
            .foregroundStyle(color)
            .frame(width: size, height: size)
    }
}
