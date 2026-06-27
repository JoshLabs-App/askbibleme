import type { Router } from "expo-router";
import { buildPlanChapterQueue, type PlanChapterRef } from "../read/read-plan-flow-nav";
import { readEffectiveReadingPlanPrefs } from "../read/reading-plan/reading-plan-prefs";
import { loadTodayReadingPlanPayload } from "../read/reading-plan/today-reading-plan-payload";
import { startTodayPlanFlowScripture } from "../read/startTodayReadingScriptureFromReadHome";

/** 闹钟预备音乐结束后：进入今日读经 planFlow，章节播完自动续下一章直至今日读完。 */
export async function startTodayReadingAlarmScriptureFlow(
  router: Pick<Router, "push" | "replace">,
  firstChapter?: PlanChapterRef | null,
): Promise<boolean> {
  const prefs = await readEffectiveReadingPlanPrefs();
  const payload = await loadTodayReadingPlanPayload(prefs, { dayCount: prefs.dayCount ?? 365 });
  const readings = payload?.day?.readings ?? [];
  if (!readings.length) return false;

  let target = firstChapter ?? null;
  if (!target) {
    target = buildPlanChapterQueue(readings)[0] ?? null;
  }
  if (!target) return false;

  return startTodayPlanFlowScripture(router, target, { loopTodayPlan: true, replace: true });
}
