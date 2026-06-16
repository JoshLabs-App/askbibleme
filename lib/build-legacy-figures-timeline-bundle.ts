import { createHash } from "crypto";
import {
  buildLegacyFiguresForBookTable,
  groupLegacyFiguresByBook,
  type LegacyFigureProfile,
} from "@/lib/legacy-figure-preview";
import type {
  LegacyFigureTimelineBookRow,
  LegacyFigureTimelineEntry,
  LegacyFiguresTimelineBundle,
} from "@/lib/legacy-figures-timeline-types";

export function toLegacyFigureTimelineEntry(profile: LegacyFigureProfile): LegacyFigureTimelineEntry {
  return {
    id: profile.id,
    slug: profile.slug,
    displayNameZh: profile.displayNameZh,
    englishName: profile.englishName,
    characterRoleZh: profile.characterRoleZh,
    linkedArticleSlug: profile.linkedArticleSlug,
    profileStatus: profile.profileStatus,
    articleTitle: profile.article?.title ?? null,
  };
}

export function buildLegacyFiguresTimelineBookRows(cwd = process.cwd()): LegacyFigureTimelineBookRow[] {
  const profiles = buildLegacyFiguresForBookTable(cwd);
  return groupLegacyFiguresByBook(profiles)
    .filter((row) => row.figures.length > 0)
    .map((row) => ({
      bookNumber: row.bookNumber,
      bookId: row.bookId,
      testament: row.testament,
      eraCompact: row.eraCompact,
      eraAria: row.eraAria,
      figures: row.figures.map(toLegacyFigureTimelineEntry),
    }));
}

export function buildLegacyFiguresTimelineBundle(cwd = process.cwd()): LegacyFiguresTimelineBundle {
  const bookRows = buildLegacyFiguresTimelineBookRows(cwd);
  const contentVersion = createHash("sha256")
    .update(JSON.stringify({ schemaVersion: 1, bookRows }))
    .digest("hex")
    .slice(0, 16);

  return { schemaVersion: 1, contentVersion, bookRows };
}
