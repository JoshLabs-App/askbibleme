export type ExploreFeaturedArticleLocaleBlock = {
  title: string;
  exploreLabel: string;
  body: string;
  sections?: import("@/lib/explore/explore-featured-article-section-types").ExploreFeaturedArticleSection[];
};

export type ExploreFeaturedArticleBundleEntry = {
  slug: string;
  "zh-CN": ExploreFeaturedArticleLocaleBlock;
  en: ExploreFeaturedArticleLocaleBlock;
};

export type ExploreFeaturedArticlesBundle = {
  schemaVersion: number;
  contentVersion?: string;
  articles: ExploreFeaturedArticleBundleEntry[];
};

export function isExploreFeaturedArticlesBundle(raw: unknown): raw is ExploreFeaturedArticlesBundle {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Partial<ExploreFeaturedArticlesBundle>;
  if (o.schemaVersion !== 1 || !Array.isArray(o.articles)) return false;
  return o.articles.every((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const e = entry as Partial<ExploreFeaturedArticleBundleEntry>;
    if (typeof e.slug !== "string" || !e.slug.trim()) return false;
    const zh = e["zh-CN"];
    const en = e.en;
    const blockOk = (b: unknown) =>
      Boolean(
        b &&
          typeof b === "object" &&
          typeof (b as ExploreFeaturedArticleLocaleBlock).title === "string" &&
          typeof (b as ExploreFeaturedArticleLocaleBlock).exploreLabel === "string" &&
          typeof (b as ExploreFeaturedArticleLocaleBlock).body === "string",
      );
    return blockOk(zh) && blockOk(en);
  });
}
