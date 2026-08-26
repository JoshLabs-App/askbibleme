import type { Router } from "expo-router";
import { replaceReadPlanPlay, type PlanChapterRef } from "../read/read-plan-flow-nav";
import { scriptureCommandClearPauseHolds } from "../music/scriptureCommands";
import {
  startTodayPlanFlowScripture,
  startTodayReadingScriptureFromReadHome,
} from "../read/startTodayReadingScriptureFromReadHome";

const ALARM_LISTEN_OPTS = {
  loopTodayPlan: true,
  replace: true,
  uiHost: "listen" as const,
};

/** 闹钟到期：进入今日读经播放页并开播，不进圣经章页。 */
export async function startTodayReadingAlarmScriptureFlow(
  router: Pick<Router, "push" | "replace">,
  firstChapter?: PlanChapterRef | null,
): Promise<boolean> {
  // 预备 quietShell 可能 hold 了暂停；开播前释放。
  scriptureCommandClearPauseHolds();
  replaceReadPlanPlay(router);
  if (firstChapter) {
    const started = await startTodayPlanFlowScripture(router, firstChapter, ALARM_LISTEN_OPTS);
    if (started) return true;
  }
  return startTodayReadingScriptureFromReadHome(router, ALARM_LISTEN_OPTS);
}
