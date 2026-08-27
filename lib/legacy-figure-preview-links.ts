import type { LegacyFigureProfile } from "@/lib/legacy-figure-preview";

export function legacyFigureEntryHref(
  profile: Pick<LegacyFigureProfile, "profileStatus" | "linkedArticleSlug" | "slug">,
): string {
  if (profile.profileStatus === "article_only") {
    return `/explore/figures/article/${profile.linkedArticleSlug}`;
  }
  return `/explore/figures/${profile.slug}`;
}

export function isLegacyFigurePrimary(
  profile: Pick<LegacyFigureProfile, "characterRoleZh">,
): boolean {
  return profile.characterRoleZh !== "相关人物";
}
