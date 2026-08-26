import { buildTripleLoopReadingPlanDay, isTripleLoopPlanId, TRIPLE_LOOP_PLAN_DAY_COUNT } from "@/lib/bible/reading-plans/triple-loop-plan";
import { tripleLoopStateForPlanDay } from "@/lib/bible/reading-plans/triple-loop-reading";
import type { ReadingPlanDay } from "@/lib/bible/reading-plans/types";
import { fetchReadingPlanDayClient, type ReadingPlanDayPayload } from "@/lib/read/fetch-reading-plan-day-client";
import { readAheadDays, resolveEffectiveReadingPlanDayIndex } from "@/lib/read/reading-plan-ahead";
import { getReadingPlanDaySinceEpoch } from "@/lib/read/reading-plan-epoch";
import { type ReadingPlanPrefs } from "@/lib/read/reading-plan-prefs";

export type TodayReadingPlanPayload = ReadingPlanDayPayload;

export function buildTripleLoopDayPayload(prefs?: ReadingPlanPrefs): TodayReadingPlanPayload {
  const ahead = prefs ? readAheadDays(prefs) : 0;
  const planDay = Math.max(1, getReadingPlanDaySinceEpoch() + ahead);
  return {
    planId: "triple-loop",
    name: "轻松循环读经计划",
    dayCount: TRIPLE_LOOP_PLAN_DAY_COUNT,
    dayIndex: Math.max(0, planDay - 1),
    day: buildTripleLoopReadingPlanDay(tripleLoopStateForPlanDay(planDay)),
  };
}

export async function loadTodayReadingPlanPayload(
  prefs: ReadingPlanPrefs,
  opts?: { dayCount?: number },
): Promise<TodayReadingPlanPayload | null> {
  if (isTripleLoopPlanId(prefs.planId)) {
    return buildTripleLoopDayPayload(prefs);
  }
  const dayCount = opts?.dayCount ?? prefs.dayCount ?? 365;
  const dayIndex = resolveEffectiveReadingPlanDayIndex(prefs, dayCount);
  return fetchReadingPlanDayClient(prefs.planId, dayIndex);
}

export function getTodayReadingsFromPayload(payload: TodayReadingPlanPayload | null): ReadingPlanDay["readings"] {
  return payload?.day?.readings ?? [];
}
