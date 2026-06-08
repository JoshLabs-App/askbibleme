import type { AppLocale } from "../i18n/config";
import {
  getExploreFeaturedArticleView,
  listExploreFeaturedArticleViews,
  type ExploreFeaturedArticle,
} from "./exploreFeaturedArticlesBundleCore";
import { getActiveExploreFeaturedArticlesBundle } from "./fetchExploreFeaturedArticles";

export type { ExploreFeaturedArticle } from "./exploreFeaturedArticlesBundleCore";

export function getExploreFeaturedArticleBySlug(
  slug: string,
  locale: AppLocale = "zh-CN",
): ExploreFeaturedArticle | null {
  return getExploreFeaturedArticleView(getActiveExploreFeaturedArticlesBundle(), slug, locale);
}

export function listExploreFeaturedArticles(locale: AppLocale = "zh-CN"): ExploreFeaturedArticle[] {
  return listExploreFeaturedArticleViews(getActiveExploreFeaturedArticlesBundle(), locale);
}

export function exploreArticleHref(slug: string): `/explore/articles/${string}` {
  return `/explore/articles/${slug}`;
}

export function exploreArticleRoute(slug: string) {
  return {
    pathname: "/explore/articles/[slug]" as const,
    params: { slug },
  };
}

/** @deprecated Use listExploreFeaturedArticles(locale) */
export const EXPLORE_FEATURED_ARTICLES = listExploreFeaturedArticles("zh-CN");
