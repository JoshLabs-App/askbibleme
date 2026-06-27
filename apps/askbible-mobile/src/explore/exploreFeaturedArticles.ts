import type { AppLocale } from "../i18n/config";
import {
  getBundledExploreFeaturedArticlesBundle,
  listExploreFeaturedArticleViews,
  resolveExploreFeaturedArticleView,
  type ExploreFeaturedArticle,
} from "./exploreFeaturedArticlesBundleCore";
import { getActiveExploreFeaturedArticlesBundle } from "./fetchExploreFeaturedArticles";

export type { ExploreFeaturedArticle } from "./exploreFeaturedArticlesBundleCore";

function activeExploreFeaturedArticlesBundle() {
  try {
    return getActiveExploreFeaturedArticlesBundle();
  } catch {
    return getBundledExploreFeaturedArticlesBundle();
  }
}

export function getExploreFeaturedArticleBySlug(
  slug: string,
  locale: AppLocale = "zh-CN",
): ExploreFeaturedArticle | null {
  return resolveExploreFeaturedArticleView(activeExploreFeaturedArticlesBundle(), slug, locale);
}

export function listExploreFeaturedArticles(locale: AppLocale = "zh-CN"): ExploreFeaturedArticle[] {
  return listExploreFeaturedArticleViews(activeExploreFeaturedArticlesBundle(), locale);
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
