import type { MobileLegacyFigureProfile } from "@/lib/explore/legacy-figures-mobile-bundle-types";
import type { LegacyFigureProfile } from "@/lib/legacy-figure-preview";

export function mobileLegacyFigureProfileToLegacyProfile(
  profile: MobileLegacyFigureProfile,
): LegacyFigureProfile {
  return {
    id: profile.id,
    slug: profile.slug,
    displayNameZh: profile.displayNameZh,
    englishName: profile.englishName ?? "",
    aliasesZh: [],
    identityType: "",
    importanceTier: "",
    profileStatus: profile.profileStatus ?? "",
    primaryBookId: "",
    bookIds: [],
    characterRoleZh: profile.characterRoleZh ?? "",
    scripturePersonalityZh: profile.scripturePersonalityZh ?? "",
    periodLabelZh: profile.periodLabelZh ?? "",
    lifespanZh: profile.lifespanZh ?? "",
    managementNoteZh: "",
    linkedArticleSlug: profile.linkedArticleSlug ?? "",
    article: profile.article
      ? {
          slug: profile.article.slug,
          title: profile.article.title,
          summary: profile.article.summary,
          body: profile.article.body,
          authorName: profile.article.authorName ?? "AskBible",
          updatedAt: profile.article.updatedAt ?? "",
        }
      : null,
  };
}
