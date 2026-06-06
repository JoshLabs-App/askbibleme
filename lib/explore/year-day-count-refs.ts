import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import type { AppLocale } from "@/lib/i18n/config";

export type YearDayCountScriptureRef = {
  id: string;
  bookId: string;
  chapter: number;
  verseStart: number;
  verseEnd?: number;
};

/** 点「第 N 天」进入：诗篇 90:12（数算日子） */
export const YEAR_DAY_COUNT_LIFE_DAY_READ_TARGET = {
  bookId: "PSA",
  chapter: 90,
  verseStart: 12,
} as const;

/** 页顶导语：诗篇 90:12 正文 */
export const YEAR_DAY_COUNT_LEAD_REF: YearDayCountScriptureRef = {
  id: "psa-90-12",
  bookId: "PSA",
  chapter: 90,
  verseStart: 12,
};

export const YEAR_DAY_COUNT_SCRIPTURES: YearDayCountScriptureRef[] = [
  { id: "gen-3-19", bookId: "GEN", chapter: 3, verseStart: 19 },
  { id: "gen-6-3", bookId: "GEN", chapter: 6, verseStart: 3 },
  { id: "job-7-6", bookId: "JOB", chapter: 7, verseStart: 6, verseEnd: 7 },
  { id: "job-8-9", bookId: "JOB", chapter: 8, verseStart: 9 },
  { id: "job-9-25", bookId: "JOB", chapter: 9, verseStart: 25, verseEnd: 26 },
  { id: "job-14-1", bookId: "JOB", chapter: 14, verseStart: 1, verseEnd: 2 },
  { id: "psa-39-4", bookId: "PSA", chapter: 39, verseStart: 4, verseEnd: 5 },
  { id: "psa-39-11", bookId: "PSA", chapter: 39, verseStart: 11 },
  { id: "psa-78-39", bookId: "PSA", chapter: 78, verseStart: 39 },
  { id: "psa-89-47", bookId: "PSA", chapter: 89, verseStart: 47, verseEnd: 48 },
  { id: "psa-90-3", bookId: "PSA", chapter: 90, verseStart: 3, verseEnd: 6 },
  { id: "psa-90-9", bookId: "PSA", chapter: 90, verseStart: 9, verseEnd: 10 },
  { id: "psa-90-12", bookId: "PSA", chapter: 90, verseStart: 12 },
  { id: "psa-102-11", bookId: "PSA", chapter: 102, verseStart: 11 },
  { id: "psa-103-15", bookId: "PSA", chapter: 103, verseStart: 15, verseEnd: 16 },
  { id: "psa-144-4", bookId: "PSA", chapter: 144, verseStart: 4 },
  { id: "ecc-3-20", bookId: "ECC", chapter: 3, verseStart: 20 },
  { id: "ecc-6-12", bookId: "ECC", chapter: 6, verseStart: 12 },
  { id: "ecc-12-1", bookId: "ECC", chapter: 12, verseStart: 1, verseEnd: 7 },
  { id: "isa-40-6", bookId: "ISA", chapter: 40, verseStart: 6, verseEnd: 8 },
  { id: "isa-51-12", bookId: "ISA", chapter: 51, verseStart: 12 },
  { id: "jas-1-10", bookId: "JAS", chapter: 1, verseStart: 10, verseEnd: 11 },
  { id: "jas-4-14", bookId: "JAS", chapter: 4, verseStart: 14 },
  { id: "1pe-1-24", bookId: "1PE", chapter: 1, verseStart: 24, verseEnd: 25 },
  { id: "heb-9-27", bookId: "HEB", chapter: 9, verseStart: 27 },
];

export function formatYearDayCountRef(ref: YearDayCountScriptureRef, locale: AppLocale): string {
  const baseName = getScriptureBookDisplayName(ref.bookId, locale);
  const range =
    ref.verseEnd != null && ref.verseEnd > ref.verseStart
      ? `${ref.verseStart}-${ref.verseEnd}`
      : String(ref.verseStart);
  return `${baseName} ${ref.chapter}:${range}`;
}
