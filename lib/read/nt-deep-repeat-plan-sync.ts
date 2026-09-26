import { NT_DEEP_REPEAT_PLAN_ID } from "@/lib/bible/reading-plans/nt-deep-repeat-plan";
import {
  NT_DEEP_REPEAT_DEFAULT_PACE,
  type NtDeepRepeatPace,
} from "@/lib/bible/reading-plans/nt-deep-repeat-pace";
import {
  resetNtDeepRepeatProgressToFresh,
  resetNtDeepRepeatProgressToPlanDay,
} from "@/lib/read/nt-deep-repeat-progress";
import { setActiveReadingPlan } from "@/lib/read/reading-plan-prefs";

export function activateNtDeepRepeatPlan(opts?: {
  dayCount?: number;
  now?: Date;
  pace?: NtDeepRepeatPace;
  startDay?: number;
}): void {
  const now = opts?.now ?? new Date();
  const pace = opts?.pace ?? NT_DEEP_REPEAT_DEFAULT_PACE;
  const startDay = Math.max(1, Math.floor(opts?.startDay ?? 1));
  const backDated = new Date(now);
  backDated.setDate(backDated.getDate() - (startDay - 1));
  setActiveReadingPlan(NT_DEEP_REPEAT_PLAN_ID, "from-today", {
    dayCount: opts?.dayCount,
    now: backDated,
    ntDeepRepeatPace: pace,
  });
  // 用户明确选了「从第 N 天开始」就按 N 重建进度。以前「同计划同节奏 + 第 1 天」不重建，
  // 旧进度比日历第 1 天靠前会被保留，重新开始变成接着旧进度读（2026-09-26）。
  if (startDay > 1) {
    resetNtDeepRepeatProgressToPlanDay(startDay, backDated, pace);
  } else {
    resetNtDeepRepeatProgressToFresh(backDated, pace);
  }
}
