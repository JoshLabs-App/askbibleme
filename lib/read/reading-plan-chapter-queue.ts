import type { ReadingPlanRange } from "@/lib/bible/reading-plans/types";
import { scriptureBooks } from "@/lib/bible/scripture-books";

const maxChapterByBookId = new Map(scriptureBooks.map((b) => [b.bookId, b.chapters]));

export type ReadingPlanChapterRef = { bookId: string; chapter: number };

export function expandReadingPlanRangeToChapters(range: ReadingPlanRange): ReadingPlanChapterRef[] {
  const max = maxChapterByBookId.get(range.bookId) ?? range.endChapter;
  const end = Math.min(range.endChapter, max);
  const start = Math.max(1, range.startChapter);
  const out: ReadingPlanChapterRef[] = [];
  for (let chapter = start; chapter <= end; chapter++) {
    out.push({ bookId: range.bookId, chapter });
  }
  return out;
}

/** Ordered unique chapters for one plan day (for audio walk-through). */
export function buildReadingPlanChapterQueue(readings: readonly ReadingPlanRange[]): ReadingPlanChapterRef[] {
  const out: ReadingPlanChapterRef[] = [];
  const seen = new Set<string>();
  for (const range of readings) {
    for (const ref of expandReadingPlanRangeToChapters(range)) {
      const key = `${ref.bookId}:${ref.chapter}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(ref);
    }
  }
  return out;
}

export function chapterRefKey(ref: ReadingPlanChapterRef): string {
  return `${ref.bookId}:${ref.chapter}`;
}

export function indexInReadingPlanQueue(
  queue: readonly ReadingPlanChapterRef[],
  bookId: string,
  chapter: number,
): number {
  return queue.findIndex((q) => q.bookId === bookId && q.chapter === chapter);
}
