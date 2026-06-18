import { normalizeTripleLoopChaptersReadKeys } from "@/lib/bible/reading-plans/triple-loop-chapters-read";
import {
  trackForBookId,
  type TripleLoopReadingState,
} from "@/lib/bible/reading-plans/triple-loop-reading";
import type { ReadingPlanRange } from "@/lib/bible/reading-plans/types";
import { TODAY_READING_AUTO_DONE_FRACTION } from "@/lib/read/today-reading-chapter-fraction";

export function tripleLoopChapterReadKey(bookId: string, chapter: number): string {
  return `${bookId.trim().toUpperCase()}:${Math.floor(chapter)}`;
}

/** Whether today's triple-loop row is complete (checkbox, scroll/audio fraction, or logged chapter read). */
export function isTripleLoopTodayReadingItemComplete(opts: {
  reading: ReadingPlanRange;
  isDone: boolean;
  fraction: number;
  progress: TripleLoopReadingState | null | undefined;
}): boolean {
  const { reading, isDone, fraction, progress } = opts;
  if (isDone || fraction >= TODAY_READING_AUTO_DONE_FRACTION) return true;
  if (!progress) return false;
  const track = trackForBookId(reading.bookId);
  if (!track) return false;
  const key = tripleLoopChapterReadKey(reading.bookId, reading.startChapter);
  const keys = normalizeTripleLoopChaptersReadKeys(progress.chaptersReadKeys);
  return keys[track].includes(key);
}
