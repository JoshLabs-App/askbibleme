import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizeNtDeepRepeatChaptersReadKeys } from "./nt-deep-repeat-chapters-read";
import { inferNtDeepRepeatAheadDays } from "@/lib/read/nt-deep-repeat-effective-plan-day";
import { isNtDeepRepeatPlanId } from "./nt-deep-repeat-plan";
import { NT_DEEP_REPEAT_DEFAULT_PACE } from "./nt-deep-repeat-pace";
import { resolveNtDeepRepeatPlanDay } from "./nt-deep-repeat-plan-day";
import {
  NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY,
  parseNtDeepRepeatProgress,
  replaceNtDeepRepeatProgress,
} from "./nt-deep-repeat-progress";
import {
  normalizeNtDeepRepeatReadingState,
  ntDeepRepeatStateForPlanDay,
} from "./nt-deep-repeat-reading";
import { readAheadDays } from "./reading-plan-ahead";
import {
  readEffectiveReadingPlanPrefs,
  toLocalDateString,
  writeReadingPlanPrefs,
} from "./reading-plan-prefs";

/**
 * After sync apply: keep readingPlanPrefs.aheadDays authoritative.
 * Progress merge takes the farthest pointers, which used to re-inflate aheadDays
 * and undo「设为今日」~seconds later. Clip progress down to prefs instead.
 */
export async function reconcileNtDeepRepeatReadingPlanAfterSync(): Promise<boolean> {
  const prefs = await readEffectiveReadingPlanPrefs();
  if (!isNtDeepRepeatPlanId(prefs.planId)) return false;

  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY);
  } catch {
    return false;
  }
  if (!raw) return false;

  const stored = normalizeNtDeepRepeatReadingState(parseNtDeepRepeatProgress(raw) ?? undefined);
  const prefsAhead = readAheadDays(prefs);
  const inferred = inferNtDeepRepeatAheadDays(stored, prefs);
  if (inferred <= prefsAhead) return false;

  if (prefs.chosen !== true) {
    await writeReadingPlanPrefs(
      { ...prefs, aheadDays: inferred, chosen: true },
      { notifySync: false },
    );
    return true;
  }

  const planDay = resolveNtDeepRepeatPlanDay(prefs) + prefsAhead;
  const pace = prefs.ntDeepRepeatPace ?? stored.pace ?? NT_DEEP_REPEAT_DEFAULT_PACE;
  const startedAt = prefs.startedOn?.trim() || stored.startedAt?.trim() || toLocalDateString(new Date());
  await replaceNtDeepRepeatProgress(
    normalizeNtDeepRepeatReadingState({
      ...ntDeepRepeatStateForPlanDay(planDay, { pace, startedAt }),
      pace,
      startedAt,
      chaptersReadKeys: normalizeNtDeepRepeatChaptersReadKeys(stored.chaptersReadKeys),
    }),
  );
  return false;
}
