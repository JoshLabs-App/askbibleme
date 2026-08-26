import { isNtDeepRepeatPlanId } from "@/lib/bible/reading-plans/nt-deep-repeat-plan";
import { isTripleLoopPlanId } from "@/lib/bible/reading-plans/triple-loop-plan";
import { resolveNtDeepRepeatPlanDay } from "@/lib/read/nt-deep-repeat-plan-day";
import { getReadingPlanDaySinceEpoch } from "@/lib/read/reading-plan-epoch";
import {
  readEffectiveReadingPlanPrefs,
  resolveReadingPlanDayIndex,
  writeReadingPlanPrefs,
  type ReadingPlanPrefs,
} from "@/lib/read/reading-plan-prefs";
import {
  advanceNtDeepRepeatOnePlanDay,
  resetNtDeepRepeatToCalendarToday,
} from "@/lib/read/nt-deep-repeat-progress";
import {
  advanceTripleLoopOnePlanDay,
  resetTripleLoopToCalendarToday,
} from "@/lib/read/triple-loop-progress";
import { flushMemberReadingSyncWebNow } from "@/lib/member-reading-sync/client/run-member-reading-sync-web";
import {
  mergeReadingPlanPrefsValue,
  shouldSyncReadingPlanPrefs,
} from "./reading-plan-prefs-merge";

export { mergeReadingPlanPrefsValue, shouldSyncReadingPlanPrefs };

export type { ReadingPlanPrefs };

export function readAheadDays(prefs: ReadingPlanPrefs): number {
  const n = prefs.aheadDays;
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

export function resolveEffectiveEpochDay(prefs: ReadingPlanPrefs, now = new Date()): number {
  if (isNtDeepRepeatPlanId(prefs.planId)) {
    return resolveNtDeepRepeatPlanDay(prefs, now) + readAheadDays(prefs);
  }
  return getReadingPlanDaySinceEpoch(now) + readAheadDays(prefs);
}

export function resolveEffectiveReadingPlanDayIndex(
  prefs: ReadingPlanPrefs,
  dayCount: number,
  now = new Date(),
): number {
  if (!Number.isFinite(dayCount) || dayCount < 1) return 0;
  const calendarIndex = resolveReadingPlanDayIndex(prefs, dayCount, now);
  const next = calendarIndex + readAheadDays(prefs);
  if (next < 0) return 0;
  if (next >= dayCount) return dayCount - 1;
  return next;
}

export function canAdvanceReadingPlanOneDay(
  prefs: ReadingPlanPrefs,
  dayCount: number | undefined,
  now = new Date(),
): boolean {
  if (isTripleLoopPlanId(prefs.planId) || isNtDeepRepeatPlanId(prefs.planId)) return true;
  const count = dayCount ?? prefs.dayCount ?? 365;
  if (!Number.isFinite(count) || count < 1) return false;
  const calendarIndex = resolveReadingPlanDayIndex(prefs, count, now);
  return calendarIndex + readAheadDays(prefs) < count - 1;
}

function notifyReadingPlanChangedWeb(): void {
  flushMemberReadingSyncWebNow("readingPlanPrefs");
}

export function advanceReadingPlanOneDay(now = new Date()): ReadingPlanPrefs {
  const prefs = readEffectiveReadingPlanPrefs();
  const dayCount = prefs.dayCount ?? 365;
  if (!canAdvanceReadingPlanOneDay(prefs, dayCount, now)) return prefs;

  const nextPrefs: ReadingPlanPrefs = {
    ...prefs,
    aheadDays: readAheadDays(prefs) + 1,
    chosen: true,
  };
  writeReadingPlanPrefs(nextPrefs);

  if (isTripleLoopPlanId(prefs.planId)) {
    advanceTripleLoopOnePlanDay(now);
  } else if (isNtDeepRepeatPlanId(prefs.planId)) {
    advanceNtDeepRepeatOnePlanDay(now);
  }

  notifyReadingPlanChangedWeb();
  return nextPrefs;
}

export function resetReadingPlanAheadToToday(now = new Date()): ReadingPlanPrefs {
  const prefs = readEffectiveReadingPlanPrefs();
  const isPointer = isTripleLoopPlanId(prefs.planId) || isNtDeepRepeatPlanId(prefs.planId);
  if (readAheadDays(prefs) === 0 && !isPointer) {
    return prefs;
  }

  const nextPrefs: ReadingPlanPrefs = { ...prefs, aheadDays: 0, chosen: true };
  writeReadingPlanPrefs(nextPrefs);

  if (isTripleLoopPlanId(prefs.planId)) {
    resetTripleLoopToCalendarToday(now);
  } else if (isNtDeepRepeatPlanId(prefs.planId)) {
    resetNtDeepRepeatToCalendarToday(now);
  }

  notifyReadingPlanChangedWeb();
  return nextPrefs;
}

export function stripAheadDaysFromPrefs(prefs: ReadingPlanPrefs): ReadingPlanPrefs {
  if (readAheadDays(prefs) === 0) return prefs;
  const { aheadDays: _omit, ...rest } = prefs;
  return rest as ReadingPlanPrefs;
}
