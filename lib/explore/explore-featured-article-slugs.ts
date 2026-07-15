/** 探索页文章栏展示顺序（slug 真源：data/legacy-community-articles.json） */
export const EXPLORE_FEATURED_ARTICLE_SLUGS = [
  "a-mnw5wdz7-14908d",
  "a-mnwkmd4g-cb4d00",
  "article_1778108127353_fzymbc",
  "a-macarthur-lifelong-bible-reading",
] as const;

export type ExploreFeaturedArticleSlug = (typeof EXPLORE_FEATURED_ARTICLE_SLUGS)[number];

/** 探索文章以完整正文展示（非折叠段落）。 */
export const EXPLORE_FEATURED_ARTICLE_PROSE_LAYOUT_SLUGS = [
  "a-mnw5wdz7-14908d",
  "a-mnwkmd4g-cb4d00",
  "article_1778108127353_fzymbc",
  "a-macarthur-lifelong-bible-reading",
] as const satisfies readonly ExploreFeaturedArticleSlug[];

export function exploreFeaturedArticleUsesProseLayout(slug: string): boolean {
  return (EXPLORE_FEATURED_ARTICLE_PROSE_LAYOUT_SLUGS as readonly string[]).includes(slug);
}

export function exploreArticleHref(slug: string): `/explore/articles/${string}` {
  return `/explore/articles/${slug}`;
}

export function isExploreFeaturedArticleSlug(slug: string): slug is ExploreFeaturedArticleSlug {
  return (EXPLORE_FEATURED_ARTICLE_SLUGS as readonly string[]).includes(slug);
}
