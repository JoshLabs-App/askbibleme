import { isTripleLoopPlanId } from "@/lib/bible/reading-plans/triple-loop-plan";
import { getReadingPlanDaySinceEpoch } from "@/lib/read/reading-plan-epoch";
import {
  readEffectiveReadingPlanPrefs,
  resolveReadingPlanDayIndex,
  writeReadingPlanPrefs,
  type ReadingPlanPrefs,
} from "@/lib/read/reading-plan-prefs";
import {
  advanceTripleLoopOnePlanDay,
  resetTripleLoopToCalendarToday,
} from "@/lib/read/triple-loop-progress";
import { scheduleMemberReadingSyncWeb } from "@/lib/member-reading-sync/client/run-member-reading-sync-web";

export function readAheadDays(prefs: ReadingPlanPrefs): number {
  const n = prefs.aheadDays;
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

export function resolveEffectiveEpochDay(prefs: ReadingPlanPrefs, now = new Date()): number {
  return getReadingPlanDaySinceEpoch(now) + readAheadDays(prefs);
}

/** 0-based effective day index for bundled reading plans (calendar day + ahead offset). */
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
  if (isTripleLoopPlanId(prefs.planId)) return true;
  const count = dayCount ?? prefs.dayCount ?? 365;
  if (!Number.isFinite(count) || count < 1) return false;
  const calendarIndex = resolveReadingPlanDayIndex(prefs, count, now);
  return calendarIndex + readAheadDays(prefs) < count - 1;
}

function notifyReadingPlanChangedWeb(): void {
  scheduleMemberReadingSyncWeb();
}

export function advanceReadingPlanOneDay(now = new Date()): ReadingPlanPrefs {
  const prefs = readEffectiveReadingPlanPrefs();
  const dayCount = prefs.dayCount ?? 365;
  if (!canAdvanceReadingPlanOneDay(prefs, dayCount, now)) return prefs;

  const nextPrefs: ReadingPlanPrefs = {
    ...prefs,
    aheadDays: readAheadDays(prefs) + 1,
  };
  writeReadingPlanPrefs(nextPrefs);

  if (isTripleLoopPlanId(prefs.planId)) {
    advanceTripleLoopOnePlanDay(now);
  }

  notifyReadingPlanChangedWeb();
  return nextPrefs;
}

export function resetReadingPlanAheadToToday(now = new Date()): ReadingPlanPrefs {
  const prefs = readEffectiveReadingPlanPrefs();
  if (readAheadDays(prefs) === 0 && !isTripleLoopPlanId(prefs.planId)) {
    return prefs;
  }

  const nextPrefs: ReadingPlanPrefs = { ...prefs, aheadDays: 0 };
  writeReadingPlanPrefs(nextPrefs);

  if (isTripleLoopPlanId(prefs.planId)) {
    resetTripleLoopToCalendarToday(now);
  }

  notifyReadingPlanChangedWeb();
  return nextPrefs;
}

export function mergeReadingPlanPrefsValue(a: unknown, b: unknown): ReadingPlanPrefs | unknown {
  if (!a || typeof a !== "object") return b;
  if (!b || typeof b !== "object") return a;
  const left = a as ReadingPlanPrefs;
  const right = b as ReadingPlanPrefs;
  const ahead = Math.max(readAheadDays(left), readAheadDays(right));
  const base = right.version === 1 ? right : left;
  return { ...base, aheadDays: ahead > 0 ? ahead : undefined };
}

/** When switching plans, clear read-ahead offset. */
export function stripAheadDaysFromPrefs(prefs: ReadingPlanPrefs): ReadingPlanPrefs {
  if (readAheadDays(prefs) === 0) return prefs;
  const { aheadDays: _omit, ...rest } = prefs;
  return rest as ReadingPlanPrefs;
}
