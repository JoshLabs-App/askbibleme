import {
  formatTripleLoopReadingLineVerbose,
  normalizeTripleLoopReadingState,
  tripleLoopTrackTitle,
  type TripleLoopReadingState,
  type TripleLoopTrack,
} from "@/lib/bible/reading-plans/triple-loop-reading";
import { TRIPLE_LOOP_TRACK_CHAPTER_TOTALS } from "@/lib/bible/reading-plans/triple-loop-track-progress";
import type { ReadingPlanDay, ReadingPlanRange, ReadingPlanRegistryEntry } from "@/lib/bible/reading-plans/types";

export const TRIPLE_LOOP_PLAN_ID = "triple-loop";

/** 探索 · 读经计划思考文章（与本计划配套） */
export const TRIPLE_LOOP_EXPLORE_ARTICLE_SLUG = "article_1778108127353_fzymbc";

export const TRIPLE_LOOP_PLAN_DAY_COUNT = 1;

export function isTripleLoopPlanId(planId: string): boolean {
  return planId.trim() === TRIPLE_LOOP_PLAN_ID;
}

export function getTripleLoopRegistryEntry(): ReadingPlanRegistryEntry {
  return {
    planId: TRIPLE_LOOP_PLAN_ID,
    name: "新旧约循环读经计划",
    abbreviation: "3-track",
    description: "旧约、新约、智慧书三条独立循环；不按日历补读。",
    sourceUrl: "selah:triple-loop",
    bundlePath: "",
    dayCount: TRIPLE_LOOP_PLAN_DAY_COUNT,
    maxReadingsPerDay: 3,
    listPriority: -20,
  };
}

/** 圣经首页今日读经展示顺序：新约 → 智慧诗 → 旧约 */
const TRACKS: TripleLoopTrack[] = ["nt", "wisdom", "ot"];

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
      planChapterTotal: TRIPLE_LOOP_TRACK_CHAPTER_TOTALS[track],
    };
  });
  return { dayIndex: 0, readings };
}
