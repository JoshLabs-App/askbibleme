import type { AppLocale } from "@/lib/i18n/config";
import type { ExploreFeaturedArticleSection } from "@/lib/explore/explore-featured-article-section-types";

function introSectionTitle(locale: Extract<AppLocale, "zh-CN" | "en">): string {
  return locale === "en" ? "Overview" : "导读";
}

function sectionId(index: number, title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${index}-${slug || "section"}`;
}

/** Split prepared markdown into h2-level accordion sections (build time). */
export function splitExploreFeaturedArticleIntoSections(
  preparedBody: string,
  locale: Extract<AppLocale, "zh-CN" | "en">,
): ExploreFeaturedArticleSection[] {
  const text = preparedBody.trim();
  if (!text) return [];

  const parts = text.split(/\n(?=## )/);
  const sections: ExploreFeaturedArticleSection[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const heading = trimmed.match(/^##\s+(.+?)(?:\n|$)/);
    if (heading) {
      const title = heading[1].trim();
      const body = trimmed.slice(heading[0].length).trim();
      sections.push({
        id: sectionId(sections.length, title),
        title,
        body,
      });
      continue;
    }

    sections.push({
      id: sectionId(sections.length, "intro"),
      title: introSectionTitle(locale),
      body: trimmed,
    });
  }

  return sections.length >= 2 ? sections : [];
}

/** Prefer h2 splits from body so accordion stays aligned with markdown (ignores stale pre-baked sections). */
export function resolveExploreFeaturedArticleSections(
  block: { body: string; sections?: ExploreFeaturedArticleSection[] },
  locale: Extract<AppLocale, "zh-CN" | "en">,
): ExploreFeaturedArticleSection[] {
  if (block.body.includes("\n## ")) {
    const fromBody = splitExploreFeaturedArticleIntoSections(block.body, locale);
    if (fromBody.length >= 2) return fromBody;
  }
  return block.sections ?? [];
}
