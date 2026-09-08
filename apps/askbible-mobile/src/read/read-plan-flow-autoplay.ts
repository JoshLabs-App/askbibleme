import {
  clearScriptureChapterHandoff,
  markScriptureChapterHandoff,
} from "../music/scripturePlaybackPriority";

/** 章页续播 vs 专用「读经计划播放」页。 */
export type PlanFlowUiHost = "chapter" | "listen";

/**
 * 「读经计划连播」这一次会话的全部状态。
 *
 * 原来这是六个散落的模块级变量（`armed` / `loopTodayPlan` / `advanceInFlight` /
 * `planFlowSessionActive` / `planFlowUiHost` / 一个定时器），13 个导出函数各写各的，
 * 14 个文件在调。没人能一眼看出「此刻这个会话处于什么状态」，也没人能说清
 * 某个组合是不是合法的——播放层那六个 bug 就是从这种形状里长出来的。
 *
 * 现在状态收在一个对象里，只经 `update()` 改。函数名和签名一个没变，调用方不用动。
 */
type PlanFlowState = {
  /** 下一次读经起播要自动开始（一次性）。 */
  armed: boolean;
  /** 今日计划读完后从头再来（读经闹钟等场景）。 */
  loopTodayPlan: boolean;
  /** 正在交接下一章：这段时间别让别人清掉当前章的注册。 */
  advanceInFlight: boolean;
  /** 处在一次连播会话里。 */
  sessionActive: boolean;
  uiHost: PlanFlowUiHost;
};

const INITIAL: PlanFlowState = {
  armed: false,
  loopTodayPlan: false,
  advanceInFlight: false,
  sessionActive: false,
  uiHost: "chapter",
};

let state: PlanFlowState = INITIAL;
let advanceReleaseTimer: ReturnType<typeof setTimeout> | null = null;
let onPlanFlowEntry: (() => void) | null = null;

/** 改状态的唯一入口。 */
function update(patch: Partial<PlanFlowState>): void {
  state = { ...state, ...patch };
}

function cancelAdvanceRelease(): void {
  if (!advanceReleaseTimer) return;
  clearTimeout(advanceReleaseTimer);
  advanceReleaseTimer = null;
}

export function registerPlanFlowEntryCallback(fn: (() => void) | null): void {
  onPlanFlowEntry = fn;
}

export function runPlanFlowEntryCallback(): void {
  onPlanFlowEntry?.();
}

export function setPlanFlowUiHost(host: PlanFlowUiHost): void {
  update({ uiHost: host });
}

export function getPlanFlowUiHost(): PlanFlowUiHost {
  return state.uiHost;
}

export function clearPlanFlowUiHost(): void {
  update({ uiHost: "chapter" });
}

export function beginPlanFlowChapterAdvance(): void {
  update({ advanceInFlight: true });
  markScriptureChapterHandoff();
}

export function endPlanFlowChapterAdvance(): void {
  update({ advanceInFlight: false });
  cancelAdvanceRelease();
}

/** 导航/注册完成后再释放 advance 锁，避免旧章 cleanup 落在 finally 之后。 */
export function endPlanFlowChapterAdvanceDeferred(delayMs = 4000): void {
  cancelAdvanceRelease();
  advanceReleaseTimer = setTimeout(() => {
    advanceReleaseTimer = null;
    update({ advanceInFlight: false });
    clearScriptureChapterHandoff();
  }, delayMs);
}

/** 下一章 register + 开播后提前释放 handoff 锁。 */
export function notifyPlanFlowChapterRegistered(): void {
  endPlanFlowChapterAdvance();
  clearScriptureChapterHandoff();
}

export function isPlanFlowChapterAdvanceInFlight(): boolean {
  return state.advanceInFlight;
}

export function markPlanFlowSessionActive(): void {
  update({ sessionActive: true });
}

/** 会话结束：连带把 UI 宿主复位，否则下一次会以为还在「计划播放」页里。 */
export function clearPlanFlowSessionActive(): void {
  update({ sessionActive: false, uiHost: "chapter" });
}

export function isPlanFlowSessionActive(): boolean {
  return state.sessionActive;
}

/** planFlow 会话内勿 register(null) 清空 readChapterRef（含 autoplay 已 consume 的首章播放期，否则章末无法续章）。 */
export function shouldHoldPlanFlowChapterUnregister(): boolean {
  if (!state.sessionActive) return false;
  return state.advanceInFlight || state.armed || state.loopTodayPlan;
}

export function armReadPlanFlowAutoplay(): void {
  update({ armed: true });
}

/** 今日 planFlow 读完后自动从头再读（读经闹钟等场景）。 */
export function armReadPlanFlowTodayLoop(): void {
  update({ loopTodayPlan: true });
}

export function consumeReadPlanFlowAutoplay(): boolean {
  const was = state.armed;
  update({ armed: false });
  return was;
}

export function peekReadPlanFlowAutoplay(): boolean {
  return state.armed;
}

export function shouldLoopTodayPlanFlow(): boolean {
  return state.loopTodayPlan;
}

export function clearReadPlanFlowTodayLoop(): void {
  update({ loopTodayPlan: false });
}

/** 仅供测试：把会话恢复到没开始过的样子。 */
export function resetPlanFlowStateForTests(): void {
  cancelAdvanceRelease();
  state = INITIAL;
}
