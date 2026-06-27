import { localDaysBetween, toLocalDateString, type ReadingPlanPrefs } from "./reading-plan-prefs";

/** 自选定计划日起的第几天（1 = 选定当天）。 */
export function resolveNtDeepRepeatPlanDay(prefs: ReadingPlanPrefs, now = new Date()): number {
  const today = toLocalDateString(now);
  const start = prefs.startedOn?.trim() || today;
  return Math.max(1, localDaysBetween(start, today) + 1);
}
