import SwiftUI

/// 探索文章页。对应 RN ExploreArticleScreen：顶距 40 + 安全区、系统返回、标题 24/600 + 发丝线、
/// 正文 Markdown；分段版式带「点按段落可展开或收起」折叠卡（当前四篇都是长文版式，整篇铺开）。
struct ExploreArticleView: View {
    let article: ExploreArticle
    var size: ReadSize = .default
    var onBack: () -> Void
    var onOpenChapter: (_ bookId: String, _ chapter: Int) -> Void
    var onOpenArticle: (ExploreArticle) -> Void

    private let theme = Parchment.light
    @State private var expanded: String?

    var body: some View {
        GeometryReader { geo in
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    Button(action: onBack) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 22, weight: .semibold))
                            .foregroundStyle(theme.ink)
                            .frame(width: 44, height: 44, alignment: .leading)
                    }
                    .buttonStyle(.plain)

                    // articleHeader：上 12 / 下 18 / 发丝线
                    Text(article.title)
                        .font(.system(size: 24, weight: .semibold))
                        .tracking(-0.3)
                        .lineSpacing(8)
                        .foregroundStyle(theme.ink)
                        .padding(.top, 12 + 8)
                        .padding(.bottom, 18)
                    Rectangle().fill(theme.border).frame(height: 1 / UIScreen.main.scale)

                    Group {
                        if !article.sections.isEmpty && !article.prose {
                            Text(SiteCopy.t("native.articleTapHint"))
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(theme.muted)
                                .frame(maxWidth: .infinity)
                                .padding(.bottom, 12)
                            sectionsAccordion
                        } else {
                            MarkdownBody(markdown: article.body, size: size, theme: theme)
                        }
                    }
                    .padding(.top, 18)
                }
                .padding(.horizontal, 22)
                .padding(.top, 40 + geo.safeAreaInsets.top)
                .padding(.bottom, ShellMetrics.tabBarClearance + geo.safeAreaInsets.bottom + 120)
            }
            .ignoresSafeArea(edges: [.top, .bottom])
            .parchmentFade(.tabbar)
        }
        .background(ParchmentBackground(theme: theme).ignoresSafeArea())
        .environment(\.openURL, OpenURLAction { url in
            switch ArticleLink.resolve(url) {
            case .chapter(let bookId, let chapter, _):
                onOpenChapter(bookId, chapter); return .handled
            case .article(let slug):
                if let a = ExploreArticles.article(slug) { onOpenArticle(a); return .handled }
                return .systemAction
            case nil:
                return .systemAction
            }
        })
        .onAppear { expanded = article.sections.first?.id }
    }

    /// RN ExploreFeaturedArticleSections：14 圆角卡、chapterCell 底、边 2×hairline、头 56 高、序号 + 标题 17/700 强调色、右侧 + / −
    private var sectionsAccordion: some View {
        VStack(spacing: 10) {
            ForEach(Array(article.sections.enumerated()), id: \.element.id) { i, s in
                VStack(spacing: 0) {
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) { expanded = expanded == s.id ? nil : s.id }
                    } label: {
                        HStack(alignment: .top, spacing: 12) {
                            HStack(alignment: .top, spacing: 8) {
                                Text("\(i + 1)").font(.system(size: 16, weight: .bold)).foregroundStyle(theme.parchmentAccent)
                                Text(s.title).font(.system(size: 17, weight: .bold)).foregroundStyle(theme.parchmentAccent)
                                    .lineLimit(3).multilineTextAlignment(.leading)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            Text(expanded == s.id ? "\u{2212}" : "+")
                                .font(.system(size: 22, weight: .bold)).foregroundStyle(theme.parchmentAccent)
                                .frame(width: 18)
                        }
                        .padding(.horizontal, 14).padding(.vertical, 12)
                        .frame(minHeight: 56)
                    }
                    .buttonStyle(.plain)
                    if expanded == s.id {
                        MarkdownBody(markdown: s.body, size: size, theme: theme)
                            .padding(.horizontal, 10).padding(.top, 2).padding(.bottom, 12)
                    }
                }
                .background(RoundedRectangle(cornerRadius: 14).fill(theme.chapterCell))
                .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(theme.chapterCellBorder, lineWidth: 2 / UIScreen.main.scale))
            }
        }
    }
}
