package me.askbible.native_.data

import android.content.Context
import org.json.JSONObject

/**
 * 探索页精选文章（查经资料）。数据是 RN / 网站同一份 explore-featured-articles 文章包（zh-CN + en 两版），
 * 由 tools/gen-explore-articles.mjs 复制进 assets；这里按语言取一版。与 iOS 的 ExploreArticles 对等。
 */
data class ExploreArticle(
    val slug: String,
    val title: String,
    val exploreLabel: String,
    val body: String,
    val sections: List<Section>,
) {
    data class Section(val id: String, val title: String, val body: String)
    val icon: String get() = ExploreArticleCatalog.entry(slug)?.icon ?: ExploreArticleCatalog.FALLBACK_ICON
    /** 长文版式：整篇正文一次铺开；否则按 sections 折叠（RN exploreFeaturedArticleUsesProseLayout） */
    val prose: Boolean get() = ExploreArticleCatalog.entry(slug)?.prose ?: true
}

object ExploreArticles {
    const val LOCALE = "zh-CN"
    @Volatile private var cache: List<ExploreArticle>? = null

    fun all(context: Context): List<ExploreArticle> {
        cache?.let { return it }
        val text = context.assets.open("explore-articles.json").bufferedReader().use { it.readText() }
        val items = JSONObject(text).optJSONArray("articles")
        val out = ArrayList<ExploreArticle>()
        if (items != null) for (i in 0 until items.length()) {
            val item = items.getJSONObject(i)
            val slug = item.optString("slug").takeIf { it.isNotEmpty() } ?: continue
            val block = item.optJSONObject(LOCALE) ?: item.optJSONObject("zh-CN") ?: continue
            val sections = ArrayList<ExploreArticle.Section>()
            block.optJSONArray("sections")?.let { arr ->
                for (j in 0 until arr.length()) {
                    val s = arr.getJSONObject(j)
                    sections.add(ExploreArticle.Section(s.optString("id"), s.optString("title"), s.optString("body")))
                }
            }
            out.add(ExploreArticle(
                slug = slug,
                title = block.optString("title", slug),
                exploreLabel = block.optString("exploreLabel").takeIf { it.isNotEmpty() } ?: block.optString("title", slug),
                body = block.optString("body"),
                sections = sections,
            ))
        }
        return out.also { cache = it }
    }

    /** 探索格子里的文章：读经计划器的占位文章不出现（RN gridFeaturedArticles） */
    fun grid(context: Context): List<ExploreArticle> = all(context).filter { it.slug != ExploreArticleCatalog.READING_PLANNER_SLUG }

    fun article(context: Context, slug: String): ExploreArticle? = all(context).firstOrNull { it.slug == slug }
}
