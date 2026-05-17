import {
  formatTripleLoopReadingLineVerbose,
  normalizeTripleLoopReadingState,
  tripleLoopTrackTitle,
  type TripleLoopReadingState,
  type TripleLoopTrack,
} from "@/lib/bible/reading-plans/triple-loop-reading";
import type { ReadingPlanDay, ReadingPlanRange, ReadingPlanRegistryEntry } from "@/lib/bible/reading-plans/types";

export const TRIPLE_LOOP_PLAN_ID = "triple-loop";

export const TRIPLE_LOOP_PLAN_DAY_COUNT = 1;

export function isTripleLoopPlanId(planId: string): boolean {
  return planId.trim() === TRIPLE_LOOP_PLAN_ID;
}

export function getTripleLoopRegistryEntry(): ReadingPlanRegistryEntry {
  return {
    planId: TRIPLE_LOOP_PLAN_ID,
    name: "三段式读经",
    abbreviation: "3-track",
    description: "旧约、新约、智慧书三条独立循环；不按日历补读。",
    sourceUrl: "selah:triple-loop",
    bundlePath: "",
    dayCount: TRIPLE_LOOP_PLAN_DAY_COUNT,
    maxReadingsPerDay: 3,
    listPriority: -20,
  };
}

const TRACKS: TripleLoopTrack[] = ["ot", "nt", "wisdom"];

export function buildTripleLoopReadingPlanDay(
  rawState?: Partial<TripleLoopReadingState> | null,
): ReadingPlanDay {
  const state = normalizeTripleLoopReadingState(rawState);
  const readings: ReadingPlanRange[] = TRACKS.map((track) => {
    const ptr = state[track];
    const label = `${tripleLoopTrackTitle(track)}：${formatTripleLoopReadingLineVerbose(ptr.bookId, ptr.chapter)}`;
    return {
      bookId: ptr.bookId,
      startChapter: ptr.chapter,
      endChapter: ptr.chapter,
      label,
    };
  });
  return { dayIndex: 0, readings };
}
