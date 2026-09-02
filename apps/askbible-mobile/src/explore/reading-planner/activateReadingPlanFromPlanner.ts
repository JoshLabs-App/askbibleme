import { activateNtDeepRepeatPlan } from "../../read/reading-plan/nt-deep-repeat-plan-sync";
import { NT_DEEP_REPEAT_PLAN_ID } from "../../read/reading-plan/nt-deep-repeat-plan";
import {
  NT_DEEP_REPEAT_DEFAULT_PACE,
  type NtDeepRepeatPace,
} from "@/lib/bible/reading-plans/nt-deep-repeat-pace";
import {
  readReadingPlanPrefs,
  setActiveReadingPlan,
  type ReadingPlanPrefs,
} from "../../read/reading-plan/reading-plan-prefs";
import { isTripleLoopPlanId, TRIPLE_LOOP_PLAN_ID } from "../../read/reading-plan/triple-loop-plan";
import { ensureTripleLoopPlanPrefs } from "../../read/reading-plan/triple-loop-plan-sync";

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
    return prefs.planId === TRIPLE_LOOP_PLAN_ID && prefs.anchor === "calendar-easter";
  }
  return prefs.planId === choice.planId;
}

/** 是否支持「从第几天开始读」（三循环按复活节历元锚定，不适用）。 */
export function readingPlannerChoiceSupportsStartDay(choice: ReadingPlannerPlanChoice): boolean {
  return choice.type === "nt-deep-repeat" || choice.type === "other";
}

/** 「从第几天开始读」的上限。 */
export function readingPlannerChoiceMaxStartDay(choice: ReadingPlannerPlanChoice): number {
  if (choice.type === "other") {
    return Math.max(1, Number.isFinite(choice.dayCount) ? choice.dayCount : 365);
  }
  if (choice.type === "nt-deep-repeat") return 365;
  return 1;
}

export async function activateReadingPlanFromPlanner(
  choice: ReadingPlannerPlanChoice,
  opts?: { startDay?: number },
): Promise<void> {
  const startDay = Math.max(1, Math.floor(opts?.startDay ?? 1));
  if (choice.type === "nt-deep-repeat") {
    await activateNtDeepRepeatPlan({ dayCount: 1, pace: choice.pace, startDay });
    return;
  }
  if (choice.type === "triple-loop") {
    await ensureTripleLoopPlanPrefs();
    return;
  }
  const backDated = new Date();
  backDated.setDate(backDated.getDate() - (startDay - 1));
  await setActiveReadingPlan(choice.planId, "from-today", {
    dayCount: choice.dayCount,
    now: backDated,
  });
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
