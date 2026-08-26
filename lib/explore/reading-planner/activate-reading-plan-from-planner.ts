import { NT_DEEP_REPEAT_PLAN_ID } from "@/lib/bible/reading-plans/nt-deep-repeat-plan";
import {
  NT_DEEP_REPEAT_DEFAULT_PACE,
  type NtDeepRepeatPace,
} from "@/lib/bible/reading-plans/nt-deep-repeat-pace";
import { isTripleLoopPlanId } from "@/lib/bible/reading-plans/triple-loop-plan";
import { activateNtDeepRepeatPlan } from "@/lib/read/nt-deep-repeat-plan-sync";
import {
  readReadingPlanPrefs,
  setActiveReadingPlan,
  type ReadingPlanPrefs,
} from "@/lib/read/reading-plan-prefs";
import { ensureTripleLoopPlanPrefs } from "@/lib/read/triple-loop-plan-sync";

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
    return isTripleLoopPlanId(prefs.planId) && prefs.anchor === "calendar-easter";
  }
  return prefs.planId === choice.planId;
}

export function readingPlannerChoiceSupportsStartDay(choice: ReadingPlannerPlanChoice): boolean {
  return choice.type === "nt-deep-repeat" || choice.type === "other";
}

export function readingPlannerChoiceMaxStartDay(choice: ReadingPlannerPlanChoice): number {
  if (choice.type === "other") {
    return Math.max(1, Number.isFinite(choice.dayCount) ? choice.dayCount : 365);
  }
  if (choice.type === "nt-deep-repeat") return 365;
  return 1;
}

export function activateReadingPlanFromPlanner(
  choice: ReadingPlannerPlanChoice,
  opts?: { startDay?: number },
): void {
  const startDay = Math.max(1, Math.floor(opts?.startDay ?? 1));
  if (choice.type === "nt-deep-repeat") {
    activateNtDeepRepeatPlan({ dayCount: 1, pace: choice.pace, startDay });
    return;
  }
  if (choice.type === "triple-loop") {
    ensureTripleLoopPlanPrefs();
    return;
  }
  const backDated = new Date();
  backDated.setDate(backDated.getDate() - (startDay - 1));
  setActiveReadingPlan(choice.planId, "from-today", {
    dayCount: choice.dayCount,
    now: backDated,
  });
}

export function readCurrentPlannerChoice(): ReadingPlannerPlanChoice | null {
  const prefs = readReadingPlanPrefs();
  if (!prefs) return null;
  if (prefs.planId === NT_DEEP_REPEAT_PLAN_ID) {
    return { type: "nt-deep-repeat", pace: prefs.ntDeepRepeatPace ?? NT_DEEP_REPEAT_DEFAULT_PACE };
  }
  if (isTripleLoopPlanId(prefs.planId)) {
    return { type: "triple-loop" };
  }
  return { type: "other", planId: prefs.planId, dayCount: prefs.dayCount ?? 365 };
}
