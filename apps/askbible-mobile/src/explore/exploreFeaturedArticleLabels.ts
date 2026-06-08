import type { AppLocale } from "../i18n/config";
import { getExploreFeaturedArticleBySlug } from "./exploreFeaturedArticles";

/** 探索页图标短标题（与 Web `explore-featured-article-labels.ts` 对齐） */
export function exploreFeaturedArticleLabel(slug: string, locale: AppLocale, fallback: string): string {
  return getExploreFeaturedArticleBySlug(slug, locale)?.exploreLabel ?? fallback;
}
