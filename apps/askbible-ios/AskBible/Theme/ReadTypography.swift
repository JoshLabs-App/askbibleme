import SwiftUI

/// 读经排版档位。逐值搬自 RN 版 `src/read/read-bible-typography-prefs.ts` 的 PX 表，
/// 与网站 `read-bible-typography-prefs` 的 rem×16 对齐。共 15 档。
enum ReadSize: String, CaseIterable, Identifiable {
    case xs, s, m, l, xl, xxl, xxxl, xxxxl, xxxxxl, xxxxxxl
    case xxxxxxxl, xxxxxxxxl, xxxxxxxxxl, xxxxxxxxxxl, xxxxxxxxxxxl

    var id: String { rawValue }

    /// 默认档，与 RN 版一致
    static let `default`: ReadSize = .m

    var metrics: ReadTypographyMetrics { ReadTypographyMetrics.table[self]! }

    var next: ReadSize? {
        let all = ReadSize.allCases
        guard let i = all.firstIndex(of: self), i + 1 < all.count else { return nil }
        return all[i + 1]
    }

    var previous: ReadSize? {
        let all = ReadSize.allCases
        guard let i = all.firstIndex(of: self), i > 0 else { return nil }
        return all[i - 1]
    }
}

struct ReadTypographyMetrics {
    let verseFontSize: CGFloat
    let verseLineHeight: CGFloat
    let verseNumFontSize: CGFloat
    let chapterTitleSize: CGFloat
    let catalogBookSize: CGFloat
    let catalogBookLine: CGFloat

    /// SwiftUI 的 lineSpacing 是「行间距」而不是「行高」，需要减掉字号本身
    var verseLineSpacing: CGFloat { max(0, verseLineHeight - verseFontSize) }

    static let table: [ReadSize: ReadTypographyMetrics] = [
        .xs:           .init(verseFontSize: 15, verseLineHeight: 26,  verseNumFontSize: 14, chapterTitleSize: 21, catalogBookSize: 16, catalogBookLine: 22),
        .s:            .init(verseFontSize: 17, verseLineHeight: 29,  verseNumFontSize: 15, chapterTitleSize: 23, catalogBookSize: 18, catalogBookLine: 24),
        .m:            .init(verseFontSize: 19, verseLineHeight: 33,  verseNumFontSize: 16, chapterTitleSize: 26, catalogBookSize: 20, catalogBookLine: 26),
        .l:            .init(verseFontSize: 21, verseLineHeight: 36,  verseNumFontSize: 17, chapterTitleSize: 28, catalogBookSize: 21, catalogBookLine: 27),
        .xl:           .init(verseFontSize: 24, verseLineHeight: 41,  verseNumFontSize: 18, chapterTitleSize: 31, catalogBookSize: 22, catalogBookLine: 29),
        .xxl:          .init(verseFontSize: 27, verseLineHeight: 46,  verseNumFontSize: 19, chapterTitleSize: 34, catalogBookSize: 23, catalogBookLine: 30),
        .xxxl:         .init(verseFontSize: 30, verseLineHeight: 51,  verseNumFontSize: 20, chapterTitleSize: 37, catalogBookSize: 24, catalogBookLine: 32),
        .xxxxl:        .init(verseFontSize: 34, verseLineHeight: 58,  verseNumFontSize: 21, chapterTitleSize: 41, catalogBookSize: 25, catalogBookLine: 33),
        .xxxxxl:       .init(verseFontSize: 37, verseLineHeight: 63,  verseNumFontSize: 22, chapterTitleSize: 44, catalogBookSize: 26, catalogBookLine: 34),
        .xxxxxxl:      .init(verseFontSize: 42, verseLineHeight: 71,  verseNumFontSize: 23, chapterTitleSize: 49, catalogBookSize: 27, catalogBookLine: 35),
        .xxxxxxxl:     .init(verseFontSize: 46, verseLineHeight: 78,  verseNumFontSize: 24, chapterTitleSize: 53, catalogBookSize: 28, catalogBookLine: 37),
        .xxxxxxxxl:    .init(verseFontSize: 52, verseLineHeight: 88,  verseNumFontSize: 26, chapterTitleSize: 58, catalogBookSize: 29, catalogBookLine: 38),
        .xxxxxxxxxl:   .init(verseFontSize: 58, verseLineHeight: 98,  verseNumFontSize: 28, chapterTitleSize: 64, catalogBookSize: 30, catalogBookLine: 40),
        .xxxxxxxxxxl:  .init(verseFontSize: 64, verseLineHeight: 108, verseNumFontSize: 30, chapterTitleSize: 70, catalogBookSize: 31, catalogBookLine: 41),
        .xxxxxxxxxxxl: .init(verseFontSize: 72, verseLineHeight: 120, verseNumFontSize: 32, chapterTitleSize: 78, catalogBookSize: 32, catalogBookLine: 42),
    ]
}

