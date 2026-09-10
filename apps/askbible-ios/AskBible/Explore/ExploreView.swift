import SwiftUI

/// 探索页：统计 → 使用时长 → 最近阅读。
/// 九宫格功能块（欢迎 / 读经计划 / 数算年日 / 圣经人物…）按 Josh 的决定只留网站，App 暂不放（2026-09-09）。
struct ExploreView: View {
    /// 当前打开的文章由 shell 持有：读经计划页的「麦克阿瑟研经法」链接要能从别的 Tab 直接打开一篇
    @Binding var article: ExploreArticle?
    /// 会员状态：抬头「请登录，解锁更多」→ 登录页；登录后「你好，名字」→ 改称呼
    @ObservedObject var auth: MemberAuthStore
    var locale: AppLocale = .zhCN
    var onOpenLogin: () -> Void = {}
    var size: ReadSize = .default
    /// 文章里的经文链接 → 读经 Tab 打开那一章
    var onOpenChapter: (_ bookId: String, _ chapter: Int) -> Void = { _, _ in }

    private let theme = Parchment.light
    @State private var nameEditorOpen = false
    @State private var nameDraft = ""

    private let recent = ["创世记 1章", "创世记 3章", "创世记 2章"]

    var body: some View {
        if let a = article {
            ExploreArticleView(article: a, size: size, onBack: { article = nil },
                               onOpenChapter: onOpenChapter, onOpenArticle: { article = $0 })
        } else {
            page
                // RN ExploreGreetingNameModal：改称呼（最多 24 字）
                .alert(locale.zh("修改称呼"), isPresented: $nameEditorOpen) {
                    TextField(locale.zh("你的名字"), text: $nameDraft)
                    Button(locale.zh("取消"), role: .cancel) {}
                    Button(locale.zh("保存")) { let n = nameDraft; Task { _ = await auth.updateDisplayName(n) } }
                        .disabled(!MemberAuthRules.isValidDisplayName(nameDraft))
                }
        }
    }

    private var page: some View {
        GeometryReader { geo in
            let safeTop = geo.safeAreaInsets.top
            ZStack {
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 0) {
                        // RN ExploreScreen 抬头：没登录点了去登录页；登录了显示「你好，名字」，点了改称呼
                        Button {
                            if auth.user != nil { nameDraft = auth.user?.name ?? ""; nameEditorOpen = true } else { onOpenLogin() }
                        } label: {
                            Text(locale.zh(MemberAuthRules.greeting(auth.user)))
                                .font(.system(size: 25, weight: .bold))
                                .foregroundStyle(theme.ink)
                                .lineLimit(1)
                        }
                        .buttonStyle(.plain)
                        .padding(.top, safeTop + 37)
                        if auth.user != nil {
                            // RN 的「退出登录」在侧边抽屉里；原生版还没有抽屉，先放在抬头下面
                            Button { auth.signOut() } label: {
                                Text(locale.zh("退出登录")).font(.system(size: 13)).underline().foregroundStyle(theme.faint)
                            }
                            .buttonStyle(.plain).padding(.top, 8)
                        }

                        progressLine.padding(.top, 26)

                        statsRow.padding(.top, 22)

                        Text("使用时长 8 小时 25 分钟")
                            .font(.system(size: 17))
                            .foregroundStyle(theme.muted)
                            .padding(.top, 18)
                        Text("累计听 46 分钟")
                            .font(.system(size: 17))
                            .foregroundStyle(theme.muted)
                            .padding(.top, 6)

                        Text("最近阅读")
                            .font(.system(size: 15))
                            .foregroundStyle(theme.faint)
                            .padding(.top, 20)

                        VStack(spacing: 0) {
                            ForEach(recent, id: \.self) { item in
                                HStack {
                                    Text(item)
                                        .font(.system(size: 18))
                                        .foregroundStyle(theme.ink)
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .font(.system(size: 12, weight: .semibold))
                                        .foregroundStyle(theme.muted.opacity(0.5))
                                }
                                .frame(height: 38)
                            }
                        }
                        .padding(.horizontal, 26)
                        .padding(.top, 8)

                        // 查经资料：RN 探索格子里的精选文章（section 上 36 + 8，格子上 16 + 8，3 列 gap 10）
                        articleGrid(width: geo.size.width)
                            .padding(.top, 36 + 8 + 16 + 8)
                            .padding(.horizontal, 22)

                        // RN：72 + 安全区 + 120（渐隐区）+ 探索首页再多留 120
                        Color.clear.frame(height: ShellMetrics.tabBarClearance + geo.safeAreaInsets.bottom + 120 + 120)
                    }
                }
                .ignoresSafeArea(edges: .bottom)
                .parchmentFade(.tabbar)
            }
            .background(ParchmentBackground(theme: theme).ignoresSafeArea())
        }
    }

    /// RN renderArticleTile：64 圆角 18 的浅底圈 + MaterialCommunityIcons 28 ink + 12/600 两行标签，列宽按 useExploreIconGridLayout
    private func articleGrid(width: CGFloat) -> some View {
        let cols = 3
        let gap: CGFloat = 10
        let gridWidth = min(width, 448) - 22 * 2
        let tileW = floor((gridWidth - gap * CGFloat(cols - 1)) / CGFloat(cols))
        let items = ExploreArticles.grid
        return VStack(alignment: .leading, spacing: gap) {
            ForEach(Array(stride(from: 0, to: items.count, by: cols)), id: \.self) { start in
                HStack(alignment: .top, spacing: gap) {
                    ForEach(items[start..<min(start + cols, items.count)]) { a in
                        Button { article = a } label: {
                            VStack(spacing: 10) {
                                MaterialIcon(glyph: a.icon, size: 28, color: theme.ink, community: true)
                                    .frame(width: 64, height: 64)
                                    .background(RoundedRectangle(cornerRadius: 18).fill(Color(rgb: 0xFFFCF5, opacity: 0.55)))
                                    .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(theme.border, lineWidth: 1 / UIScreen.main.scale))
                                Text(a.exploreLabel)
                                    .font(.system(size: 12, weight: .semibold))
                                    .lineSpacing(3)
                                    .foregroundStyle(theme.ink)
                                    .multilineTextAlignment(.center)
                                    .lineLimit(2)
                                    .frame(width: tileW)
                            }
                            .frame(width: tileW)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var progressLine: some View {
        ZStack {
            Capsule().fill(theme.border.opacity(0.8)).frame(height: 3)
            Circle().fill(theme.parchmentAccent).frame(width: 11, height: 11)
        }
        .padding(.horizontal, 52)
    }

    private var statsRow: some View {
        HStack(spacing: 0) {
            stat("251", "今年已过", theme.parchmentAccent)
            divider
            stat("2", "读经天", Color(rgb: 0x4F7A54))
            divider
            stat("1", "连续天", Color(rgb: 0x4F7A54))
        }
        .padding(.horizontal, 24)
    }

    private var divider: some View {
        Rectangle().fill(theme.border.opacity(0.8)).frame(width: 1, height: 56)
    }

    private func stat(_ value: String, _ label: String, _ color: Color) -> some View {
        VStack(spacing: 6) {
            Text(value)
                .font(.system(size: 34, weight: .bold))
                .foregroundStyle(color)
            Text(label)
                .font(.system(size: 15))
                .foregroundStyle(theme.muted)
        }
        .frame(maxWidth: .infinity)
    }
}
