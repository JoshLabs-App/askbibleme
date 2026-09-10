import Foundation

/// 探索页精选文章目录（查经资料）。由 tools/gen-explore-articles.mjs 生成，勿手改。
/// 图标是 MaterialCommunityIcons 码位（与 RN exploreFeaturedArticleIcons 同源）；prose = 长文版式（不分段折叠）。
enum ExploreArticleCatalog {
    struct Entry { let slug: String; let icon: String; let prose: Bool }

    static let entries: [Entry] = [
        Entry(slug: "a-mnw5wdz7-14908d", icon: "\u{f0186}", prose: true),
        Entry(slug: "a-mnwkmd4g-cb4d00", icon: "\u{f0e85}", prose: true),
        Entry(slug: "article_1778108127353_fzymbc", icon: "\u{f018c}", prose: true),
        Entry(slug: "a-macarthur-lifelong-bible-reading", icon: "\u{f137b}", prose: true),
    ]

    /// 读经计划器的占位文章：探索格子里不出现（RN gridFeaturedArticles 同样过滤）
    static let readingPlannerSlug = "article_1778108127353_fzymbc"
    static let fallbackIcon = "\u{f09ee}"

    static func entry(_ slug: String) -> Entry? { entries.first { $0.slug == slug } }
}
