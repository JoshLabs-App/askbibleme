import type { AppLocale } from "@/lib/i18n/config";
import { exploreFeaturedArticleLabelForLocale } from "@/lib/explore/read-explore-featured-article-localized";

/** 探索页图标下显示的短标题（文章详情仍用 `title` 长标题） */
export function exploreFeaturedArticleLabel(slug: string, locale: AppLocale = "zh-CN"): string | null {
  return exploreFeaturedArticleLabelForLocale(slug, locale);
}
