import type { MobileLegacyFiguresBundle } from "@/lib/explore/legacy-figures-mobile-bundle-types";
import type { LegacyFigureTimelineBookRow } from "@/lib/legacy-figures-timeline-types";

export function legacyFigureTimelineBookRowsFromMobileBundle(
  bundle: MobileLegacyFiguresBundle,
): LegacyFigureTimelineBookRow[] {
  return bundle.bookRows.map((row) => ({
    bookNumber: row.bookNumber,
    bookId: row.bookId,
    testament: row.testament,
    eraCompact: row.eraCompact,
    eraAria: row.eraAria,
    figures: row.figures.map((figure) => ({
      id: figure.id,
      slug: figure.slug,
      displayNameZh: figure.displayNameZh,
      englishName: figure.englishName ?? "",
      characterRoleZh: figure.characterRoleZh ?? "",
      linkedArticleSlug: figure.linkedArticleSlug ?? "",
      profileStatus: figure.profileStatus ?? "",
      articleTitle: figure.articleTitle ?? null,
    })),
  }));
}
