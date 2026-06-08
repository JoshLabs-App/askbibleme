/** 探索页文章栏展示顺序（slug 真源：data/legacy-community-articles.json） */
export const EXPLORE_FEATURED_ARTICLE_SLUGS = [
  "a-mnw5wdz7-14908d",
  "a-mnwkmd4g-cb4d00",
  "article_1778108127353_fzymbc",
] as const;

export type ExploreFeaturedArticleSlug = (typeof EXPLORE_FEATURED_ARTICLE_SLUGS)[number];

export function exploreArticleHref(slug: string): `/explore/articles/${string}` {
  return `/explore/articles/${slug}`;
}

export function isExploreFeaturedArticleSlug(slug: string): slug is ExploreFeaturedArticleSlug {
  return (EXPLORE_FEATURED_ARTICLE_SLUGS as readonly string[]).includes(slug);
}
