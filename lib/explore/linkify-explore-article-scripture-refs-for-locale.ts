import type { AppLocale } from "@/lib/i18n/config";
import { linkifyExploreArticleScriptureRefsEn } from "@/lib/explore/linkify-explore-article-scripture-refs-en";
import { linkifyExploreArticleScriptureRefs } from "@/lib/explore/linkify-explore-article-scripture-refs";

export function linkifyExploreArticleScriptureRefsForLocale(markdown: string, locale: AppLocale): string {
  if (locale === "en") return linkifyExploreArticleScriptureRefsEn(markdown);
  return linkifyExploreArticleScriptureRefs(markdown);
}
