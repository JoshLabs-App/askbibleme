import { normalizeNtDeepRepeatChaptersReadKeys } from "./nt-deep-repeat-chapters-read";
import { isNtDeepRepeatPlanId } from "./nt-deep-repeat-plan";
import { NT_DEEP_REPEAT_DEFAULT_PACE } from "./nt-deep-repeat-pace";
import { resolveNtDeepRepeatPlanDay } from "./nt-deep-repeat-plan-day";
import { toLocalDateString, type ReadingPlanPrefs } from "./reading-plan-prefs";
import {
  normalizeNtDeepRepeatReadingState,
  ntDeepRepeatStateForPlanDay,
  type NtDeepRepeatReadingState,
} from "./nt-deep-repeat-reading";

function progressScore(state: NtDeepRepeatReadingState): number {
  return state.curriculumIndex * 1000 + state.dayInSegment;
}

function aheadDaysFromPrefs(prefs: ReadingPlanPrefs): number {
  const n = prefs.aheadDays;
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

export function inferNtDeepRepeatPlanDayFromProgress(
  raw: Partial<NtDeepRepeatReadingState> | null | undefined,
  startedOn: string,
): number {
  const target = normalizeNtDeepRepeatReadingState(raw);
  const targetScore = progressScore(target);
  let best = 1;
  for (let d = 1; d <= 4000; d += 1) {
    const implied = ntDeepRepeatStateForPlanDay(d, { pace: target.pace, startedAt: startedOn });
    if (progressScore(implied) <= targetScore) {
      best = d;
    } else {
      break;
    }
  }
  return best;
}

export function inferNtDeepRepeatAheadDays(
  raw: Partial<NtDeepRepeatReadingState> | null | undefined,
  prefs: ReadingPlanPrefs,
  now = new Date(),
): number {
  const startedOn = prefs.startedOn?.trim() || toLocalDateString(now);
  const calendarDay = resolveNtDeepRepeatPlanDay(prefs, now);
  const fromProgress = inferNtDeepRepeatPlanDayFromProgress(raw, startedOn);
  return Math.max(0, fromProgress - calendarDay);
}

export function reconcileNtDeepRepeatAheadDays(
  prefs: ReadingPlanPrefs,
  progress: Partial<NtDeepRepeatReadingState> | null | undefined,
  now = new Date(),
): ReadingPlanPrefs {
  const fromPrefs = aheadDaysFromPrefs(prefs);
  const fromProgress = inferNtDeepRepeatAheadDays(progress, prefs, now);
  const ahead = Math.max(fromPrefs, fromProgress);
  if (ahead === fromPrefs) return prefs;
  if (ahead <= 0) {
    const { aheadDays: _omit, ...rest } = prefs;
    return rest as ReadingPlanPrefs;
  }
  return { ...prefs, aheadDays: ahead };
}

export function ntDeepRepeatPlanPointersEqual(
  a: NtDeepRepeatReadingState,
  b: NtDeepRepeatReadingState,
): boolean {
  return (
    a.ot.bookId === b.ot.bookId &&
    a.ot.chapter === b.ot.chapter &&
    a.curriculumIndex === b.curriculumIndex &&
    a.dayInSegment === b.dayInSegment &&
    a.segmentDayTarget === b.segmentDayTarget
  );
}

/** 旧约随日历每天 +1 章；新约若未超前则随日历，超前时保留用户手动推进的阶/段内天。 */
export function alignNtDeepRepeatProgressToCalendar(
  stored: NtDeepRepeatReadingState,
  prefs: ReadingPlanPrefs,
  now = new Date(),
): NtDeepRepeatReadingState {
  if (!isNtDeepRepeatPlanId(prefs.planId)) return stored;

  const startedAt = prefs.startedOn?.trim() || stored.startedAt?.trim() || toLocalDateString(now);
  const pace = prefs.ntDeepRepeatPace ?? stored.pace ?? NT_DEEP_REPEAT_DEFAULT_PACE;
  const calendarPlanDay = resolveNtDeepRepeatPlanDay(prefs, now) + aheadDaysFromPrefs(prefs);
  const calendarState = ntDeepRepeatStateForPlanDay(calendarPlanDay, { pace, startedAt });
  const storedPlanDay = inferNtDeepRepeatPlanDayFromProgress(stored, startedAt);
  const chaptersReadKeys = normalizeNtDeepRepeatChaptersReadKeys(stored.chaptersReadKeys);
  const ntAhead = storedPlanDay > calendarPlanDay;

  if (ntAhead) {
    return normalizeNtDeepRepeatReadingState({
      ...stored,
      ot: calendarState.ot,
      pace,
      startedAt,
      chaptersReadKeys,
    });
  }

  return normalizeNtDeepRepeatReadingState({
    ...calendarState,
    pace,
    startedAt,
    chaptersReadKeys,
  });
}
