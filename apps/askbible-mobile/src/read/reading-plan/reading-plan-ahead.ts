import { isNtDeepRepeatPlanId } from "./nt-deep-repeat-plan";
import { resolveNtDeepRepeatPlanDay } from "./nt-deep-repeat-plan-day";
import {
  advanceNtDeepRepeatOnePlanDay,
  resetNtDeepRepeatToCalendarToday,
} from "./nt-deep-repeat-progress";
import { isPointerReadingPlanId } from "./pointer-reading-plan";
import { isTripleLoopPlanId } from "./triple-loop-plan";
import { getReadingPlanDaySinceEpoch } from "./reading-plan-epoch";
import {
  readEffectiveReadingPlanPrefs,
  resolveReadingPlanDayIndex,
  writeReadingPlanPrefs,
  type ReadingPlanPrefs,
} from "./reading-plan-prefs";
import {
  advanceTripleLoopOnePlanDay,
  resetTripleLoopToCalendarToday,
} from "./triple-loop-progress";

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
  if (isPointerReadingPlanId(prefs.planId)) return true;
  const count = dayCount ?? prefs.dayCount ?? 365;
  if (!Number.isFinite(count) || count < 1) return false;
  const calendarIndex = resolveReadingPlanDayIndex(prefs, count, now);
  return calendarIndex + readAheadDays(prefs) < count - 1;
}

async function notifyReadingPlanChangedMobile(): Promise<void> {
  const { notifyMemberReadingLocalChanged } = await import("../../member-sync/requestMemberReadingSync");
  notifyMemberReadingLocalChanged("readingPlanPrefs");
}

export async function advanceReadingPlanOneDay(now = new Date()): Promise<ReadingPlanPrefs> {
  const prefs = await readEffectiveReadingPlanPrefs();
  const dayCount = prefs.dayCount ?? 365;
  if (!canAdvanceReadingPlanOneDay(prefs, dayCount, now)) return prefs;

  const nextPrefs: ReadingPlanPrefs = {
    ...prefs,
    aheadDays: readAheadDays(prefs) + 1,
  };
  await writeReadingPlanPrefs(nextPrefs);

  if (isTripleLoopPlanId(prefs.planId)) {
    await advanceTripleLoopOnePlanDay(now);
  } else if (isNtDeepRepeatPlanId(prefs.planId)) {
    await advanceNtDeepRepeatOnePlanDay(now);
  }

  await notifyReadingPlanChangedMobile();
  return nextPrefs;
}

export async function resetReadingPlanAheadToToday(now = new Date()): Promise<ReadingPlanPrefs> {
  const prefs = await readEffectiveReadingPlanPrefs();
  if (readAheadDays(prefs) === 0 && !isPointerReadingPlanId(prefs.planId)) {
    return prefs;
  }

  const nextPrefs: ReadingPlanPrefs = { ...prefs, aheadDays: 0 };
  await writeReadingPlanPrefs(nextPrefs);

  if (isTripleLoopPlanId(prefs.planId)) {
    await resetTripleLoopToCalendarToday(now);
  } else if (isNtDeepRepeatPlanId(prefs.planId)) {
    await resetNtDeepRepeatToCalendarToday(now);
  }

  await notifyReadingPlanChangedMobile();
  return nextPrefs;
}

export function mergeReadingPlanPrefsValue(a: unknown, b: unknown): ReadingPlanPrefs | unknown {
  if (!a || typeof a !== "object") return b;
  if (!b || typeof b !== "object") return a;
  const left = a as ReadingPlanPrefs;
  const right = b as ReadingPlanPrefs;
  const ahead = Math.max(readAheadDays(left), readAheadDays(right));
  const base = readAheadDays(right) >= readAheadDays(left)
    ? right.version === 1
      ? right
      : left
    : left.version === 1
      ? left
      : right;
  return { ...base, aheadDays: ahead > 0 ? ahead : undefined };
}

export function stripAheadDaysFromPrefs(prefs: ReadingPlanPrefs): ReadingPlanPrefs {
  if (readAheadDays(prefs) === 0) return prefs;
  const { aheadDays: _omit, ...rest } = prefs;
  return rest as ReadingPlanPrefs;
}
