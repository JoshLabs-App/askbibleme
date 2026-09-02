import { isTripleLoopPlanId } from "./triple-loop-plan";
import {
  inferTripleLoopAheadDays,
} from "./triple-loop-effective-plan-day";
import {
  normalizeTripleLoopReadingState,
  tripleLoopStateForPlanDay,
} from "./triple-loop-reading";
import { normalizeTripleLoopChaptersReadKeys } from "@/lib/bible/reading-plans/triple-loop-chapters-read";
import {
  readTripleLoopProgress,
  replaceTripleLoopProgress,
} from "./triple-loop-progress";
import { getReadingPlanDaySinceEpoch, READING_PLAN_EASTER_EPOCH_DATE } from "@/lib/read/reading-plan-epoch";
import { readAheadDays } from "./reading-plan-ahead";
import { readEffectiveReadingPlanPrefs, writeReadingPlanPrefs } from "./reading-plan-prefs";

/**
 * After sync apply: keep readingPlanPrefs.aheadDays authoritative when the user
 * has chosen a plan. Unchosen bootstrap prefs (reinstall) recover from progress.
 */
export async function reconcileTripleLoopReadingPlanAfterSync(): Promise<boolean> {
  const prefs = await readEffectiveReadingPlanPrefs();
  if (!isTripleLoopPlanId(prefs.planId)) return false;

  const stored = await readTripleLoopProgress();
  const prefsAhead = readAheadDays(prefs);
  const inferred = inferTripleLoopAheadDays(stored);
  if (inferred <= prefsAhead) return false;

  // 重装后本机是未选默认：从进度指针恢复 aheadDays，勿按 0 把进度拉回日历。
  if (prefs.chosen !== true) {
    await writeReadingPlanPrefs(
      { ...prefs, aheadDays: inferred, chosen: true },
      { notifySync: false },
    );
    return true;
  }

  const planDay = getReadingPlanDaySinceEpoch() + prefsAhead;
  const clipped = normalizeTripleLoopReadingState({
    ...tripleLoopStateForPlanDay(planDay),
    startedAt: stored.startedAt?.trim() || READING_PLAN_EASTER_EPOCH_DATE,
    chaptersReadKeys: normalizeTripleLoopChaptersReadKeys(stored.chaptersReadKeys),
  });
  await replaceTripleLoopProgress(clipped);
  return false;
}
