import { NT_DEEP_REPEAT_PLAN_ID } from "./nt-deep-repeat-plan";
import {
  NT_DEEP_REPEAT_DEFAULT_PACE,
  type NtDeepRepeatPace,
} from "./nt-deep-repeat-pace";
import { resetNtDeepRepeatProgressToFresh } from "./nt-deep-repeat-progress";
import { readReadingPlanPrefs, setActiveReadingPlan } from "./reading-plan-prefs";

/** 设为当前计划：自今天起为第 1 天，并从第 1 阶《约翰一书》起步。 */
export async function activateNtDeepRepeatPlan(opts?: {
  dayCount?: number;
  now?: Date;
  pace?: NtDeepRepeatPace;
}): Promise<void> {
  const now = opts?.now ?? new Date();
  const pace = opts?.pace ?? NT_DEEP_REPEAT_DEFAULT_PACE;
  const prev = await readReadingPlanPrefs();
  const switching = prev?.planId !== NT_DEEP_REPEAT_PLAN_ID;
  const paceChanged =
    prev?.planId === NT_DEEP_REPEAT_PLAN_ID && prev.ntDeepRepeatPace !== pace;
  await setActiveReadingPlan(NT_DEEP_REPEAT_PLAN_ID, "from-today", {
    dayCount: opts?.dayCount,
    now,
    ntDeepRepeatPace: pace,
  });
  if (switching || paceChanged) {
    await resetNtDeepRepeatProgressToFresh(now, pace);
  }
}
