import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import type { NtDeepRepeatChapterRange, NtDeepRepeatSegment } from "@/lib/bible/reading-plans/nt-deep-repeat-curriculum";
import type { AppLocale } from "@/lib/i18n/config";

export function formatNtDeepRepeatChapterRangeLine(
  range: NtDeepRepeatChapterRange,
  locale: AppLocale,
): string {
  const name = getScriptureBookDisplayName(range.bookId, locale) || range.bookId;
  if (range.startChapter === range.endChapter) {
    return `${name} ${range.startChapter}`;
  }
  return `${name} ${range.startChapter}–${range.endChapter}`;
}

export function formatNtDeepRepeatSegmentStageRange(
  segment: NtDeepRepeatSegment,
  locale: AppLocale,
): string {
  return segment.ranges.map((range) => formatNtDeepRepeatChapterRangeLine(range, locale)).join(" · ");
}
