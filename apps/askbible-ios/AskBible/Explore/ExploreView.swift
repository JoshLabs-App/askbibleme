import SwiftUI

/// 书房（原探索页）：全面去游戏化「手抄本藏书票与书卷火漆印」+「摘录与印记（四色划线与收藏合一）」+ 最近阅读 + 同系列软件。
struct ExploreView: View {
    @Binding var article: ExploreArticle?
    @ObservedObject var auth: MemberAuthStore
    @ObservedObject var activity: ReadingActivityStore
    var locale: AppLocale = .zhCN
    var onOpenLogin: () -> Void = {}
    var onSignOut: () -> Void = {}
    var onOpenSettings: () -> Void = {}
    var size: ReadSize = .default
    @ObservedObject var bookmarks: VerseBookmarkStore
    @ObservedObject var highlights: VerseHighlightStore
    var onOpenVerse: (_ bookId: String, _ chapter: Int, _ verse: Int) -> Void = { _, _, _ in }
    var onOpenFavorites: () -> Void = {}
    var onOpenChapter: (_ bookId: String, _ chapter: Int) -> Void = { _, _ in }
    var onOpenAchievements: () -> Void = {}

    @Environment(\.parchment) private var theme
    @State private var nameEditorOpen = false
    @State private var nameDraft = ""
    @State private var sharePayload: VerseSharePayload?
    @State private var undoMessage: String?
    @State private var undoAction: (() -> Void)?
    @State private var undoTask: Task<Void, Never>?

    var body: some View {
        if let a = article {
            ExploreArticleView(article: a, size: size, onBack: { article = nil },
                               onOpenChapter: onOpenChapter, onOpenArticle: { article = $0 })
                .edgeSwipeBack { article = nil }
        } else {
            page
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
            ZStack(alignment: .bottom) {
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 22) {
                        // 顶栏：温润问候语 + 右上设置圆钮
                        HStack(alignment: .top, spacing: 12) {
                            Button {
                                if auth.user != nil {
                                    nameDraft = auth.user?.name ?? ""
                                    nameEditorOpen = true
                                } else {
                                    onOpenLogin()
                                }
                            } label: {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(greetingText)
                                        .askFont(size: 26, weight: .bold)
                                        .foregroundStyle(theme.ink)
                                        .lineLimit(1)
                                    Text(auth.user != nil
                                         ? AppLocale.pick("进入优先于完成 · 私人读经书房", "Entry over completion · Personal study", locale)
                                         : AppLocale.pick("点此登录，跨设备同步印记与摘录 ›", "Tap to sign in and sync notes & seals ›", locale))
                                        .askFont(size: 13)
                                        .foregroundStyle(auth.user != nil ? theme.muted : theme.accentOt)
                                }
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)

                            Spacer(minLength: 8)

                            Button(action: onOpenSettings) {
                                Image(systemName: "gearshape")
                                    .font(.system(size: 18, weight: .semibold))
                                    .foregroundStyle(theme.ink.opacity(0.82))
                                    .frame(width: 40, height: 40)
                                    .background(Circle().fill(theme.surface.opacity(0.85)))
                                    .overlay(Circle().strokeBorder(theme.border, lineWidth: 1))
                                    .contentShape(Circle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(AppLocale.pick("偏好设置", "Preferences", locale))
                        }
                        .padding(.top, 20)

                        // 去游戏化「手抄本藏书票与书卷火漆印」卡片
                        Button(action: onOpenAchievements) {
                            XPBar(readDaysOverride: activity.readDays)
                                .padding(16)
                                .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(theme.surface))
                                .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(theme.borderStrong, lineWidth: 1))
                        }
                        .buttonStyle(.plain)

                        // 统一的摘录与四色印记模块（前 6 条 + 全部入口）
                        UnifiedNotesBlock(
                            bookmarks: bookmarks,
                            highlights: highlights,
                            locale: locale,
                            limit: 6,
                            onOpenVerse: onOpenVerse,
                            onOpenMore: onOpenFavorites,
                            onShareCard: { sharePayload = $0 },
                            onUndoAvailable: { msg, restore in
                                presentUndo(msg, restore: restore)
                            }
                        )

                        // 最近阅读轨迹
                        recentSection

                        // 同系列圣经软件（D-42）
                        SiblingAppsSection(locale: locale)
                            .padding(.horizontal, -22)

                        Color.clear.frame(height: ShellMetrics.tabBarClearance + geo.safeAreaInsets.bottom + 110)
                    }
                    .padding(.horizontal, 22)
                }
                .ignoresSafeArea(edges: .bottom)
                .parchmentFade(.tabbar)

