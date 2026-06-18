import { isTripleLoopPlanId } from "./triple-loop-plan";
import {
  readEffectiveReadingPlanPrefs,
  writeReadingPlanPrefs,
} from "./reading-plan-prefs";
import { readTripleLoopProgress } from "./triple-loop-progress";
import { reconcileTripleLoopAheadDays } from "./triple-loop-effective-plan-day";
import { readAheadDays } from "./reading-plan-ahead";

/** After sync apply, align aheadDays with merged triple-loop pointers. */
export async function reconcileTripleLoopReadingPlanAfterSync(): Promise<void> {
  const prefs = await readEffectiveReadingPlanPrefs();
  if (!isTripleLoopPlanId(prefs.planId)) return;
  const progress = await readTripleLoopProgress();
  const next = reconcileTripleLoopAheadDays(prefs, progress);
  if (readAheadDays(next) === readAheadDays(prefs)) return;
  await writeReadingPlanPrefs(next);
}
