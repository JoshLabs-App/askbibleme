import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import bundleJson from "@/data/explore-featured-articles/bundle.json";
import {
  EXPLORE_FEATURED_ARTICLE_SLUGS,
  type ExploreFeaturedArticleSlug,
} from "@/lib/explore/explore-featured-article-slugs";
import type { ExploreFeaturedArticleSection } from "@/lib/explore/explore-featured-article-section-types";
import { resolveExploreFeaturedArticleSections } from "@/lib/explore/split-explore-featured-article-sections";

type LocaleBlock = {
  title: string;
  exploreLabel: string;
  body: string;
  sections?: ExploreFeaturedArticleSection[];
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
  sections: ExploreFeaturedArticleSection[];
};

const bundle = bundleJson as LocalizedBundle;

function sourceLocale(locale: AppLocale): "zh-CN" | "en" {
  return locale === "en" ? "en" : "zh-CN";
}

function localizeSections(
  sections: ExploreFeaturedArticleSection[] | undefined,
  locale: AppLocale,
): ExploreFeaturedArticleSection[] {
  if (!sections?.length) return [];
  if (locale !== "zh-TW") return sections;
  return sections.map((section) => ({
    ...section,
    title: toZhTwText(section.title),
    body: toZhTwText(section.body),
  }));
}

function localizeBlock(block: LocaleBlock, locale: AppLocale): LocaleBlock {
  if (locale !== "zh-TW") return block;
  return {
    title: toZhTwText(block.title),
    exploreLabel: toZhTwText(block.exploreLabel),
    body: toZhTwText(block.body),
    sections: localizeSections(block.sections, locale),
  };
}

export function readExploreFeaturedArticleView(
  slug: string,
  locale: AppLocale,
): ExploreFeaturedArticleView | null {
  const entry = bundle.articles.find((item) => item.slug === slug);
  if (!entry) return null;
  const source = sourceLocale(locale);
  const rawBlock = entry[source];
  const sections = resolveExploreFeaturedArticleSections(rawBlock, source);
  const block = localizeBlock({ ...rawBlock, sections }, locale);
  return {
    slug: entry.slug as ExploreFeaturedArticleSlug,
    ...block,
    body: block.body,
    sections: block.sections ?? sections,
  };
}

export function readExploreFeaturedArticleSlugs(): string[] {
  return bundle.articles.map((entry) => entry.slug);
}

export function readExploreFeaturedArticleViews(locale: AppLocale): ExploreFeaturedArticleView[] {
  return EXPLORE_FEATURED_ARTICLE_SLUGS.map((slug) => readExploreFeaturedArticleView(slug, locale)).filter(
    (item): item is ExploreFeaturedArticleView => Boolean(item),
  );
}

export function exploreFeaturedArticleLabelForLocale(slug: string, locale: AppLocale): string | null {
  return readExploreFeaturedArticleView(slug, locale)?.exploreLabel ?? null;
}
