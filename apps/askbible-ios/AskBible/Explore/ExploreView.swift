import SwiftUI

/// 探索页：统计 → 使用时长 → 最近阅读。
/// 九宫格功能块（欢迎 / 读经计划 / 数算年日 / 圣经人物…）按 Josh 的决定只留网站，App 暂不放（2026-09-09）。
struct ExploreView: View {
    /// 当前打开的文章由 shell 持有：读经计划页的「麦克阿瑟研经法」链接要能从别的 Tab 直接打开一篇
    @Binding var article: ExploreArticle?
    /// 会员状态：抬头「请登录，解锁更多」→ 登录页；登录后「你好，名字」→ 改称呼
    @ObservedObject var auth: MemberAuthStore
    /// 读经活动：今年已过 / 读经天 / 连续天 / 使用时长 / 累计听 / 最近阅读（RN ExploreReadingHabitStats）
    @ObservedObject var activity: ReadingActivityStore
    var locale: AppLocale = .zhCN
    var onOpenLogin: () -> Void = {}
    /// 退出登录（先把本机进度推上云端再清本机，由壳接线）
    var onSignOut: () -> Void = {}
    var size: ReadSize = .default
    /// 文章里的经文链接 → 读经 Tab 打开那一章
    var onOpenChapter: (_ bookId: String, _ chapter: Int) -> Void = { _, _ in }

    private let theme = Parchment.light
    @State private var nameEditorOpen = false
    @State private var nameDraft = ""


