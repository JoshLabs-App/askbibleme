import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import bundleJson from "@/data/explore-featured-articles/bundle.json";
import {
  EXPLORE_FEATURED_ARTICLE_SLUGS,
  isExploreFeaturedArticleSlug,
  type ExploreFeaturedArticleSlug,
} from "@/lib/explore/explore-featured-article-slugs";

type LocaleBlock = {
  title: string;
  exploreLabel: string;
  body: string;
};

type LocalizedBundle = {
  schemaVersion: number;
  articles: Array<{ slug: ExploreFeaturedArticleSlug } & Record<"zh-CN" | "en", LocaleBlock>>;
};

export type ExploreFeaturedArticleView = {
  slug: ExploreFeaturedArticleSlug;
  title: string;
  exploreLabel: string;
  body: string;
};

const bundle = bundleJson as LocalizedBundle;

function sourceLocale(locale: AppLocale): "zh-CN" | "en" {
  return locale === "en" ? "en" : "zh-CN";
}

function localizeBlock(block: LocaleBlock, locale: AppLocale): LocaleBlock {
  if (locale !== "zh-TW") return block;
  return {
    title: toZhTwText(block.title),
    exploreLabel: toZhTwText(block.exploreLabel),
    body: toZhTwText(block.body),
  };
}

export function readExploreFeaturedArticleView(
  slug: string,
  locale: AppLocale,
): ExploreFeaturedArticleView | null {
  if (!isExploreFeaturedArticleSlug(slug)) return null;
  const entry = bundle.articles.find((item) => item.slug === slug);
  if (!entry) return null;
  const block = localizeBlock(entry[sourceLocale(locale)], locale);
  return { slug, ...block };
}

export function readExploreFeaturedArticleViews(locale: AppLocale): ExploreFeaturedArticleView[] {
  return EXPLORE_FEATURED_ARTICLE_SLUGS.map((slug) => {
    const entry = bundle.articles.find((item) => item.slug === slug);
    if (!entry) return null;
    const block = localizeBlock(entry[sourceLocale(locale)], locale);
    return { slug, ...block };
  }).filter((item): item is ExploreFeaturedArticleView => Boolean(item));
}

export function exploreFeaturedArticleLabelForLocale(slug: string, locale: AppLocale): string | null {
  return readExploreFeaturedArticleView(slug, locale)?.exploreLabel ?? null;
}
