import SwiftUI

/// 收藏页。对应 RN ReadFavoritesScreen：标题「收藏」22/600、引导语 13/20 muted、
/// 每条：书名 章:节 · 译本（14/600 faint，译本 400）+ 经文（verse 字号 500，最多 4 行）+ 右侧 bookmark 图标（点了取消收藏）。
struct FavoritesView: View {
    @ObservedObject var bookmarks: VerseBookmarkStore
    var size: ReadSize = .default
    var locale: AppLocale = .zhCN
    var onBack: () -> Void
    var onOpen: (VerseBookmark) -> Void

    private let theme = Parchment.light

    var body: some View {
        GeometryReader { geo in
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    Button(action: onBack) {
                        Image(systemName: "chevron.left").font(.system(size: 22, weight: .semibold))
                            .foregroundStyle(theme.ink).frame(width: 44, height: 44, alignment: .leading)
                    }
                    .buttonStyle(.plain)

                    Text(SiteCopy.t("pages.read.favoritesTitle", locale)).font(.system(size: 22, weight: .semibold)).foregroundStyle(theme.ink)
                        .frame(maxWidth: .infinity).padding(.bottom, 8)
                    Text(SiteCopy.t("pages.read.favoritesLead", locale)).font(.system(size: 13)).lineSpacing(7)
                        .foregroundStyle(theme.muted).multilineTextAlignment(.center).frame(maxWidth: .infinity).padding(.bottom, 16)

                    let list = bookmarks.list
                    if list.isEmpty {
                        Text(SiteCopy.t("pages.read.favoritesEmpty", locale)).font(.system(size: 14)).lineSpacing(8).foregroundStyle(theme.muted)
                            .frame(maxWidth: .infinity).padding(.top, 24)
                    }
                    ForEach(list) { item in
                        HStack(alignment: .top, spacing: 8) {
                            Button { onOpen(item) } label: {
                                VStack(alignment: .leading, spacing: 6) {
                                    (Text("\(BibleCatalog.book(id: item.bookId)?.name(locale) ?? item.bookName) \(item.chapter):\(item.verse)")
                                        .font(.system(size: 14, weight: .semibold)).foregroundColor(theme.faint)
                                     + Text(" · \((ScriptureTranslation.find(item.translationId)?.labelZh ?? item.translationId))")
                                        .font(.system(size: 14)).foregroundColor(theme.faint))
                                    Text(item.text)
                                        .font(.system(size: size.metrics.verseFontSize, weight: .medium))
                                        .lineSpacing(size.metrics.verseLineSpacing)
                                        .foregroundStyle(theme.inkSoft).lineLimit(4)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .buttonStyle(.plain)
                            Button {
                                bookmarks.toggle(bookId: item.bookId, bookName: item.bookName, chapter: item.chapter, verse: item.verse,
                                                 translationId: item.translationId, text: item.text)
                            } label: {
                                MaterialIcon(glyph: MI.bookmark, size: 22, color: theme.faint).padding(.top, 2).padding(.leading, 4)
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.vertical, 14)
                        .overlay(alignment: .top) { Rectangle().fill(theme.border).frame(height: 1 / UIScreen.main.scale) }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 20 + geo.safeAreaInsets.top)
                .padding(.bottom, ShellMetrics.tabBarClearance + 28 + geo.safeAreaInsets.bottom + 120)
            }
            .ignoresSafeArea(edges: [.top, .bottom])
            .parchmentFade(.tabbar)
        }
        .background(ParchmentBackground(theme: theme).ignoresSafeArea())
    }
}
