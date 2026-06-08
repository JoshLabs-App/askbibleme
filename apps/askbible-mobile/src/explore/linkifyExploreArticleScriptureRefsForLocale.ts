import type { AppLocale } from "../i18n/config";
import { linkifyExploreArticleScriptureRefsEn } from "./linkifyExploreArticleScriptureRefsEn";
import { linkifyExploreArticleScriptureRefs } from "./linkifyExploreArticleScriptureRefs";

export function linkifyExploreArticleScriptureRefsForLocale(markdown: string, locale: AppLocale): string {
  if (locale === "en") return linkifyExploreArticleScriptureRefsEn(markdown);
  return linkifyExploreArticleScriptureRefs(markdown);
}
