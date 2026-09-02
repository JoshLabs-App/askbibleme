import { NT_DEEP_REPEAT_PLAN_ID } from "./nt-deep-repeat-plan";
import {
  NT_DEEP_REPEAT_DEFAULT_PACE,
  type NtDeepRepeatPace,
} from "@/lib/bible/reading-plans/nt-deep-repeat-pace";
import {
  resetNtDeepRepeatProgressToFresh,
  resetNtDeepRepeatProgressToPlanDay,
} from "./nt-deep-repeat-progress";
import { readReadingPlanPrefs, setActiveReadingPlan } from "./reading-plan-prefs";

/**
 * 设为当前计划：自今天起为第 1 天，并从第 1 阶《约翰一书》起步。
 * 传入 startDay（>1）时把起始日回拨，使今天成为该计划的第 startDay 天。
 */
export async function activateNtDeepRepeatPlan(opts?: {
  dayCount?: number;
  now?: Date;
  pace?: NtDeepRepeatPace;
  startDay?: number;
}): Promise<void> {
  const now = opts?.now ?? new Date();
  const pace = opts?.pace ?? NT_DEEP_REPEAT_DEFAULT_PACE;
  const startDay = Math.max(1, Math.floor(opts?.startDay ?? 1));
  const backDated = new Date(now);
  backDated.setDate(backDated.getDate() - (startDay - 1));
  const prev = await readReadingPlanPrefs();
  const switching = prev?.planId !== NT_DEEP_REPEAT_PLAN_ID;
  const paceChanged =
    prev?.planId === NT_DEEP_REPEAT_PLAN_ID && prev.ntDeepRepeatPace !== pace;
  await setActiveReadingPlan(NT_DEEP_REPEAT_PLAN_ID, "from-today", {
    dayCount: opts?.dayCount,
    now: backDated,
    ntDeepRepeatPace: pace,
  });
  if (switching || paceChanged || startDay > 1) {
    if (startDay > 1) {
      await resetNtDeepRepeatProgressToPlanDay(startDay, backDated, pace);
    } else {
      await resetNtDeepRepeatProgressToFresh(backDated, pace);
    }
  }
}
