import {
  isTripleLoopPlanId,
  TRIPLE_LOOP_PLAN_DAY_COUNT,
  TRIPLE_LOOP_PLAN_ID,
} from "./triple-loop-plan";
import type { TripleLoopReadingState } from "./triple-loop-reading";
import {
  getReadingPlanDaySinceEpoch,
  READING_PLAN_EASTER_EPOCH_DATE,
} from "./reading-plan-epoch";
import {
  readReadingPlanPrefs,
  setActiveReadingPlan,
} from "./reading-plan-prefs";
import {
  resetTripleLoopProgressToEpochDefault,
} from "./triple-loop-progress";
import { buildTodayReadingScopeKey, clearTodayReadingDoneForScope } from "./today-reading-done";

export async function ensureTripleLoopPlanPrefs(): Promise<void> {
  await setActiveReadingPlan(TRIPLE_LOOP_PLAN_ID, "calendar-easter", {
    dayCount: TRIPLE_LOOP_PLAN_DAY_COUNT,
  });
}

export async function syncTripleLoopPlanPrefsIfNeeded(): Promise<void> {
  const stored = await readReadingPlanPrefs();
  // 隐式默认（未落盘）不写入，避免重装后把云端已选计划盖掉。
  if (!stored || !isTripleLoopPlanId(stored.planId)) return;

  if (
    stored.anchor !== "calendar-easter" ||
    stored.startedOn !== READING_PLAN_EASTER_EPOCH_DATE ||
    stored.dayCount !== TRIPLE_LOOP_PLAN_DAY_COUNT
  ) {
    await ensureTripleLoopPlanPrefs();
  }
}

export async function resetTripleLoopPlanToEasterDefault(
  now = new Date(),
): Promise<TripleLoopReadingState> {
  await ensureTripleLoopPlanPrefs();

  const scopeKey = buildTodayReadingScopeKey({
    planId: TRIPLE_LOOP_PLAN_ID,
    isTripleLoop: true,
    epochDay: getReadingPlanDaySinceEpoch(now),
    dayIndex: null,
  });
  await clearTodayReadingDoneForScope(scopeKey);

  return resetTripleLoopProgressToEpochDefault();
}
