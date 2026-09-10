package me.askbible.native_.data

/**
 * 探索页精选文章目录（查经资料）。由 tools/gen-explore-articles.mjs 生成，勿手改。
 * 图标是 MaterialCommunityIcons 码位（与 RN exploreFeaturedArticleIcons 同源）；prose = 长文版式（不分段折叠）。
 */
object ExploreArticleCatalog {
    data class Entry(val slug: String, val icon: String, val prose: Boolean)

    val entries: List<Entry> = listOf(
        Entry("a-mnw5wdz7-14908d", "\uDB80\uDD86", true),
        Entry("a-mnwkmd4g-cb4d00", "\uDB83\uDE85", true),
        Entry("article_1778108127353_fzymbc", "\uDB80\uDD8C", true),
        Entry("a-macarthur-lifelong-bible-reading", "\uDB84\uDF7B", true),
    )

    /** 读经计划器的占位文章：探索格子里不出现（RN gridFeaturedArticles 同样过滤） */
    const val READING_PLANNER_SLUG = "article_1778108127353_fzymbc"
    const val FALLBACK_ICON = "\uDB82\uDDEE"

    fun entry(slug: String): Entry? = entries.firstOrNull { it.slug == slug }
}
