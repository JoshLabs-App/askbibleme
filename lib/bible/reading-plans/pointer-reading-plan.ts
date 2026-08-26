import { isNtDeepRepeatPlanId } from "@/lib/bible/reading-plans/nt-deep-repeat-plan";
import { isTripleLoopPlanId } from "@/lib/bible/reading-plans/triple-loop-plan";

/** 以指针状态驱动、非日历 dayIndex 的读经计划 */
export function isPointerReadingPlanId(planId: string): boolean {
  return isTripleLoopPlanId(planId) || isNtDeepRepeatPlanId(planId);
}
