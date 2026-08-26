import type { ReadingPlanDay, ReadingPlanRange } from "@/lib/bible/reading-plans/types";
import {
  currentNtDeepRepeatSegment,
  normalizeNtDeepRepeatReadingState,
  type NtDeepRepeatReadingState,
} from "@/lib/bible/reading-plans/nt-deep-repeat-reading";

/** 今日读经展示顺序：新约深读 → 旧约通读 */
export function buildNtDeepRepeatReadingPlanDay(
  rawState?: Partial<NtDeepRepeatReadingState> | null,
): ReadingPlanDay {
  const state = normalizeNtDeepRepeatReadingState(rawState);
  const segment = currentNtDeepRepeatSegment(state);
  const readings: ReadingPlanRange[] = [];

  if (segment) {
    for (const range of segment.ranges) {
      readings.push({
        bookId: range.bookId,
        startChapter: range.startChapter,
        endChapter: range.endChapter,
        label: "",
        planChapterTotal: 1,
      });
    }
  }

  readings.push({
    bookId: state.ot.bookId,
    startChapter: state.ot.chapter,
    endChapter: state.ot.chapter,
    label: "",
    planChapterTotal: 1,
  });

  return { dayIndex: 0, readings };
}
