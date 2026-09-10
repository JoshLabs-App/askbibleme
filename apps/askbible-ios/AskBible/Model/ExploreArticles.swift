import Foundation

/// 探索页精选文章（查经资料）。数据是 RN / 网站同一份 explore-featured-articles 文章包（zh-CN + en 两版），
/// 由 tools/gen-explore-articles.mjs 复制进 bundle；这里按语言取一版。
struct ExploreArticle: Identifiable, Equatable {
    struct Section: Equatable { let id: String; let title: String; let body: String }
    let slug: String
    let title: String
    let exploreLabel: String
    let body: String
    let sections: [Section]
    var id: String { slug }
    var icon: String { ExploreArticleCatalog.entry(slug)?.icon ?? ExploreArticleCatalog.fallbackIcon }
    /// 长文版式：整篇正文一次铺开；否则按 sections 折叠（RN exploreFeaturedArticleUsesProseLayout）
    var prose: Bool { ExploreArticleCatalog.entry(slug)?.prose ?? true }
}

enum ExploreArticles {
    static let locale = "zh-CN"

    static let all: [ExploreArticle] = {
        guard let url = Bundle.main.url(forResource: "explore-articles", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let items = root["articles"] as? [[String: Any]] else { return [] }
        return items.compactMap { item in
            guard let slug = item["slug"] as? String,
                  let block = (item[locale] as? [String: Any]) ?? (item["zh-CN"] as? [String: Any]) else { return nil }
            let sections = ((block["sections"] as? [[String: Any]]) ?? []).compactMap { s -> ExploreArticle.Section? in
                guard let id = s["id"] as? String, let title = s["title"] as? String, let body = s["body"] as? String else { return nil }
                return ExploreArticle.Section(id: id, title: title, body: body)
            }
            return ExploreArticle(
                slug: slug,
                title: (block["title"] as? String) ?? slug,
                exploreLabel: (block["exploreLabel"] as? String) ?? (block["title"] as? String) ?? slug,
                body: (block["body"] as? String) ?? "",
                sections: sections
            )
        }
    }()

    /// 探索格子里的文章：读经计划器的占位文章不出现（RN gridFeaturedArticles）
    static var grid: [ExploreArticle] { all.filter { $0.slug != ExploreArticleCatalog.readingPlannerSlug } }

    static func article(_ slug: String) -> ExploreArticle? { all.first { $0.slug == slug } }
}
