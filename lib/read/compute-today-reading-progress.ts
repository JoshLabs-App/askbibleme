import type { ReadingPlanRange } from "@/lib/bible/reading-plans/types";
import { trackForBookId, type TripleLoopReadingState } from "@/lib/bible/reading-plans/triple-loop-reading";
import { computeTripleLoopTrackBarProgress } from "@/lib/bible/reading-plans/triple-loop-track-progress";
import { readingPlanRangeUnitCount } from "@/lib/read/today-reading-chapter-fraction";

export function computeTodayReadingItemProgress(opts: {
  reading: ReadingPlanRange;
  isDone: boolean;
  chapterFraction: number;
  isTripleLoop: boolean;
  currentTriple: TripleLoopReadingState | null;
}): number {
  const { reading, isDone, chapterFraction, isTripleLoop, currentTriple } = opts;

  const track = trackForBookId(reading.bookId);
  if (isTripleLoop && track && currentTriple) {
    return computeTripleLoopTrackBarProgress(currentTriple, track, chapterFraction);
  }

  if (isDone) return 1;
  const units = readingPlanRangeUnitCount(reading);
  if (units <= 1) {
    return Math.min(1, Math.max(0, chapterFraction));
  }
  return Math.min(1, Math.max(0, chapterFraction));
}
