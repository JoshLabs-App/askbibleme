import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import bundleJson from "@/data/explore-featured-articles/bundle.json";
import type { ExploreFeaturedArticleSlug } from "@/lib/explore/explore-featured-article-slugs";
import { stripExploreArticleBodyLeadHeading } from "@/lib/explore/strip-explore-article-body-lead-heading";

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
  const entry = bundle.articles.find((item) => item.slug === slug);
  if (!entry) return null;
  const block = localizeBlock(entry[sourceLocale(locale)], locale);
  return {
    slug: entry.slug as ExploreFeaturedArticleSlug,
    ...block,
    body: stripExploreArticleBodyLeadHeading(block.body),
  };
}

export function readExploreFeaturedArticleSlugs(): string[] {
  return bundle.articles.map((entry) => entry.slug);
}

export function readExploreFeaturedArticleViews(locale: AppLocale): ExploreFeaturedArticleView[] {
  return bundle.articles
    .map((entry) => readExploreFeaturedArticleView(entry.slug, locale))
    .filter((item): item is ExploreFeaturedArticleView => Boolean(item));
}

export function exploreFeaturedArticleLabelForLocale(slug: string, locale: AppLocale): string | null {
  return readExploreFeaturedArticleView(slug, locale)?.exploreLabel ?? null;
}
