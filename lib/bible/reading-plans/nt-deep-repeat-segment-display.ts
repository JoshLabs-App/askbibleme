import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import type { NtDeepRepeatChapterRange, NtDeepRepeatSegment } from "@/lib/bible/reading-plans/nt-deep-repeat-curriculum";

export function formatNtDeepRepeatChapterRangeLine(range: NtDeepRepeatChapterRange): string {
  const name = getScriptureBookDisplayName(range.bookId) || range.bookId;
  if (range.startChapter === range.endChapter) {
    return `${name} ${range.startChapter}`;
  }
  return `${name} ${range.startChapter}–${range.endChapter}`;
}

export function formatNtDeepRepeatSegmentStageRange(segment: NtDeepRepeatSegment): string {
  return segment.ranges.map(formatNtDeepRepeatChapterRangeLine).join(" · ");
}
