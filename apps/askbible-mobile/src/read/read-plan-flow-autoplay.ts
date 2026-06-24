import {
  clearScriptureChapterHandoff,
  markScriptureChapterHandoff,
} from "../music/scripturePlaybackPriority";

let armed = false;
let loopTodayPlan = false;
let advanceInFlight = false;

export function beginPlanFlowChapterAdvance(): void {
  advanceInFlight = true;
  markScriptureChapterHandoff();
}

export function endPlanFlowChapterAdvance(): void {
  advanceInFlight = false;
}

/** 导航/注册完成后再释放 advance 锁，避免旧章 cleanup 落在 finally 之后。 */
export function endPlanFlowChapterAdvanceDeferred(delayMs = 400): void {
  setTimeout(() => {
    endPlanFlowChapterAdvance();
    clearScriptureChapterHandoff();
  }, delayMs);
}

export function isPlanFlowChapterAdvanceInFlight(): boolean {
  return advanceInFlight;
}

export function armReadPlanFlowAutoplay(): void {
  armed = true;
}

/** 今日 planFlow 读完后自动从头再读（读经闹钟等场景）。 */
export function armReadPlanFlowTodayLoop(): void {
  loopTodayPlan = true;
}

export function consumeReadPlanFlowAutoplay(): boolean {
  const v = armed;
  armed = false;
  return v;
}

export function peekReadPlanFlowAutoplay(): boolean {
  return armed;
}

export function shouldLoopTodayPlanFlow(): boolean {
  return loopTodayPlan;
}

export function clearReadPlanFlowTodayLoop(): void {
  loopTodayPlan = false;
}
