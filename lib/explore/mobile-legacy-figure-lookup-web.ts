import type {
  MobileLegacyFigureProfile,
  MobileLegacyFiguresBundle,
} from "@/lib/explore/legacy-figures-mobile-bundle-types";

export function getMobileLegacyFigureBySlugFromBundle(
  bundle: MobileLegacyFiguresBundle,
  slug: string,
): MobileLegacyFigureProfile | null {
  const needle = slug.trim();
  return (
    bundle.profiles.find((profile) => profile.slug === needle)
    ?? bundle.profiles.find((profile) => profile.linkedArticleSlug === needle)
    ?? null
  );
}

export function getMobileLegacyFigureProfileByIdFromBundle(
  bundle: MobileLegacyFiguresBundle,
  id: string,
): MobileLegacyFigureProfile | null {
  return bundle.profiles.find((profile) => profile.id === id) ?? null;
}
