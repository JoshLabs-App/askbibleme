import SwiftUI

enum ShellTab: String, CaseIterable, Identifiable {
    case home, panorama, music, plan, read, explore
    var id: String { rawValue }

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

    var sfSymbol: String {
        switch self {
        case .home: return "house"
        case .panorama: return "scroll"
        case .music: return "music.note"
        case .plan: return "sun.horizon"
        case .read: return "book.closed"
        case .explore: return "safari"
        }
    }

    func label(_ locale: AppLocale) -> String {
        switch (self, locale) {
        case (.home, .en): return "Home"
        case (.home, .zhTW): return "首頁"
        case (.home, _): return "首页"
        case (.panorama, .en): return "Story"
        case (.panorama, _): return "全景"
        case (.music, .en): return "Music"
        case (.music, .zhTW): return "音樂"
        case (.music, _): return "音乐"
        case (.plan, .en): return "Today"
        case (.plan, _): return "今日"
        case (.read, .en): return "Bible"
        case (.read, .zhTW): return "聖經"
        case (.read, _): return "圣经"
        case (.explore, .en): return "Explore"
        case (.explore, .zhTW): return "探索"
        case (.explore, _): return "探索"
        }
    }
}

/// 五栏对称羊皮纸胶囊底栏：首页 · 全景 · 今日 · 圣经 · 探索（全端对齐）。
struct ShellTabBar: View {
    @Environment(\.parchment) private var theme
    @Binding var selection: ShellTab
    var locale: AppLocale = .zhCN
    var onCenterTap: () -> Void = {}
    var onReselectRead: () -> Void = {}

    var body: some View {
        let onScenery = selection == .home || selection == .music
        HStack(spacing: 4) {
            tabPill(.home, active: selection == .home || selection == .music) { selection = .home }
            tabPill(.panorama, active: selection == .panorama) { selection = .panorama }
            tabPill(.plan, active: selection == .plan) { onCenterTap() }
            tabPill(.read, active: selection == .read) {
                if selection == .read {
                    onReselectRead()
                } else {
                    selection = .read
                }
            }
            tabPill(.explore, active: selection == .explore) { selection = .explore }
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 4)
        .frame(maxWidth: 400)
        .background(
            Capsule()
                .fill(theme.isDark
                      ? Color(red: 34 / 255, green: 28 / 255, blue: 22 / 255).opacity(onScenery ? 0.92 : 0.96)
                      : Color(red: 238 / 255, green: 227 / 255, blue: 208 / 255).opacity(onScenery ? 0.92 : 0.96))
        )
        .overlay(
            Capsule()
                .strokeBorder(theme.border, lineWidth: 0.75)
        )
        .shadow(color: .black.opacity(0.14), radius: 10, x: 0, y: 4)
        .padding(.horizontal, 14)
        .frame(maxWidth: .infinity)
    }

    private func tabPill(_ tab: ShellTab, active: Bool, action: @escaping () -> Void) -> some View {
        let activeColor = theme.isDark ? Brand.logo : Color(red: 181 / 255, green: 93 / 255, blue: 8 / 255)
        let inactiveColor = theme.ink.opacity(0.76)
        return Button(action: action) {
            VStack(spacing: 2) {
                Image(systemName: tab.sfSymbol)
                    .font(.system(size: 18, weight: active ? .semibold : .regular))
                Text(tab.label(locale))
                    .askFont(size: 10.5, weight: active ? .bold : .medium)
                    .lineLimit(1)
            }
            .foregroundStyle(active ? activeColor : inactiveColor)
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .background {
                if active {
                    Capsule()
                        .fill(activeColor.opacity(0.16))
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tab.label(locale))
        .accessibilityAddTraits(active ? .isSelected : [])
    }
}

struct AskTabShell<Screen: View, Dock: View>: View {
    @Environment(\.parchment) private var theme
    @Binding var selection: ShellTab
    var locale: AppLocale
    var dockActive: Bool = false
    var showTabBar: Bool = true
    var homeBarHidden: Bool = false
    var onWakeHomeChrome: () -> Void = {}
    var onEnterPlan: () -> Void = {}
    var onReselectRead: () -> Void = {}
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
                                onCenterTap: onEnterPlan,
                                onReselectRead: onReselectRead
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
    func shellBottomInset(hasDock: Bool = false) -> some View {
        safeAreaInset(edge: .bottom) {
            Color.clear.frame(
                height: ShellMetrics.tabRowHeight + ShellMetrics.tabBarDockGap
                    + (hasDock ? ShellMetrics.dockContentHeight : 0)
            )
        }
    }
}
