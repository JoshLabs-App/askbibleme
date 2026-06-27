import { activateNtDeepRepeatPlan } from "../../read/reading-plan/nt-deep-repeat-plan-sync";
import { NT_DEEP_REPEAT_PLAN_ID } from "../../read/reading-plan/nt-deep-repeat-plan";
import {
  NT_DEEP_REPEAT_DEFAULT_PACE,
  type NtDeepRepeatPace,
} from "../../read/reading-plan/nt-deep-repeat-pace";
import {
  readReadingPlanPrefs,
  setActiveReadingPlan,
  type ReadingPlanPrefs,
} from "../../read/reading-plan/reading-plan-prefs";
import { isTripleLoopPlanId, TRIPLE_LOOP_PLAN_ID } from "../../read/reading-plan/triple-loop-plan";

export type ReadingPlannerPlanChoice =
  | { type: "nt-deep-repeat"; pace: NtDeepRepeatPace }
  | { type: "triple-loop" }
  | { type: "other"; planId: string; dayCount: number };

export function isReadingPlannerChoiceActive(
  choice: ReadingPlannerPlanChoice,
  prefs: ReadingPlanPrefs,
): boolean {
  if (choice.type === "nt-deep-repeat") {
    return prefs.planId === NT_DEEP_REPEAT_PLAN_ID && prefs.ntDeepRepeatPace === choice.pace;
  }
  if (choice.type === "triple-loop") {
    return prefs.planId === TRIPLE_LOOP_PLAN_ID;
  }
  return prefs.planId === choice.planId;
}

export async function activateReadingPlanFromPlanner(choice: ReadingPlannerPlanChoice): Promise<void> {
  if (choice.type === "nt-deep-repeat") {
    await activateNtDeepRepeatPlan({ dayCount: 1, pace: choice.pace });
    return;
  }
  if (choice.type === "triple-loop") {
    await setActiveReadingPlan(TRIPLE_LOOP_PLAN_ID, "calendar-easter", { dayCount: 1 });
    return;
  }
  await setActiveReadingPlan(choice.planId, "from-today", { dayCount: choice.dayCount });
}

export async function readCurrentPlannerChoice(): Promise<ReadingPlannerPlanChoice | null> {
  const prefs = await readReadingPlanPrefs();
  if (!prefs) return null;
  if (prefs.planId === NT_DEEP_REPEAT_PLAN_ID) {
    return { type: "nt-deep-repeat", pace: prefs.ntDeepRepeatPace ?? NT_DEEP_REPEAT_DEFAULT_PACE };
  }
  if (isTripleLoopPlanId(prefs.planId)) {
    return { type: "triple-loop" };
  }
  return { type: "other", planId: prefs.planId, dayCount: prefs.dayCount ?? 365 };
}
