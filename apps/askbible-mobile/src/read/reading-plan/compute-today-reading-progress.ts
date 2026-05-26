import type { ReadingPlanRange } from "./types";
import { trackForBookId, type TripleLoopReadingState } from "./triple-loop-reading";
import { computeTripleLoopTrackBarProgress } from "./triple-loop-track-progress";
import { readingPlanRangeUnitCount } from "./today-reading-chapter-fraction";

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
