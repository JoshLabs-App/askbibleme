import { buildTripleLoopReadingPlanDay, isTripleLoopPlanId, TRIPLE_LOOP_PLAN_DAY_COUNT } from "@/lib/bible/reading-plans/triple-loop-plan";
import type { ReadingPlanDay } from "@/lib/bible/reading-plans/types";
import { fetchReadingPlanDayClient, type ReadingPlanDayPayload } from "@/lib/read/fetch-reading-plan-day-client";
import {
  resolveReadingPlanDayIndex,
  type ReadingPlanPrefs,
} from "@/lib/read/reading-plan-prefs";
import { readTripleLoopProgress } from "@/lib/read/triple-loop-progress";

export type TodayReadingPlanPayload = ReadingPlanDayPayload;

export function buildTripleLoopDayPayload(progress = readTripleLoopProgress()): TodayReadingPlanPayload {
  return {
    planId: "triple-loop",
    name: "新旧约循环读经计划",
    dayCount: TRIPLE_LOOP_PLAN_DAY_COUNT,
    dayIndex: 0,
    day: buildTripleLoopReadingPlanDay(progress),
  };
}

export async function loadTodayReadingPlanPayload(
  prefs: ReadingPlanPrefs,
  opts?: { dayCount?: number },
): Promise<TodayReadingPlanPayload | null> {
  if (isTripleLoopPlanId(prefs.planId)) {
    return buildTripleLoopDayPayload();
  }
  const dayCount = opts?.dayCount ?? prefs.dayCount ?? 365;
  const dayIndex = resolveReadingPlanDayIndex(prefs, dayCount);
  return fetchReadingPlanDayClient(prefs.planId, dayIndex);
}

export function getTodayReadingsFromPayload(payload: TodayReadingPlanPayload | null): ReadingPlanDay["readings"] {
  return payload?.day?.readings ?? [];
}
