import type { ExploreFeaturedArticlesBundle } from "@/lib/explore/explore-featured-articles-bundle-types";
import type { ExploreFeaturedArticleSection } from "@/lib/explore/explore-featured-article-section-types";
import {
  isExploreFeaturedArticleSlug,
  type ExploreFeaturedArticleSlug,
} from "@/lib/explore/explore-featured-article-slugs";
import type { ExploreFeaturedArticleView } from "@/lib/explore/read-explore-featured-article-localized";
import { resolveExploreFeaturedArticleSections } from "@/lib/explore/split-explore-featured-article-sections";
import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";

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

export function exploreFeaturedArticleViewsFromBundle(
  bundle: ExploreFeaturedArticlesBundle,
  locale: AppLocale,
): ExploreFeaturedArticleView[] {
  const source = sourceLocale(locale);
  const views: ExploreFeaturedArticleView[] = [];
  for (const entry of bundle.articles) {
    if (!isExploreFeaturedArticleSlug(entry.slug)) continue;
    const rawBlock = entry[source];
    const sections = resolveExploreFeaturedArticleSections(rawBlock, source);
    const localizedSections = localizeSections(sections, locale);
    const title = locale === "zh-TW" ? toZhTwText(rawBlock.title) : rawBlock.title;
    const exploreLabel =
      locale === "zh-TW" ? toZhTwText(rawBlock.exploreLabel) : rawBlock.exploreLabel;
    const body = locale === "zh-TW" ? toZhTwText(rawBlock.body) : rawBlock.body;
    views.push({
      slug: entry.slug as ExploreFeaturedArticleSlug,
      title,
      exploreLabel,
      body,
      sections: localizedSections,
    });
  }
  return views;
}
