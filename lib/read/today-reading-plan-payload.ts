import {
  NT_DEEP_REPEAT_PLAN_DAY_COUNT,
  NT_DEEP_REPEAT_PLAN_ID,
  isNtDeepRepeatPlanId,
} from "@/lib/bible/reading-plans/nt-deep-repeat-plan";
import { buildNtDeepRepeatReadingPlanDay } from "@/lib/bible/reading-plans/nt-deep-repeat-plan-day";
import { NT_DEEP_REPEAT_DEFAULT_PACE } from "@/lib/bible/reading-plans/nt-deep-repeat-pace";
import {
  ntDeepRepeatStateForPlanDay,
  type NtDeepRepeatReadingState,
} from "@/lib/bible/reading-plans/nt-deep-repeat-reading";
import { buildTripleLoopReadingPlanDay, isTripleLoopPlanId, TRIPLE_LOOP_PLAN_DAY_COUNT } from "@/lib/bible/reading-plans/triple-loop-plan";
import { tripleLoopStateForPlanDay } from "@/lib/bible/reading-plans/triple-loop-reading";
import type { ReadingPlanDay } from "@/lib/bible/reading-plans/types";
import { fetchReadingPlanDayClient, type ReadingPlanDayPayload } from "@/lib/read/fetch-reading-plan-day-client";
import { resolveNtDeepRepeatPlanDay } from "@/lib/read/nt-deep-repeat-plan-day";
import { readNtDeepRepeatProgress } from "@/lib/read/nt-deep-repeat-progress";
import { readAheadDays, resolveEffectiveReadingPlanDayIndex } from "@/lib/read/reading-plan-ahead";
import { getReadingPlanDaySinceEpoch } from "@/lib/read/reading-plan-epoch";
import { resolveReadingPlanDayIndex, toLocalDateString, type ReadingPlanPrefs } from "@/lib/read/reading-plan-prefs";

export type TodayReadingPlanPayload = ReadingPlanDayPayload;

export function todayReadingPayloadMatchesPrefs(
  payload: TodayReadingPlanPayload | null | undefined,
  prefs: ReadingPlanPrefs,
): boolean {
  if (!payload?.planId?.trim() || !prefs?.planId?.trim()) return false;
  if (isTripleLoopPlanId(prefs.planId)) return isTripleLoopPlanId(payload.planId);
  if (isNtDeepRepeatPlanId(prefs.planId)) return isNtDeepRepeatPlanId(payload.planId);
  return payload.planId === prefs.planId;
}

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

export function buildNtDeepRepeatDayPayload(
  prefs?: ReadingPlanPrefs,
  progress?: Partial<NtDeepRepeatReadingState> | null,
): TodayReadingPlanPayload {
  const state = progress ?? readNtDeepRepeatProgress();
  return {
    planId: NT_DEEP_REPEAT_PLAN_ID,
    name: "新约深读 · 旧约通读",
    dayCount: NT_DEEP_REPEAT_PLAN_DAY_COUNT,
    dayIndex: 0,
    day: buildNtDeepRepeatReadingPlanDay(state),
  };
}

export async function loadTodayReadingPlanPayload(
  prefs: ReadingPlanPrefs,
  opts?: { dayCount?: number },
): Promise<TodayReadingPlanPayload | null> {
  if (!prefs?.planId?.trim()) return null;
  if (isTripleLoopPlanId(prefs.planId)) {
    return buildTripleLoopDayPayload(prefs);
  }
  if (isNtDeepRepeatPlanId(prefs.planId)) {
    return buildNtDeepRepeatDayPayload(prefs);
  }
  const dayCount = opts?.dayCount ?? prefs.dayCount ?? 365;
  const dayIndex = resolveEffectiveReadingPlanDayIndex(prefs, dayCount);
  return fetchReadingPlanDayClient(prefs.planId, dayIndex);
}

/**
 * 按相对今天的天数预览某日读经（不写 prefs）。
 */
export async function loadReadingPlanPayloadAtAhead(
  prefs: ReadingPlanPrefs,
  viewAhead: number,
  opts?: { dayCount?: number },
): Promise<TodayReadingPlanPayload | null> {
  if (!prefs?.planId?.trim()) return null;
  const ahead = Number.isFinite(viewAhead) ? Math.floor(viewAhead) : 0;

  if (isTripleLoopPlanId(prefs.planId)) {
    const planDay = Math.max(1, getReadingPlanDaySinceEpoch() + ahead);
    return {
      planId: "triple-loop",
      name: "轻松循环读经计划",
      dayCount: TRIPLE_LOOP_PLAN_DAY_COUNT,
      dayIndex: Math.max(0, planDay - 1),
      day: buildTripleLoopReadingPlanDay(tripleLoopStateForPlanDay(planDay)),
    };
  }

  if (ahead === readAheadDays(prefs)) {
    return loadTodayReadingPlanPayload(prefs, opts);
  }

  if (isNtDeepRepeatPlanId(prefs.planId)) {
    const planDay = Math.max(1, resolveNtDeepRepeatPlanDay(prefs) + ahead);
    const pace = prefs.ntDeepRepeatPace ?? NT_DEEP_REPEAT_DEFAULT_PACE;
    const startedAt = prefs.startedOn?.trim() || toLocalDateString(new Date());
    const progress = ntDeepRepeatStateForPlanDay(planDay, { pace, startedAt });
    return {
      planId: NT_DEEP_REPEAT_PLAN_ID,
      name: "新约深读 · 旧约通读",
      dayCount: NT_DEEP_REPEAT_PLAN_DAY_COUNT,
      dayIndex: Math.max(0, planDay - 1),
      day: buildNtDeepRepeatReadingPlanDay(progress),
    };
  }

  const dayCount = opts?.dayCount ?? prefs.dayCount ?? 365;
  const calendarIndex = resolveReadingPlanDayIndex(prefs, dayCount);
  const dayIndex = Math.max(0, Math.min(dayCount - 1, calendarIndex + ahead));
  return fetchReadingPlanDayClient(prefs.planId, dayIndex);
}

export function getTodayReadingsFromPayload(payload: TodayReadingPlanPayload | null): ReadingPlanDay["readings"] {
  return payload?.day?.readings ?? [];
}
