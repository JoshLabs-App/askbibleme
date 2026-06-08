import type { AppLocale } from "../i18n/config";
import { toZhTwText } from "../i18n/site-copy";
import localizedBundle from "./explore-featured-articles-localized.json";

export type ExploreFeaturedArticle = {
  slug: string;
  title: string;
  exploreLabel: string;
  body: string;
};

type LocaleBlock = {
  title: string;
  exploreLabel: string;
  body: string;
};

type LocalizedEntry = {
  slug: string;
  "zh-CN": LocaleBlock;
  en: LocaleBlock;
};

type LocalizedBundle = {
  schemaVersion: number;
  articles: LocalizedEntry[];
};

const bundle = localizedBundle as LocalizedBundle;

const SLUG_ORDER = [
  "a-mnw5wdz7-14908d",
  "a-mnwkmd4g-cb4d00",
  "article_1778108127353_fzymbc",
] as const;

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

export function getExploreFeaturedArticleBySlug(slug: string, locale: AppLocale = "zh-CN"): ExploreFeaturedArticle | null {
  const entry = bundle.articles.find((item) => item.slug === slug);
  if (!entry) return null;
  const block = localizeBlock(entry[sourceLocale(locale)], locale);
  return { slug, ...block };
}

export function listExploreFeaturedArticles(locale: AppLocale = "zh-CN"): ExploreFeaturedArticle[] {
  return SLUG_ORDER.map((slug) => getExploreFeaturedArticleBySlug(slug, locale)).filter(
    (item): item is ExploreFeaturedArticle => Boolean(item),
  );
}

export function exploreArticleHref(slug: string): `/explore/articles/${string}` {
  return `/explore/articles/${slug}`;
}

/** @deprecated Use listExploreFeaturedArticles(locale) */
export const EXPLORE_FEATURED_ARTICLES = listExploreFeaturedArticles("zh-CN");
