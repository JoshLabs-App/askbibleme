import type { AppLocale } from "@/lib/i18n/config";
import type { ExploreFeaturedArticleSection } from "@/lib/explore/explore-featured-article-section-types";
import { linkifyExploreArticleScriptureRefsForLocale } from "@/lib/explore/linkify-explore-article-scripture-refs-for-locale";
import { splitExploreFeaturedArticleIntoSections } from "@/lib/explore/split-explore-featured-article-sections";
import { stripExploreArticleBodyLeadHeading } from "@/lib/explore/strip-explore-article-body-lead-heading";

export type PreparedExploreFeaturedArticleLocaleBlock = {
  body: string;
  sections: ExploreFeaturedArticleSection[];
};

/** Build-time / bundle-time: strip redundant lead + linkify scripture refs once. */
export function prepareExploreFeaturedArticleBodyForDisplay(
  body: string,
  locale: Extract<AppLocale, "zh-CN" | "en">,
): PreparedExploreFeaturedArticleLocaleBlock {
  const stripped = stripExploreArticleBodyLeadHeading(body.trim());
  const prepared = linkifyExploreArticleScriptureRefsForLocale(stripped, locale);
  return {
    body: prepared,
    sections: splitExploreFeaturedArticleIntoSections(prepared, locale),
  };
}
