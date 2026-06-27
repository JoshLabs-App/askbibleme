/** 探索页「正式研读 · 麦克阿瑟的研读法」 */
export const DEEP_READING_EXPLORE_ARTICLE_SLUG = "a-macarthur-lifelong-bible-reading";

/** 探索网格中「轻松读经」对应的 featured article slug（内容仍保留为参考文）。 */
export const READING_PLANNER_EXPLORE_ARTICLE_SLUG = "article_1778108127353_fzymbc";

export function isReadingPlannerExploreSlug(slug: string): boolean {
  return slug.trim() === READING_PLANNER_EXPLORE_ARTICLE_SLUG;
}

export function readingPlannerHref(): "/explore/reading-planner" {
  return "/explore/reading-planner";
}

export function readingPlannerRoute() {
  return {
    pathname: "/explore/reading-planner" as const,
  };
}
