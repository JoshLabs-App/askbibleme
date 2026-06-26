import {
  clearScriptureChapterHandoff,
  markScriptureChapterHandoff,
} from "../music/scripturePlaybackPriority";

let onPlanFlowEntry: (() => void) | null = null;

export type PlanFlowChapterFrom = { bookId: string; chapter: number };

type PlanFlowChapterAdvanceHandler = (from: PlanFlowChapterFrom) => Promise<void>;

let onPlanFlowChapterAdvance: PlanFlowChapterAdvanceHandler | null = null;

export function registerPlanFlowChapterAdvanceHandler(
  fn: PlanFlowChapterAdvanceHandler | null,
): void {
  onPlanFlowChapterAdvance = fn;
}

export async function runPlanFlowChapterAdvanceFrom(from: PlanFlowChapterFrom): Promise<void> {
  if (!onPlanFlowChapterAdvance) {
    if (__DEV__) {
      console.warn("[planFlow-advance] handler not registered", from.bookId, from.chapter);
    }
    return;
  }
  await onPlanFlowChapterAdvance(from);
}

export function registerPlanFlowEntryCallback(fn: (() => void) | null): void {
  onPlanFlowEntry = fn;
}

export function runPlanFlowEntryCallback(): void {
  onPlanFlowEntry?.();
}

let armed = false;
let loopTodayPlan = false;
let advanceInFlight = false;
let planFlowSessionActive = false;
let advanceReleaseTimer: ReturnType<typeof setTimeout> | null = null;

export function beginPlanFlowChapterAdvance(): void {
  advanceInFlight = true;
  markScriptureChapterHandoff();
}

export function endPlanFlowChapterAdvance(): void {
  advanceInFlight = false;
  if (advanceReleaseTimer) {
    clearTimeout(advanceReleaseTimer);
    advanceReleaseTimer = null;
  }
}

/** 导航/注册完成后再释放 advance 锁，避免旧章 cleanup 落在 finally 之后。 */
export function endPlanFlowChapterAdvanceDeferred(delayMs = 4000): void {
  if (advanceReleaseTimer) {
    clearTimeout(advanceReleaseTimer);
  }
  advanceReleaseTimer = setTimeout(() => {
    advanceReleaseTimer = null;
    endPlanFlowChapterAdvance();
    clearScriptureChapterHandoff();
  }, delayMs);
}

/** 下一章 register + 开播后提前释放 handoff 锁。 */
export function notifyPlanFlowChapterRegistered(): void {
  endPlanFlowChapterAdvance();
  clearScriptureChapterHandoff();
}

export function isPlanFlowChapterAdvanceInFlight(): boolean {
  return advanceInFlight;
}

export function markPlanFlowSessionActive(): void {
  planFlowSessionActive = true;
}

export function clearPlanFlowSessionActive(): void {
  planFlowSessionActive = false;
}

export function isPlanFlowSessionActive(): boolean {
  return planFlowSessionActive;
}

/** planFlow 会话内勿 register(null) 清空 readChapterRef（含 autoplay 已 consume 的首章播放期，否则章末无法续章）。 */
export function shouldHoldPlanFlowChapterUnregister(): boolean {
  if (!planFlowSessionActive) return false;
  if (advanceInFlight || armed) return true;
  return loopTodayPlan;
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
