import type { AppLocale } from "../i18n/config";
import { toZhTwText } from "../i18n/site-copy";
import bundledJson from "./explore-featured-articles-localized.json";

export type ExploreFeaturedArticleLocaleBlock = {
  title: string;
  exploreLabel: string;
  body: string;
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

export type ExploreFeaturedArticle = {
  slug: string;
  title: string;
  exploreLabel: string;
  body: string;
};

export function isExploreFeaturedArticlesBundle(raw: unknown): raw is ExploreFeaturedArticlesBundle {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Partial<ExploreFeaturedArticlesBundle>;
  if (o.schemaVersion !== 1 || !Array.isArray(o.articles)) return false;
  return o.articles.every((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const e = entry as Partial<ExploreFeaturedArticleBundleEntry>;
    if (typeof e.slug !== "string" || !e.slug.trim()) return false;
    const blockOk = (b: unknown) =>
      Boolean(
        b &&
          typeof b === "object" &&
          typeof (b as ExploreFeaturedArticleLocaleBlock).title === "string" &&
          typeof (b as ExploreFeaturedArticleLocaleBlock).exploreLabel === "string" &&
          typeof (b as ExploreFeaturedArticleLocaleBlock).body === "string",
      );
    return blockOk(e["zh-CN"]) && blockOk(e.en);
  });
}

export function getBundledExploreFeaturedArticlesBundle(): ExploreFeaturedArticlesBundle {
  return bundledJson as ExploreFeaturedArticlesBundle;
}

function sourceLocale(locale: AppLocale): "zh-CN" | "en" {
  return locale === "en" ? "en" : "zh-CN";
}

function localizeBlock(block: ExploreFeaturedArticleLocaleBlock, locale: AppLocale): ExploreFeaturedArticleLocaleBlock {
  if (locale !== "zh-TW") return block;
  return {
    title: toZhTwText(block.title),
    exploreLabel: toZhTwText(block.exploreLabel),
    body: toZhTwText(block.body),
  };
}

export function getExploreFeaturedArticleView(
  bundle: ExploreFeaturedArticlesBundle,
  slug: string,
  locale: AppLocale,
): ExploreFeaturedArticle | null {
  const entry = bundle.articles.find((item) => item.slug === slug);
  if (!entry) return null;
  const block = localizeBlock(entry[sourceLocale(locale)], locale);
  return { slug, ...block };
}

export function listExploreFeaturedArticleViews(
  bundle: ExploreFeaturedArticlesBundle,
  locale: AppLocale,
): ExploreFeaturedArticle[] {
  return bundle.articles
    .map((entry) => getExploreFeaturedArticleView(bundle, entry.slug, locale))
    .filter((item): item is ExploreFeaturedArticle => Boolean(item));
}

/** 探索首页图标：只本地化标题，避免对大段正文做 zh-TW 转换 */
export function listExploreFeaturedArticleTileViews(
  bundle: ExploreFeaturedArticlesBundle,
  locale: AppLocale,
): ExploreFeaturedArticle[] {
  return bundle.articles
    .map((entry) => {
      const block = entry[sourceLocale(locale)];
      const exploreLabel =
        locale === "zh-TW" ? toZhTwText(block.exploreLabel) : block.exploreLabel;
      const title = locale === "zh-TW" ? toZhTwText(block.title) : block.title;
      return {
        slug: entry.slug,
        title,
        exploreLabel,
        body: "",
      };
    })
    .filter((item) => item.slug.trim().length > 0);
}
