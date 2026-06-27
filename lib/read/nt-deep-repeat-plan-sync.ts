import { NT_DEEP_REPEAT_PLAN_ID } from "@/lib/bible/reading-plans/nt-deep-repeat-plan";
import {
  NT_DEEP_REPEAT_DEFAULT_PACE,
  type NtDeepRepeatPace,
} from "@/lib/bible/reading-plans/nt-deep-repeat-pace";
import { resetNtDeepRepeatProgressToFresh } from "@/lib/read/nt-deep-repeat-progress";
import { readReadingPlanPrefs, setActiveReadingPlan } from "@/lib/read/reading-plan-prefs";

export function activateNtDeepRepeatPlan(opts?: {
  dayCount?: number;
  now?: Date;
  pace?: NtDeepRepeatPace;
}): void {
  const now = opts?.now ?? new Date();
  const pace = opts?.pace ?? NT_DEEP_REPEAT_DEFAULT_PACE;
  const prev = readReadingPlanPrefs();
  const switching = prev?.planId !== NT_DEEP_REPEAT_PLAN_ID;
  const paceChanged =
    prev?.planId === NT_DEEP_REPEAT_PLAN_ID && prev.ntDeepRepeatPace !== pace;
  setActiveReadingPlan(NT_DEEP_REPEAT_PLAN_ID, "from-today", {
    dayCount: opts?.dayCount,
    now,
    ntDeepRepeatPace: pace,
  });
  if (switching || paceChanged) {
    resetNtDeepRepeatProgressToFresh(now, pace);
  }
}
