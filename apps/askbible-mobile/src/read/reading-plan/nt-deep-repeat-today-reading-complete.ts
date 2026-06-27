import { normalizeNtDeepRepeatChaptersReadKeys, ntDeepRepeatChapterReadKey } from "./nt-deep-repeat-chapters-read";
import {
  currentNtDeepRepeatSegment,
  trackForNtDeepRepeatBookId,
  type NtDeepRepeatReadingState,
} from "./nt-deep-repeat-reading";
import type { ReadingPlanRange } from "./types";
import { TODAY_READING_AUTO_DONE_FRACTION } from "./today-reading-chapter-fraction";

export function isNtDeepRepeatTodayReadingItemComplete(opts: {
  reading: ReadingPlanRange;
  isDone: boolean;
  fraction: number;
  progress: NtDeepRepeatReadingState | null | undefined;
  chapterCompletionFraction?: number;
}): boolean {
  const { reading, isDone, fraction, progress, chapterCompletionFraction = 0 } = opts;
  if (isDone) return true;

  const track = trackForNtDeepRepeatBookId(reading.bookId);
  if (track === "ot") {
    if (fraction >= TODAY_READING_AUTO_DONE_FRACTION) return true;
    if (!progress) return false;
    const key = ntDeepRepeatChapterReadKey(reading.bookId, reading.startChapter);
    const keys = normalizeNtDeepRepeatChaptersReadKeys(progress.chaptersReadKeys);
    return keys.ot.includes(key);
  }

  if (track === "nt") {
    if (fraction >= TODAY_READING_AUTO_DONE_FRACTION) return true;
    if (chapterCompletionFraction >= 1) return true;
    if (!progress) return false;
    const segment = currentNtDeepRepeatSegment(progress);
    if (!segment) return false;
    const keys = normalizeNtDeepRepeatChaptersReadKeys(progress.chaptersReadKeys);
    for (const range of segment.ranges) {
      for (let ch = range.startChapter; ch <= range.endChapter; ch += 1) {
        if (!keys.nt.includes(ntDeepRepeatChapterReadKey(range.bookId, ch))) return false;
      }
    }
    return true;
  }

  return fraction >= TODAY_READING_AUTO_DONE_FRACTION;
}
