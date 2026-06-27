import type { AppLocale } from "../i18n/config";
import { toZhTwText } from "../i18n/site-copy";
import bundledJson from "./explore-featured-articles-localized.json";
import type { ExploreFeaturedArticleSection } from "../../../../lib/explore/explore-featured-article-section-types";
import { EXPLORE_FEATURED_ARTICLE_SLUGS } from "../../../../lib/explore/explore-featured-article-slugs";
import { resolveExploreFeaturedArticleSections } from "../../../../lib/explore/split-explore-featured-article-sections";

export type ExploreFeaturedArticleLocaleBlock = {
  title: string;
  exploreLabel: string;
  body: string;
  sections?: ExploreFeaturedArticleSection[];
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
  sections: ExploreFeaturedArticleSection[];
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

function resolveArticleSections(
  block: ExploreFeaturedArticleLocaleBlock,
  locale: AppLocale,
): ExploreFeaturedArticleSection[] {
  return resolveExploreFeaturedArticleSections(block, sourceLocale(locale));
}

/** Install-time bundle wins when contentVersion differs (e.g. app update ahead of server). */
export function shouldPreferBundledExploreFeaturedContent(
  bundledVersion: string | undefined,
  otherVersion: string | undefined,
): boolean {
  const bundled = bundledVersion?.trim() ?? "";
  const other = otherVersion?.trim() ?? "";
  if (!bundled) return false;
  if (!other) return true;
  return bundled !== other;
}

function mergeArticleWithBundledFallback(
  active: ExploreFeaturedArticle | null,
  bundled: ExploreFeaturedArticle | null,
): ExploreFeaturedArticle | null {
  if (!active && !bundled) return null;
  if (!active) return bundled;
  if (!bundled) return active;
  if (!active.sections.length && bundled.sections.length) {
    return {
      ...active,
      sections: bundled.sections,
      body: active.body.trim() ? active.body : bundled.body,
    };
  }
  return active;
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

function localizeBlock(block: ExploreFeaturedArticleLocaleBlock, locale: AppLocale): ExploreFeaturedArticleLocaleBlock {
  if (locale !== "zh-TW") return block;
  return {
    title: toZhTwText(block.title),
    exploreLabel: toZhTwText(block.exploreLabel),
    body: toZhTwText(block.body),
    sections: localizeSections(block.sections, locale),
  };
}

export function getExploreFeaturedArticleView(
  bundle: ExploreFeaturedArticlesBundle,
  slug: string,
  locale: AppLocale,
): ExploreFeaturedArticle | null {
  const entry = bundle.articles.find((item) => item.slug === slug);
  if (!entry) return null;
  const source = sourceLocale(locale);
  const rawBlock = entry[source];
  const sections = resolveArticleSections(rawBlock, locale);
  const block = localizeBlock({ ...rawBlock, sections }, locale);
  return {
    slug,
    title: block.title,
    exploreLabel: block.exploreLabel,
    body: block.body,
    sections: block.sections ?? sections,
  };
}

/** 远端/缓存 bundle 缺条目时回退安装包内 bundle（避免「深度读经」等离线文章打不开）。 */
export function resolveExploreFeaturedArticleView(
  bundle: ExploreFeaturedArticlesBundle,
  slug: string,
  locale: AppLocale,
): ExploreFeaturedArticle | null {
  const bundledBundle = getBundledExploreFeaturedArticlesBundle();
  const active = getExploreFeaturedArticleView(bundle, slug, locale);
  const bundled = getExploreFeaturedArticleView(bundledBundle, slug, locale);
  if (
    bundled &&
    shouldPreferBundledExploreFeaturedContent(bundledBundle.contentVersion, bundle.contentVersion)
  ) {
    return bundled;
  }
  return mergeArticleWithBundledFallback(active, bundled);
}

function mergeExploreFeaturedArticleEntry(
  active: ExploreFeaturedArticleLocaleBlock,
  fallback: ExploreFeaturedArticleLocaleBlock,
): ExploreFeaturedArticleLocaleBlock {
  if (active.sections?.length) return active;
  if (!fallback.sections?.length) return active;
  return {
    ...active,
    sections: fallback.sections,
    body: active.body.trim() ? active.body : fallback.body,
  };
}

function mergeExploreFeaturedArticlesBundles(
  active: ExploreFeaturedArticlesBundle,
  fallback: ExploreFeaturedArticlesBundle,
): ExploreFeaturedArticlesBundle {
  const bySlug = new Map<string, ExploreFeaturedArticleBundleEntry>();
  for (const entry of fallback.articles) bySlug.set(entry.slug, entry);
  for (const entry of active.articles) {
    const prev = bySlug.get(entry.slug);
    bySlug.set(entry.slug, {
      slug: entry.slug,
      "zh-CN": mergeExploreFeaturedArticleEntry(entry["zh-CN"], prev?.["zh-CN"] ?? entry["zh-CN"]),
      en: mergeExploreFeaturedArticleEntry(entry.en, prev?.en ?? entry.en),
    });
  }
  const orderedSlugs = [
    ...fallback.articles.map((entry) => entry.slug),
    ...active.articles
      .map((entry) => entry.slug)
      .filter((slug) => !fallback.articles.some((entry) => entry.slug === slug)),
  ];
  return {
    schemaVersion: 1,
    contentVersion: active.contentVersion ?? fallback.contentVersion,
    articles: orderedSlugs
      .map((slug) => bySlug.get(slug))
      .filter((entry): entry is ExploreFeaturedArticleBundleEntry => Boolean(entry)),
  };
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
  const merged = mergeExploreFeaturedArticlesBundles(bundle, getBundledExploreFeaturedArticlesBundle());
  return EXPLORE_FEATURED_ARTICLE_SLUGS.map((slug) => {
    const entry = merged.articles.find((item) => item.slug === slug);
    if (!entry) return null;
    const block = entry[sourceLocale(locale)];
    const exploreLabel =
      locale === "zh-TW" ? toZhTwText(block.exploreLabel) : block.exploreLabel;
    const title = locale === "zh-TW" ? toZhTwText(block.title) : block.title;
    return {
      slug: entry.slug,
      title,
      exploreLabel,
      body: "",
      sections: [],
    };
  }).filter((item): item is ExploreFeaturedArticle => Boolean(item));
}

