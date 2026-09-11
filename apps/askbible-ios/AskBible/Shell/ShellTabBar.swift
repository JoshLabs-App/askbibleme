import SwiftUI

enum ShellTab: String, CaseIterable, Identifiable {
    /// `.plan` 是底栏中央键那页（读经计划播放页）：与首页平级的主页面，底栏照常；
    /// Josh 2026-09-09「中间计划与旁边的圣经，要直接就切换过来」
    case home, music, plan, read, explore
    var id: String { rawValue }

    /// 与 RN shellTabBarHelpers 同一套 MaterialIcons 字形
    var glyph: String {
        switch self {
        case .home: return MI.home
        case .music: return MI.musicNote
        case .plan: return MCI.accountVoice
        case .read: return MI.menuBook
        case .explore: return MI.explore
        }
    }
}

/// 底栏。几何逐值搬自 `shellTabBarStyles.ts`：
/// row maxWidth 400 / paddingH 12，左右两组各 flex 2 且 space-between，
/// 中间 account-voice FAB 60×60 marginH 8，tabBtn 高 52，图标 36。
/// 按这套算出的图标中心是 48.8 / 120.8 / 195 / 267 / 339（390pt 宽），与真机截图一致。
struct ShellTabBar: View {
    @Binding var selection: ShellTab
    var onCenterTap: () -> Void = {}

    var body: some View {
        HStack(spacing: 0) {
            HStack(spacing: 0) {
                tabButton(.home)
                tabButton(.music)
            }
            .frame(maxWidth: .infinity)

            centerFab
                .padding(.horizontal, ShellMetrics.fabMarginH)

            HStack(spacing: 0) {
                tabButton(.read)
                tabButton(.explore)
            }
            .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, ShellMetrics.tabRowPaddingH)
        .frame(maxWidth: ShellMetrics.tabRowMaxWidth)
        .frame(maxWidth: .infinity)
    }

    private func tabButton(_ tab: ShellTab) -> some View {
        Button {
            selection = tab
        } label: {
            MaterialIcon(glyph: tab.glyph, size: ShellMetrics.tabIconSize,
                         color: selection == tab ? Brand.logo : Brand.tabBarIcon)
                .frame(maxWidth: .infinity)
                .frame(height: ShellMetrics.tabButtonHeight)
                .shellIconShadow()
        }
        .buttonStyle(.plain)
    }

    /// 中央键只负责切到读经计划页，不负责播放 —— 与 `ShellScripturePlayFab` 一致；停在计划页时同其它 Tab 一样点亮 LOGO 黄
    private var centerFab: some View {
        Button(action: onCenterTap) {
            // RN ShellScripturePlayFab：MaterialCommunityIcons account-voice 30，白 .92
            MaterialIcon(glyph: MCI.accountVoice, size: ShellMetrics.fabIconSize,
                         color: selection == .plan ? Brand.logo : Color.white.opacity(0.92), community: true)
                .frame(width: ShellMetrics.fabSize, height: ShellMetrics.fabSize)
                .shellIconShadow()
        }
        .buttonStyle(.plain)
    }
}

/// 把底栏钉在屏幕底部。内容自己 ignoresSafeArea 铺满，底栏留在 safe area 内 ——
/// 系统给出的底部安全区就是 RN 版 `paddingBottom: max(insets.bottom, 8)` 的等价物。
///
/// 内容不被底栏遮挡靠各屏 ScrollView 的 `.shellBottomInset()`，不靠在底栏后面铺遮罩：
/// 用 Color 做 background 会无限扩张，把滚动内容整片盖掉。
struct ShellTabBarHost<Content: View>: View {
    @Binding var selection: ShellTab
    /// 羊皮卷各页要给底栏铺不透明底挡住滚过的内容；首页和音乐页是整屏视觉，透出背景
    var parchmentBar: Bool = false
    /// 中央键：进今日读经计划（RN ShellScripturePlayFab → plan-play）
    var onCenterTap: () -> Void = {}
    /// 读经坞是否真的在显示（dock 闭包总是给的，空坞也算「有」，得另给一个明确的开关）
    var dockActive: Bool = false
    /// 独立子页（读经计划目录 / 详情 / 今日读经）不放底栏：Josh「独立页下面无需放图标」，靠左上返回键回来
    var showTabBar: Bool = true
    @ViewBuilder var content: () -> Content
    var dock: (() -> AnyView)? = nil

    var body: some View {
        ZStack(alignment: .bottom) {
            content()

            // 底铺在整个「坞 + 间隙 + 底栏」外面：只铺底栏的话，坞和底栏之间 6pt 的间隙会透出滚过的经文
            if showTabBar {
            VStack(spacing: ShellMetrics.tabBarDockGap) {
                if let dock { dock() }
                ShellTabBar(selection: $selection, onCenterTap: onCenterTap)
                    .frame(height: ShellMetrics.tabRowHeight)
            }
            .background {
                // RN：只有读经坞出现时才在坞 + 底栏后面铺羊皮（scriptureDockParchmentHost，整屏图钉在屏幕底，与页面底图像素重合）；
                // 其余羊皮页底栏透明，正文靠 scroll mask 在底栏前渐隐 —— 之前这里整块铺一层会在坞顶露出一条硬边
                if parchmentBar, dockActive {
                    ParchmentPinnedBottom()
                        .ignoresSafeArea(edges: .bottom)
                }
            }
            }
        }
    }
}

extension View {
    /// 让滚动内容在底栏（+ 播放坞）上方结束
    func shellBottomInset(hasDock: Bool = false) -> some View {
        safeAreaInset(edge: .bottom) {
            Color.clear.frame(
                height: ShellMetrics.tabRowHeight + ShellMetrics.tabBarDockGap
                    + (hasDock ? ShellMetrics.dockContentHeight : 0)
            )
        }
    }
}
