import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../music/scripturePlaybackPriority", () => ({
  markScriptureChapterHandoff: vi.fn(),
  clearScriptureChapterHandoff: vi.fn(),
}));

import {
  clearScriptureChapterHandoff,
  markScriptureChapterHandoff,
} from "../music/scripturePlaybackPriority";
import {
  armReadPlanFlowAutoplay,
  armReadPlanFlowTodayLoop,
  beginPlanFlowChapterAdvance,
  clearPlanFlowSessionActive,
  consumeReadPlanFlowAutoplay,
  endPlanFlowChapterAdvance,
  endPlanFlowChapterAdvanceDeferred,
  getPlanFlowUiHost,
  isPlanFlowChapterAdvanceInFlight,
  markPlanFlowSessionActive,
  peekReadPlanFlowAutoplay,
  resetPlanFlowStateForTests,
  setPlanFlowUiHost,
  shouldHoldPlanFlowChapterUnregister,
} from "./read-plan-flow-autoplay";

/**
 * 读经计划连播这一次会话的状态机。以前是六个散落的模块变量、13 个 setter、
 * 14 个文件在写，一个测试也没有——「什么组合是合法的」只存在于读代码的人脑子里。
 */
describe("read plan flow session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPlanFlowStateForTests();
  });

  it("starts idle", () => {
    expect(isPlanFlowChapterAdvanceInFlight()).toBe(false);
    expect(peekReadPlanFlowAutoplay()).toBe(false);
    expect(getPlanFlowUiHost()).toBe("chapter");
    expect(shouldHoldPlanFlowChapterUnregister()).toBe(false);
  });

  /** 一次性意图：读一次就没了，否则下一章会莫名其妙自己播。 */
  it("consumes the autoplay arm exactly once", () => {
    armReadPlanFlowAutoplay();
    expect(consumeReadPlanFlowAutoplay()).toBe(true);
    expect(consumeReadPlanFlowAutoplay()).toBe(false);
  });

  it("marks the chapter handoff while an advance is in flight", () => {
    beginPlanFlowChapterAdvance();
    expect(isPlanFlowChapterAdvanceInFlight()).toBe(true);
    expect(markScriptureChapterHandoff).toHaveBeenCalledTimes(1);
    endPlanFlowChapterAdvance();
    expect(isPlanFlowChapterAdvanceInFlight()).toBe(false);
  });

  /** 延迟释放的定时器必须能被后来的 endPlanFlowChapterAdvance 取消，否则四秒后
   * 会把一个**新**会话的锁给解开。 */
  it("does not release a later advance when an earlier deferred release was cancelled", () => {
    vi.useFakeTimers();
    beginPlanFlowChapterAdvance();
    endPlanFlowChapterAdvanceDeferred(4000);
    endPlanFlowChapterAdvance();
    beginPlanFlowChapterAdvance();
    vi.advanceTimersByTime(5000);
    expect(isPlanFlowChapterAdvanceInFlight()).toBe(true);
    expect(clearScriptureChapterHandoff).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  /** 三个「还在忙」的理由，任一成立就不许清掉当前章注册。 */
  it("holds the chapter registration for each in-session reason", () => {
    markPlanFlowSessionActive();
    expect(shouldHoldPlanFlowChapterUnregister()).toBe(false);
    armReadPlanFlowAutoplay();
    expect(shouldHoldPlanFlowChapterUnregister()).toBe(true);
    consumeReadPlanFlowAutoplay();
    beginPlanFlowChapterAdvance();
    expect(shouldHoldPlanFlowChapterUnregister()).toBe(true);
    endPlanFlowChapterAdvance();
    armReadPlanFlowTodayLoop();
    expect(shouldHoldPlanFlowChapterUnregister()).toBe(true);
  });

  /** 会话没开始时，其它标志再真也不该拦——否则退出计划后普通读经也解不开。 */
  it("holds nothing once the session ends", () => {
    markPlanFlowSessionActive();
    armReadPlanFlowTodayLoop();
    setPlanFlowUiHost("listen");
    clearPlanFlowSessionActive();
    expect(shouldHoldPlanFlowChapterUnregister()).toBe(false);
    expect(getPlanFlowUiHost()).toBe("chapter");
  });
});
