import { isNtDeepRepeatPlanId } from "./nt-deep-repeat-plan";
import { reconcileNtDeepRepeatAheadDays } from "./nt-deep-repeat-effective-plan-day";
import { readNtDeepRepeatProgress } from "./nt-deep-repeat-progress";
import {
  readEffectiveReadingPlanPrefs,
  writeReadingPlanPrefs,
} from "./reading-plan-prefs";
import { readAheadDays } from "./reading-plan-ahead";

/** After sync apply, align aheadDays with merged NT deep-repeat pointers. */
export async function reconcileNtDeepRepeatReadingPlanAfterSync(): Promise<void> {
  const prefs = await readEffectiveReadingPlanPrefs();
  if (!isNtDeepRepeatPlanId(prefs.planId)) return;
  const progress = await readNtDeepRepeatProgress();
  const next = reconcileNtDeepRepeatAheadDays(prefs, progress);
  if (readAheadDays(next) === readAheadDays(prefs)) return;
  await writeReadingPlanPrefs(next);
}
