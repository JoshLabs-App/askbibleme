import type {
  MobileLegacyFigureBookRow,
  MobileLegacyFigureProfile,
  MobileLegacyFigureTimelineEntry,
} from "./mobileLegacyFiguresBundleCore";
import { getActiveMobileLegacyFiguresBundle } from "./fetchMobileLegacyFigures";

export type {
  MobileLegacyFigureArticle,
  MobileLegacyFigureBookRow,
  MobileLegacyFigureEnBlock,
  MobileLegacyFigureProfile,
  MobileLegacyFigureTimelineEntry,
  MobileLegacyFiguresBundle,
} from "./mobileLegacyFiguresBundleCore";

export function isMobileLegacyFigurePrimary(
  profile: Pick<MobileLegacyFigureTimelineEntry, "characterRoleZh">,
): boolean {
  return profile.characterRoleZh !== "相关人物";
}

function bundle() {
  return getActiveMobileLegacyFiguresBundle();
}

export function getMobileLegacyFigureProfileById(id: string): MobileLegacyFigureProfile | null {
  return bundle().profiles.find((profile) => profile.id === id) ?? null;
}

export function getMobileLegacyFigureProfiles(): MobileLegacyFigureProfile[] {
  return bundle().profiles;
}

export function getMobileLegacyFigureBookRows(): MobileLegacyFigureBookRow[] {
  return bundle().bookRows.filter((row) => row.figures.length > 0);
}

export function getMobileLegacyFigureBySlug(slug: string): MobileLegacyFigureProfile | null {
  const needle = slug.trim();
  const profiles = bundle().profiles;
  return (
    profiles.find((profile) => profile.slug === needle)
    ?? profiles.find((profile) => profile.linkedArticleSlug === needle)
    ?? null
  );
}

export function mobileLegacyFigureEntryHref(
  profile: Pick<MobileLegacyFigureTimelineEntry, "profileStatus" | "linkedArticleSlug" | "slug">,
): `/explore/figures/${string}` | `/explore/figures/article/${string}` {
  if (profile.profileStatus === "article_only" && profile.linkedArticleSlug) {
    return `/explore/figures/article/${profile.linkedArticleSlug}`;
  }
  return `/explore/figures/${profile.slug}`;
}
