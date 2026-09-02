import { scriptureBooks } from "@/lib/bible/scripture-books";
import { t } from "../../i18n/site-copy";
import {
  NT_DEEP_REPEAT_CURRICULUM,
  NT_DEEP_REPEAT_OT_BOOK_IDS,
} from "@/lib/bible/reading-plans/nt-deep-repeat-curriculum";
import { ntDeepRepeatOneCycleDays } from "@/lib/bible/reading-plans/nt-deep-repeat-pace";
import {
  currentNtDeepRepeatSegment,
  formatNtDeepRepeatOtLine,
  formatNtDeepRepeatSegmentLabel,
  formatNtDeepRepeatSegmentStageRange,
  normalizeNtDeepRepeatReadingState,
  ntDeepRepeatTrackTitle,
  resolveNtDeepRepeatSegmentDayTarget,
  type NtDeepRepeatReadingState,
} from "./nt-deep-repeat-reading";
import type { ReadingPlanDay, ReadingPlanRange, ReadingPlanRegistryEntry } from "./types";

export const NT_DEEP_REPEAT_OT_CHAPTER_TOTAL = NT_DEEP_REPEAT_OT_BOOK_IDS.reduce((sum, bookId) => {
  const meta = scriptureBooks.find((b) => b.bookId === bookId);
  return sum + (meta?.chapters ?? 0);
}, 0);

export const NT_DEEP_REPEAT_NT_SEGMENT_TOTAL = NT_DEEP_REPEAT_CURRICULUM.length;

export const NT_DEEP_REPEAT_PLAN_ID = "nt-deep-repeat";

/** 探索 · 深度读经（麦克阿瑟原文与说明） */
export const NT_DEEP_REPEAT_EXPLORE_ARTICLE_SLUG = "a-macarthur-lifelong-bible-reading";

export const NT_DEEP_REPEAT_PLAN_DAY_COUNT = 1;

export function isNtDeepRepeatPlanId(planId: string | null | undefined): boolean {
  return String(planId ?? "").trim() === NT_DEEP_REPEAT_PLAN_ID;
}

export function getNtDeepRepeatRegistryEntry(): ReadingPlanRegistryEntry {
  return {
    planId: NT_DEEP_REPEAT_PLAN_ID,
    name: t("pages.read.plansCatalog.nt-deep-repeat.title"),
    abbreviation: "nt30",
    description: t("pages.read.plansCatalog.nt-deep-repeat.blurb"),
    sourceUrl: "selah:nt-deep-repeat",
    bundlePath: "",
    dayCount: NT_DEEP_REPEAT_PLAN_DAY_COUNT,
    maxReadingsPerDay: 2,
    listPriority: -15,
  };
}

/** 今日读经展示顺序：新约深读 → 旧约通读 */
export function buildNtDeepRepeatReadingPlanDay(
  rawState?: Partial<NtDeepRepeatReadingState> | null,
): ReadingPlanDay {
  const state = normalizeNtDeepRepeatReadingState(rawState);
  const segment = currentNtDeepRepeatSegment(state);
  const readings: ReadingPlanRange[] = [];

  if (segment) {
    const sep = t("pages.read.ntDeepRepeatLabelSep");
    const segmentTotal = resolveNtDeepRepeatSegmentDayTarget(state);
    const stageLabel = formatNtDeepRepeatSegmentLabel(segment, state.dayInSegment, segmentTotal);
    const cycleDays = ntDeepRepeatOneCycleDays(
      state.pace,
      state.startedAt ? new Date(`${state.startedAt}T12:00:00`) : new Date(),
    );
    segment.ranges.forEach((range, index) => {
      const rangeLine = formatNtDeepRepeatSegmentStageRange({ ranges: [range] });
      readings.push({
        bookId: range.bookId,
        startChapter: range.startChapter,
        endChapter: range.endChapter,
        label: `${ntDeepRepeatTrackTitle("nt")}${sep}${index === 0 ? stageLabel : rangeLine}`,
        planChapterTotal: cycleDays,
      });
    });
  }

  const otSep = t("pages.read.ntDeepRepeatLabelSep");
  readings.push({
    bookId: state.ot.bookId,
    startChapter: state.ot.chapter,
    endChapter: state.ot.chapter,
    label: `${ntDeepRepeatTrackTitle("ot")}${otSep}${formatNtDeepRepeatOtLine(state.ot.bookId, state.ot.chapter)}`,
    planChapterTotal: NT_DEEP_REPEAT_OT_CHAPTER_TOTAL,
  });

  return { dayIndex: 0, readings };
}
