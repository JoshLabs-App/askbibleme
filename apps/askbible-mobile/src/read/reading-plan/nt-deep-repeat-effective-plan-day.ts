import { readAheadDays } from "./reading-plan-ahead";
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
  const fromPrefs = readAheadDays(prefs);
  const fromProgress = inferNtDeepRepeatAheadDays(progress, prefs, now);
  const ahead = Math.max(fromPrefs, fromProgress);
  if (ahead === fromPrefs) return prefs;
  if (ahead <= 0) {
    const { aheadDays: _omit, ...rest } = prefs;
    return rest as ReadingPlanPrefs;
  }
  return { ...prefs, aheadDays: ahead };
}