                if let msg = undoMessage {
                    UndoCapsuleToast(message: msg, locale: locale) {
                        undoTask?.cancel()
                        undoAction?()
                        withAnimation(.easeOut(duration: 0.18)) { undoMessage = nil; undoAction = nil }
                    }
                    .padding(.bottom, ShellMetrics.tabBarClearance + geo.safeAreaInsets.bottom + 18)
                }

                if let payload = sharePayload {
                    VerseShareCardSheet(payload: payload, locale: locale) {
                        sharePayload = nil
                    }
                    .zIndex(30)
                }
            }
            .background(ParchmentBackground(theme: theme).ignoresSafeArea())
        }
    }

    private var recentSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(SiteCopy.t("native.recentReading", locale))
                    .askFont(size: 16, weight: .bold)
                    .foregroundStyle(theme.ink)
                Spacer()
                if activity.listenTotalSec > 60 {
                    Text(SiteCopy.f("native.listenTotal", ["duration": MemberReadingSyncRules.formatListenDuration(totalSec: Int(activity.listenTotalSec), en: locale == .en)], locale))
                        .askFont(size: 12)
                        .foregroundStyle(theme.faint)
                }
            }

            if activity.recent.isEmpty {
                Text(SiteCopy.t("native.noReadingRecord", locale))
                    .askFont(size: 13.5)
                    .foregroundStyle(theme.faint)
                    .padding(.vertical, 8)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(activity.recent.prefix(4).enumerated()), id: \.element.id) { idx, item in
                        if idx > 0 { Divider().overlay(theme.border) }
                        Button { onOpenChapter(item.bookId, item.chapter) } label: {
                            HStack {
                                Text(recentLabel(item))
                                    .askFont(size: 15.5, weight: .medium)
                                    .foregroundStyle(theme.ink)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(theme.muted.opacity(0.6))
                            }
                            .frame(height: 42)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 14)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(theme.surface.opacity(0.75)))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(theme.border, lineWidth: 0.75))
            }
        }
    }

    private func recentLabel(_ item: ReadingActivityStore.RecentChapter) -> String {
        let name = BibleCatalog.book(id: item.bookId)?.name(locale) ?? locale.zh(item.bookName)
        return locale == .en ? "\(name) \(item.chapter)" : SiteCopy.f("native.chapterUnit", ["bookName": name, "chapter": "\(item.chapter)"], locale)
    }

    private var greetingText: String {
        guard let user = auth.user else {
            return AppLocale.pick("平安，旅人", "Peace, friend", locale)
        }
        let n = MemberAuthRules.shortAccountName(user.name.isEmpty ? user.email : user.name)
        let who = n.isEmpty ? SiteCopy.t("native.authDefaultName", locale) : n
        return AppLocale.pick("平安，\(who)", "Peace, \(who)", locale)
    }

    private func presentUndo(_ msg: String, restore: @escaping () -> Void) {
        undoTask?.cancel()
        undoAction = restore
        withAnimation(.easeOut(duration: 0.18)) { undoMessage = msg }
        undoTask = Task {
            try? await Task.sleep(for: .seconds(3.4))
            if Task.isCancelled { return }
            await MainActor.run {
                withAnimation(.easeIn(duration: 0.2)) { undoMessage = nil; undoAction = nil }
            }
        }
    }
}
