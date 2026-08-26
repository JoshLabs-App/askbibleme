import { isTripleLoopPlanId, TRIPLE_LOOP_PLAN_DAY_COUNT, TRIPLE_LOOP_PLAN_ID } from "@/lib/bible/reading-plans/triple-loop-plan";
import type { TripleLoopReadingState } from "@/lib/bible/reading-plans/triple-loop-reading";
import {
  getReadingPlanDaySinceEpoch,
  READING_PLAN_EASTER_EPOCH_DATE,
} from "@/lib/read/reading-plan-epoch";
import {
  readReadingPlanPrefs,
  setActiveReadingPlan,
} from "@/lib/read/reading-plan-prefs";
import {
  resetTripleLoopProgressToEpochDefault,
} from "@/lib/read/triple-loop-progress";
import { buildTodayReadingScopeKey, clearTodayReadingDoneForScope } from "@/lib/read/today-reading-done";

/** 确保三轨循环计划 prefs 固定为复活节历元（2026-04-05 起算）。 */
export function ensureTripleLoopPlanPrefs(): void {
  setActiveReadingPlan(TRIPLE_LOOP_PLAN_ID, "calendar-easter", { dayCount: TRIPLE_LOOP_PLAN_DAY_COUNT });
}

/** 读经页进入时修正已保存但锚点/历元不一致的三轨 prefs。 */
export function syncTripleLoopPlanPrefsIfNeeded(): void {
  const stored = readReadingPlanPrefs();
  // 隐式默认（未落盘）不写入，避免重装后把云端已选计划盖掉。
  if (!stored || !isTripleLoopPlanId(stored.planId)) return;

  if (
    stored.anchor !== "calendar-easter" ||
    stored.startedOn !== READING_PLAN_EASTER_EPOCH_DATE ||
    stored.dayCount !== TRIPLE_LOOP_PLAN_DAY_COUNT
  ) {
    ensureTripleLoopPlanPrefs();
  }
}

/** 同步计划 prefs、清除今日完成标记，并重置进度到复活节历元默认位置。 */
export function resetTripleLoopPlanToEasterDefault(now = new Date()): TripleLoopReadingState {
  ensureTripleLoopPlanPrefs();

  const scopeKey = buildTodayReadingScopeKey({
    planId: TRIPLE_LOOP_PLAN_ID,
    isTripleLoop: true,
    epochDay: getReadingPlanDaySinceEpoch(now),
    dayIndex: null,
  });
  clearTodayReadingDoneForScope(scopeKey);

  return resetTripleLoopProgressToEpochDefault(now);
}
