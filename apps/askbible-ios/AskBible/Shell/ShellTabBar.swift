import SwiftUI

enum ShellTab: String, CaseIterable, Identifiable {
    /// `.plan` 是底栏中央键那页（读经计划播放页）：与首页平级的主页面，底栏照常
    case home, panorama, music, plan, read, explore
    var id: String { rawValue }

    /// 与安卓 `ShellTabBar.kt` 同一套 MaterialIcons / MaterialCommunityIcons 字形
    var glyph: String {
        switch self {
        case .panorama: return "\u{e55b}"
        case .home: return MI.home
        case .music: return MI.musicNote
        case .plan: return MCI.accountVoice
        case .read: return MI.menuBook
        case .explore: return MI.explore
        }
    }

    func label(_ locale: AppLocale) -> String {
        switch (self, locale) {
        case (.panorama, .en): return "Panorama"
        case (.panorama, _): return "全景"
        case (.home, .en): return "Home"
        case (.home, .zhTW): return "首頁"
        case (.home, _): return "首页"
        case (.music, .en): return "Music"
        case (.music, .zhTW): return "音樂"
        case (.music, _): return "音乐"
        case (.plan, .en): return "Plan"
        case (.plan, .zhTW): return "讀經"
        case (.plan, _): return "读经"
        case (.read, .en): return "Bible"
        case (.read, .zhTW): return "聖經"
        case (.read, _): return "圣经"
        case (.explore, .en): return "Explore"
        case (.explore, _): return "探索"
        }
    }
}

/// 底栏：100% 对齐安卓 `ShellTabBar.kt`（D-45，不用苹果 Liquid Glass 胶囊或底栏文字）。
/// row maxWidth 400 / paddingH 12，左右两组各装 2 颗 36pt Material 图标，
/// 中间 account-voice 60×60 marginH 8；选中 LOGO 黄，未选中纯白带轻阴影。
struct ShellTabBar: View {
    @Binding var selection: ShellTab
    var locale: AppLocale = .zhCN
    var onCenterTap: () -> Void = {}

    var body: some View {
        HStack(spacing: 0) {
            HStack(spacing: 0) {
                tabButton(.home, active: selection == .home || selection == .music)
                tabButton(.panorama, active: selection == .panorama)
            }
            .frame(maxWidth: .infinity)

            centerFab
                .padding(.horizontal, ShellMetrics.fabMarginH)

            HStack(spacing: 0) {
                tabButton(.read, active: selection == .read)
                tabButton(.explore, active: selection == .explore)
            }
            .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, ShellMetrics.tabRowPaddingH)
        .frame(maxWidth: ShellMetrics.tabRowMaxWidth)
        .frame(maxWidth: .infinity)
    }

    private func tabButton(_ tab: ShellTab, active: Bool) -> some View {
        Button {
            selection = tab
        } label: {
            MaterialIcon(glyph: tab.glyph, size: ShellMetrics.tabIconSize,
                         color: active ? Brand.logo : Brand.tabBarIcon)
                .frame(maxWidth: .infinity)
                .frame(height: ShellMetrics.tabButtonHeight)
                .shellIconShadow()
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tab.label(locale))
        .accessibilityAddTraits(active ? .isSelected : [])
    }

    private var centerFab: some View {
        Button(action: onCenterTap) {
            MaterialIcon(glyph: MCI.accountVoice, size: ShellMetrics.fabIconSize,
                         color: selection == .plan ? Brand.logo : Color.white.opacity(0.92),
                         community: true)
                .frame(width: ShellMetrics.fabSize, height: ShellMetrics.fabSize)
                .shellIconShadow()
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(ShellTab.plan.label(locale))
        .accessibilityAddTraits(selection == .plan ? .isSelected : [])
    }
}

/// 壳层：100% 对齐安卓 `MainActivity.kt` 底部结构（D-45）。
/// - 有播放坞（`dockActive`）时，`ParchmentPinnedBottom` 连坞带底栏整宽无缝铺羊皮实底；
/// - 其余羊皮页底栏透明，正文在底栏前经 `ParchmentFade(.tabbar)` 自然渐隐；
/// - 首页闲置收起（`homeBarHidden`）时底栏淡出至 0，点击该区域仅唤回界面、不误切 Tab。
struct AskTabShell<Screen: View, Dock: View>: View {
    @Environment(\.parchment) private var theme
    @Binding var selection: ShellTab
    var locale: AppLocale
    var dockActive: Bool = false
    var showTabBar: Bool = true
    var homeBarHidden: Bool = false
    var onWakeHomeChrome: () -> Void = {}
    var onEnterPlan: () -> Void = {}
    @ViewBuilder var screen: (ShellTab) -> Screen
    @ViewBuilder var dock: () -> Dock

    var body: some View {
        GeometryReader { geo in
            let bottomPad = max(geo.safeAreaInsets.bottom, ShellMetrics.tabBarMinBottomInset)
            ZStack(alignment: .bottom) {
                screen(selection)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

                if showTabBar {
                    VStack(spacing: 0) {
                        if dockActive {
                            dock()
                            Spacer().frame(height: ShellMetrics.tabBarDockGap)
                        }
                        ZStack {
                            ShellTabBar(
                                selection: $selection,
                                locale: locale,
                                onCenterTap: onEnterPlan
                            )
                            .frame(height: ShellMetrics.tabRowHeight)
                            .opacity(homeBarHidden ? 0 : 1)
                            .animation(.easeInOut(duration: 0.3), value: homeBarHidden)

                            if homeBarHidden {
                                Color.clear
                                    .frame(height: ShellMetrics.tabRowHeight)
                                    .contentShape(Rectangle())
                                    .onTapGesture(perform: onWakeHomeChrome)
                            }
                        }
                        .padding(.bottom, bottomPad)
                    }
                    .frame(maxWidth: .infinity)
                    .background {
                        if dockActive {
                            ParchmentPinnedBottom()
                                .ignoresSafeArea(edges: .bottom)
                        }
                    }
                }
            }
            .ignoresSafeArea(edges: .bottom)
        }
        .background(theme.canvas.ignoresSafeArea())
    }
}

extension View {
    /// 让滚动内容在底栏（+ 播放坞）上方干净结束（对齐安卓 bottom contentPadding）。
    func shellBottomInset(hasDock: Bool = false) -> some View {
        safeAreaInset(edge: .bottom) {
            Color.clear.frame(
                height: ShellMetrics.tabRowHeight + ShellMetrics.tabBarDockGap
                    + (hasDock ? ShellMetrics.dockContentHeight : 0)
            )
        }
    }
}
