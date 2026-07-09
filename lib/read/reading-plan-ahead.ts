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
import { scheduleMemberReadingSyncWeb } from "@/lib/member-reading-sync/client/run-member-reading-sync-web";

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

  const nextPrefs: ReadingPlanPrefs = { ...prefs, aheadDays: 0 };
  writeReadingPlanPrefs(nextPrefs);

  if (isTripleLoopPlanId(prefs.planId)) {
    resetTripleLoopToCalendarToday(now);
  } else if (isNtDeepRepeatPlanId(prefs.planId)) {
    resetNtDeepRepeatToCalendarToday(now);
  }

  notifyReadingPlanChangedWeb();
  return nextPrefs;
}

/**
 * 跨设备合并同一 `from-today` 计划时，取“更早的开始日期”。
 * 新装/重装设备的 startedOn 会是今天；若采用较新的一份，会把计划进度
 * （尤其旧约“每天 +1 章”）重置回第 1 天，与另一台设备不一致。
 */
function earlierFromTodayStartedOn(
  left: ReadingPlanPrefs,
  right: ReadingPlanPrefs,
  planId: string,
): string | undefined {
  const candidates: { startedOn: string; ms: number }[] = [];
  for (const p of [left, right]) {
    if (p.anchor !== "from-today" || p.planId !== planId) continue;
    const s = p.startedOn?.trim();
    if (!s) continue;
    const ms = Date.parse(s);
    if (Number.isFinite(ms)) candidates.push({ startedOn: s, ms });
  }
  if (!candidates.length) return undefined;
  candidates.sort((x, y) => x.ms - y.ms);
  return candidates[0].startedOn;
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
  const merged: ReadingPlanPrefs = { ...base, aheadDays: ahead > 0 ? ahead : undefined };

  if (merged.anchor === "from-today") {
    const earliest = earlierFromTodayStartedOn(left, right, merged.planId);
    if (earliest) merged.startedOn = earliest;
  }

  return merged;
}

export function stripAheadDaysFromPrefs(prefs: ReadingPlanPrefs): ReadingPlanPrefs {
  if (readAheadDays(prefs) === 0) return prefs;
  const { aheadDays: _omit, ...rest } = prefs;
  return rest as ReadingPlanPrefs;
}