    var body: some View {
        if let a = article {
            ExploreArticleView(article: a, size: size, onBack: { article = nil },
                               onOpenChapter: onOpenChapter, onOpenArticle: { article = $0 })
                .edgeSwipeBack { article = nil }
        } else {
            page
                // RN ExploreGreetingNameModal：改称呼（最多 24 字）
                .alert(SiteCopy.t("pages.explore.greetingEditTitle", locale), isPresented: $nameEditorOpen) {
                    TextField(SiteCopy.t("pages.explore.birthYearModalNamePlaceholder", locale), text: $nameDraft)
                    Button(SiteCopy.t("native.cancel", locale), role: .cancel) {}
                    Button(SiteCopy.t("native.save", locale)) { let n = nameDraft; Task { _ = await auth.updateDisplayName(n) } }
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
                            Text(greetingText)
                                .font(.system(size: 25, weight: .bold))
                                .foregroundStyle(theme.ink)
                                .lineLimit(1)
                        }
                        .buttonStyle(.plain)
                        .padding(.top, safeTop + 37)
                        if auth.user != nil {
                            // RN 的「退出登录」在侧边抽屉里；原生版还没有抽屉，先放在抬头下面
                            Button { onSignOut() } label: {
                                Text(SiteCopy.t("auth.drawerLogout", locale)).font(.system(size: 13)).underline().foregroundStyle(theme.faint)
                            }
                            .buttonStyle(.plain).padding(.top, 8)
                        }

                        progressLine.padding(.top, 26)

                        statsRow.padding(.top, 22)

                        Text(usageLine)
                            .font(.system(size: 17))
                            .foregroundStyle(theme.muted)
                            .padding(.top, 18)
                        Text(listenLine)
                            .font(.system(size: 17))
                            .foregroundStyle(theme.muted)
                            .padding(.top, 6)

                        Text(SiteCopy.t("native.recentReading", locale))
                            .font(.system(size: 15))
                            .foregroundStyle(theme.faint)
                            .padding(.top, 20)

                        VStack(spacing: 0) {
                            ForEach(activity.recent) { item in
                                Button { onOpenChapter(item.bookId, item.chapter) } label: {
                                    HStack {
                                        Text(recentLabel(item))
                                            .font(.system(size: 18))
                                            .foregroundStyle(theme.ink)
                                        Spacer()
                                        Image(systemName: "chevron.right")
                                            .font(.system(size: 12, weight: .semibold))
                                            .foregroundStyle(theme.muted.opacity(0.5))
                                    }
                                    .frame(height: 38)
                                }
                                .buttonStyle(.plain)
                            }
                            if activity.recent.isEmpty {
                                Text(SiteCopy.t("native.noReadingRecord", locale))
                                    .font(.system(size: 15)).foregroundStyle(theme.faint)
                                    .frame(maxWidth: .infinity).frame(height: 38)
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

    /// 统计行跟界面语言走（三语文案见 SiteCopy；Josh 2026-09-10 决定补齐整套英文）
    private var isEn: Bool { locale == .en }
    private var usageLine: String {
        "\(SiteCopy.t("native.usageTime", locale))  \(MemberReadingSyncRules.formatUsageDuration(totalSec: Int(activity.usageTotalSec), en: isEn))"
    }
    private var listenLine: String {
        SiteCopy.f("native.listenTotal", ["duration": MemberReadingSyncRules.formatListenDuration(totalSec: Int(activity.listenTotalSec), en: isEn)], locale)
    }
    private func recentLabel(_ item: ReadingActivityStore.RecentChapter) -> String {
        let name = BibleCatalog.book(id: item.bookId)?.name(locale) ?? locale.zh(item.bookName)
        return isEn ? "\(name) \(item.chapter)" : SiteCopy.f("native.chapterUnit", ["bookName": name, "chapter": "\(item.chapter)"], locale)
    }
    /// 抬头：登录了「你好，名字」，没登录「请登录，解锁更多」（MemberAuthRules.greeting 的三语版）
    private var greetingText: String {
        guard let user = auth.user else { return SiteCopy.t("native.authGreetingGuest", locale) }
        let n = MemberAuthRules.shortAccountName(user.name)
        return SiteCopy.f("native.authGreetingNamed", ["name": n.isEmpty ? SiteCopy.t("native.authDefaultName", locale) : n], locale)
    }

    /// RN ReadYearDayTimeline：淡底轨 + 实色已读区段 + 今日橙点
    private var progressLine: some View {
        let tl = MemberReadingSyncRules.yearTimeline()
        let c = Calendar.current.dateComponents([.year, .month, .day], from: Date())
        let ranges = MemberReadingSyncRules.yearReadRanges(activity.completedDates, year: c.year!, month: c.month!, day: c.day!)
        return GeometryReader { g in
            let w = g.size.width
            let minW = 2 / Double(max(tl.daysInYear, 1))
            ZStack(alignment: .leading) {
                Capsule().fill(theme.border.opacity(0.8)).frame(height: 3).frame(maxHeight: .infinity)
                ForEach(Array(ranges.enumerated()), id: \.offset) { _, r in
                    let fr = MemberReadingSyncRules.rangeToTrackFraction(start: r.start, end: r.end, daysInYear: tl.daysInYear)
                    let drawW = max(fr.width, minW)
                    let drawLeft = min(fr.left, max(0, 1 - drawW))
                    Capsule().fill(Color(rgb: 0xE8A017)).frame(width: w * drawW, height: 5)
                        .frame(maxHeight: .infinity).offset(x: w * drawLeft)
                }
                Circle().fill(theme.parchmentAccent).frame(width: 11, height: 11)
                    .frame(maxHeight: .infinity).offset(x: w * tl.progress - 5.5)
            }
        }
        .frame(height: 22)
        .padding(.horizontal, 52)
    }

    private var statsRow: some View {
        let tl = MemberReadingSyncRules.yearTimeline()
        return HStack(spacing: 0) {
            stat(String(tl.dayOfYear), SiteCopy.t("pages.read.todayReadingStatYearDayLabel", locale), theme.parchmentAccent)
            divider
            stat(String(activity.readDays), SiteCopy.t("pages.read.todayReadingStatReadLabel", locale), Color(rgb: 0x4F7A54))
            divider
            stat(String(activity.streakDays), SiteCopy.t("pages.read.todayReadingStatStreakLabel", locale), Color(rgb: 0x4F7A54))
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
