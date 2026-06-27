import { getLocale } from "../../i18n/locale-store";
import { t } from "../../i18n/site-copy";
import {
  formatTripleLoopReadingLineVerbose,
  normalizeTripleLoopReadingState,
  tripleLoopTrackTitle,
  type TripleLoopReadingState,
  type TripleLoopTrack,
} from "./triple-loop-reading";
import { TRIPLE_LOOP_TRACK_CHAPTER_TOTALS } from "./triple-loop-track-progress";
import type { ReadingPlanDay, ReadingPlanRange, ReadingPlanRegistryEntry } from "./types";

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
    name: t("pages.read.plansCatalog.triple-loop.title"),
    abbreviation: "3-track",
    description: t("pages.read.plansCatalog.triple-loop.blurb"),
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
    const sep = getLocale() === "en" ? ": " : "：";
    const label = `${tripleLoopTrackTitle(track)}${sep}${formatTripleLoopReadingLineVerbose(ptr.bookId, ptr.chapter)}`;
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
