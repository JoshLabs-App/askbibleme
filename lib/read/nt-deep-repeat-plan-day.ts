import { localDaysBetween, toLocalDateString, type ReadingPlanPrefs } from "@/lib/read/reading-plan-prefs";

export function resolveNtDeepRepeatPlanDay(prefs: ReadingPlanPrefs, now = new Date()): number {
  const today = toLocalDateString(now);
  const start = prefs.startedOn?.trim() || today;
  return Math.max(1, localDaysBetween(start, today) + 1);
}