/// 首页金句排版。搬自 `src/home/verseTextStyle.ts` 的 verseTypography()：
/// body 24×scale / 行高 ×1.55，ref 18×scale / 行高 ×1.45，两者都是 700。
enum HomeVerseTypography {
    static func bodySize(scale: CGFloat = 1) -> CGFloat { (24 * scale).rounded() }
    static func bodyLineHeight(scale: CGFloat = 1) -> CGFloat { (bodySize(scale: scale) * 1.55).rounded() }
    static func refSize(scale: CGFloat = 1) -> CGFloat { (18 * scale).rounded() }
    static func refLineHeight(scale: CGFloat = 1) -> CGFloat { (refSize(scale: scale) * 1.45).rounded() }
    static func refTopGap(scale: CGFloat = 1) -> CGFloat { (12 * scale).rounded() }
}

/// 壳层几何。搬自 `shellTabBarStyles.ts` / `shellPlaybackTransportLayout.ts` /
/// `readTopChrome.ts` —— 这几个数字决定了各页切换时控件不跳位，禁止单边改。
enum ShellMetrics {
    // 底栏
    static let tabRowMaxWidth: CGFloat = 400
    static let tabRowPaddingH: CGFloat = 12
    static let tabRowHeight: CGFloat = 60
    static let tabButtonHeight: CGFloat = 52
    static let tabIconSize: CGFloat = 36
    static let fabSize: CGFloat = 60
    static let fabIconSize: CGFloat = 30
    static let fabMarginH: CGFloat = 8
    static let tabBarDockGap: CGFloat = 6
    static let tabBarMinBottomInset: CGFloat = 8

    // 读经顶部竖排
    static let topChromeOffset: CGFloat = 6
    static let topChromeButton: CGFloat = 50
    static let topChromeIcon: CGFloat = 32
    static let topChromeSizeLabel: CGFloat = 32
    static let topChromeGap: CGFloat = 5
    static let topChromeSideInset: CGFloat = 8

    /// 右上竖排第 index 个按钮的顶边（index 0 = 设置）
    static func topChromeTop(safeTop: CGFloat, index: Int) -> CGFloat {
        safeTop + topChromeOffset + CGFloat(index) * (topChromeButton + topChromeGap)
    }

    // 播放坞
    static let dockPaddingTop: CGFloat = 4
    static let dockPaddingH: CGFloat = 20
    static let dockMarginBottom: CGFloat = 2
    static let scrubberRowHeight: CGFloat = 23
    static let scrubberTimeGap: CGFloat = 8
    static let timeFontSize: CGFloat = 12
    static let timeLabelMinWidth: CGFloat = 36
    static let transportMainGap: CGFloat = 28
    static let loopButtonSize: CGFloat = 44
    static let transportButtonSize: CGFloat = 48
    static let playButtonSize: CGFloat = 64
    static let skipIconSize: CGFloat = 36
    static let playIconSize: CGFloat = 34
    static let loopIconSize: CGFloat = 24
    static let speedButtonSize: CGFloat = 56
    /// RN 是 3；Josh 2026-09-09 看真机「播放三角偏了」：字形本身框中心已偏右约 2pt，再挪 3 就明显偏，改成 0
    static let playIconNudge: CGFloat = 0

    /// 坞内容高度（一行进度 + transport），对应 SHELL_SCRIPTURE_DOCK_CONTENT_HEIGHT
    static let dockContentHeight: CGFloat =
        dockPaddingTop + scrubberRowHeight + dockMarginBottom
        + 2 + playButtonSize + dockMarginBottom

    /// 播放坞离屏幕底的距离 = 坞底 margin + gap + Tab 行 + 安全区
    static func dockBottomPad(safeBottom: CGFloat) -> CGFloat {
        dockMarginBottom + tabBarDockGap + tabRowHeight + max(safeBottom, tabBarMinBottomInset)
    }
}
