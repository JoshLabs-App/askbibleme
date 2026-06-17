import type { Router } from "expo-router";
import { readEffectiveReadingPlanPrefs } from "./reading-plan/reading-plan-prefs";
import { loadTodayReadingPlanPayload } from "./reading-plan/today-reading-plan-payload";
import { armReadPlanFlowAutoplay } from "./read-plan-flow-autoplay";
import { buildPlanChapterQueue, pushReadPlanFlowChapter } from "./read-plan-flow-nav";

/** 从读经首页启动今日朗读：进入首章（planFlow）并标记自动播放。 */
export async function startTodayReadingScriptureFromReadHome(
  router: Pick<Router, "push">,
): Promise<boolean> {
  const prefs = await readEffectiveReadingPlanPrefs();
  const payload = await loadTodayReadingPlanPayload(prefs, { dayCount: prefs.dayCount ?? 365 });
  const readings = payload?.day?.readings ?? [];
  if (!readings.length) return false;
  const queue = buildPlanChapterQueue(readings);
  const first = queue[0];
  if (!first) return false;
  armReadPlanFlowAutoplay();
  pushReadPlanFlowChapter(router, first);
  return true;
}
