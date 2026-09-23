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

    /// 原生 Tab 用的 SF Symbol。Josh 2026-09-15 批准 iOS 端换 SF Symbols（四端图标语言在 iOS 上分叉）：
    /// 系统 Tab Bar 只认 SF Symbol 才能拿到 Liquid Glass 的选中形变与正确的度量。
    var symbol: String {
        switch self {
        case .home: return "house.fill"
        case .music: return "music.note"
        case .plan: return "person.wave.2.fill"
        case .read: return "book.fill"
        case .explore: return "safari"
        }
    }

    /// 底栏文字。原来是纯图标栏（RN 同构），换原生栏后必须有标签 —— 系统要用它做无障碍与形变布局。
    func label(_ locale: AppLocale) -> String {
        switch (self, locale) {
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
        case (.explore, .zhTW): return "探索"
        case (.explore, _): return "探索"
        }
    }
}

/// 壳层。DECISIONS 2026-09-15 第二轮：底栏交给系统。
///
/// 原来是自绘的 5 位栏（36pt Material 字形 + 60pt 中央 FAB + 双层黑影），现在是原生 `TabView`：
/// iOS 26 下这就是系统的 Liquid Glass Tab Bar（滚动时自动收拢、选中有形变、安全区由系统给），
/// 读经坞走 `tabViewBottomAccessory` 真正挂进 TabView，而不是我们自己在 ZStack 里浮一块。
/// iOS 17–25 拿到的是系统旧样式的栏 + 坞铺在栏上方 —— 同一套结构，两种材质，不是两套设计。
///
/// 中央「读经计划」不再是 FAB（Josh 2026-09-15 批准）：它就是第三个普通 Tab，
/// 切到它时由调用方 `onEnterPlan` 打开今日读经，行为与原来点 FAB 一致。
struct AskTabShell<Screen: View, Dock: View>: View {
    @Environment(\.parchment) private var theme
    @Binding var selection: ShellTab
    var locale: AppLocale
    /// 坞是否真的在显示（空坞也算「给了」，得另给一个明确的开关）
    var dockActive: Bool = false
    /// 坞贴底铺满（读经页），而不是浮在底栏上方的玻璃卡片
    var dockFlush: Bool = false
    /// 独立子页（读经计划目录 / 详情）与登录页不放底栏
    var showTabBar: Bool = true
    var onEnterPlan: () -> Void = {}
    @ViewBuilder var screen: (ShellTab) -> Screen
    @ViewBuilder var dock: () -> Dock

    var body: some View {
        base
            .onChange(of: selection) { _, tab in
                if tab == .plan { onEnterPlan() }
            }
    }

    @ViewBuilder private var base: some View { tabs }

    private var tabs: some View {
        TabView(selection: $selection) {
            ForEach(ShellTab.allCases) { tab in
                screen(tab)
                    .toolbar(showTabBar ? .visible : .hidden, for: .tabBar)
                    // 坞是我们自己的一块玻璃卡，不走 `tabViewBottomAccessory`（系统 accessory 只给一行高，
                    // 装不下封面 + 章名 + 进度 + 倒计时 + 大播放键 + 下一章那版布局）。
                    //
                    // **用 overlay 而不是 safeAreaInset**：safeAreaInset 会把滚动视图的可见范围压小，
                    // 经文被裁在坞的上边缘 —— 玻璃底下永远只有一片空白纸，于是怎么调材质都是「一块底色」
                    // （Josh 2026-09-16 连问三轮的就是这个）。改成浮层之后经文照常从坞底下穿过去，
                    // 玻璃才有东西可折射；滚动长度由各页的 `shellBottomInset()`（content margin）保证。
                    .overlay(alignment: .bottom) {
                        if dockActive {
                            if dockFlush {
                                // 读经页：坞贴底铺满，不做浮层卡片。
                                // Josh 2026-09-21「像音乐那样……而且固定在下方」——
                                // 浮层卡片四周都有经文绕过去，视觉上一直在动；贴底那条才安静。
                                dock()
                            } else {
                                dock()
                                    .askGlassRect(tone: .light, radius: AskCorner.sheet)
                                    .askFloatingShadow()
                                    .padding(.horizontal, AskGlassMetrics.capsuleInset)
                                    .padding(.bottom, 4)
                            }
                        }
                    }
                    .tabItem { Label(tab.label(locale), systemImage: tab.symbol) }
                    .tag(tab)
            }
        }
        // 选中态用琥珀（不是品牌黄）：系统栏是浅玻璃，#FFB101 在上面对比不够
        .tint(theme.isDark ? Brand.logo : theme.accentOt)
        // 底栏那一圈（浮起的胶囊四周 + 它下面到屏幕底边那一条）此前露的是系统窗口的白，
        // 羊皮纸只铺到内容区为止，看起来像页面下面垫了块白板（Josh 2026-09-23）。
        // 在 TabView 底下垫一层 canvas 并铺到安全区外，深色模式跟着 theme 翻。
        // 首页那张风景本来就 ignoresSafeArea，盖在这层上面，不受影响。
        .background(theme.canvas.ignoresSafeArea())
    }
}

extension View {
    /// 给滚动内容留出坞的高度 —— 用 **content margin**，不是 safeAreaInset：
    /// content margin 只加长滚动内容、不压小滚动视图，所以经文能滚到玻璃坞底下并透出来。
    /// 系统底栏那一截仍由系统自己计入安全区，这里只管坞。
    func shellBottomInset(hasDock: Bool = false) -> some View {
        contentMargins(.bottom, hasDock ? ShellMetrics.glassDockHeight : 0, for: .scrollContent)
    }
}
