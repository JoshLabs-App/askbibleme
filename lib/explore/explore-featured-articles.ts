import type { AppLocale } from "@/lib/i18n/config";
import {
  EXPLORE_FEATURED_ARTICLE_SLUGS,
  isExploreFeaturedArticleSlug,
} from "@/lib/explore/explore-featured-article-slugs";
import {
  exploreFeaturedArticleLabelForLocale,
  readExploreFeaturedArticleView,
  readExploreFeaturedArticleViews,
  type ExploreFeaturedArticleView,
} from "@/lib/explore/read-explore-featured-article-localized";

export {
  EXPLORE_FEATURED_ARTICLE_SLUGS,
  exploreArticleHref,
  isExploreFeaturedArticleSlug,
  type ExploreFeaturedArticleSlug,
} from "@/lib/explore/explore-featured-article-slugs";

export {
  EXPLORE_FEATURED_ARTICLE_ICON_BY_SLUG,
} from "@/lib/explore/explore-featured-article-icons";

export {
  exploreFeaturedArticleLabelForLocale,
  readExploreFeaturedArticleView,
  readExploreFeaturedArticleViews,
  type ExploreFeaturedArticleView,
};

export function readExploreFeaturedArticles(locale: AppLocale = "zh-CN"): ExploreFeaturedArticleView[] {
  return readExploreFeaturedArticleViews(locale);
}

export function readExploreFeaturedArticleBySlug(
  slug: string,
  locale: AppLocale = "zh-CN",
): ExploreFeaturedArticleView | null {
  return readExploreFeaturedArticleView(slug, locale);
}

export function exploreFeaturedArticleLabel(slug: string, locale: AppLocale = "zh-CN"): string | null {
  return exploreFeaturedArticleLabelForLocale(slug, locale);
}
