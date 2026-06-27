import { isNtDeepRepeatPlanId } from "./nt-deep-repeat-plan";
import { isTripleLoopPlanId } from "./triple-loop-plan";

/** 以指针状态驱动、非日历 dayIndex 的读经计划 */
export function isPointerReadingPlanId(planId: string): boolean {
  return isTripleLoopPlanId(planId) || isNtDeepRepeatPlanId(planId);
}
