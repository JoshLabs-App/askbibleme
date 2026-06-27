import { describe, expect, it, beforeEach } from "vitest";
import {
  armReadPlanFlowAutoplay,
  armReadPlanFlowTodayLoop,
  clearPlanFlowSessionActive,
  clearReadPlanFlowTodayLoop,
  consumeReadPlanFlowAutoplay,
  markPlanFlowSessionActive,
  shouldHoldPlanFlowChapterUnregister,
} from "./read-plan-flow-autoplay";

beforeEach(() => {
  clearPlanFlowSessionActive();
  clearReadPlanFlowTodayLoop();
  consumeReadPlanFlowAutoplay();
});

describe("shouldHoldPlanFlowChapterUnregister", () => {
  it("holds after autoplay consumed when today loop is armed (alarm / FAB)", () => {
    markPlanFlowSessionActive();
    armReadPlanFlowTodayLoop();
    armReadPlanFlowAutoplay();
    consumeReadPlanFlowAutoplay();
    expect(shouldHoldPlanFlowChapterUnregister()).toBe(true);
  });

  it("does not hold when session inactive", () => {
    armReadPlanFlowTodayLoop();
    expect(shouldHoldPlanFlowChapterUnregister()).toBe(false);
  });
});
