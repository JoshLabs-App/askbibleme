import { describe, expect, it, beforeEach } from "vitest";
import {
  armReadPlanFlowTodayLoop,
  clearPlanFlowSessionActive,
  clearReadPlanFlowTodayLoop,
  consumeReadPlanFlowAutoplay,
  markPlanFlowSessionActive,
} from "../read/read-plan-flow-autoplay";
import { shouldPlayForegroundNotificationSound } from "./foregroundNotificationSound";

beforeEach(() => {
  clearPlanFlowSessionActive();
  clearReadPlanFlowTodayLoop();
  consumeReadPlanFlowAutoplay();
});

describe("shouldPlayForegroundNotificationSound", () => {
  it("suppresses sound during active planFlow session", () => {
    markPlanFlowSessionActive();
    armReadPlanFlowTodayLoop();
    expect(shouldPlayForegroundNotificationSound({ kind: "daily-verse" })).toBe(false);
  });

  it("suppresses reading alarm kinds in foreground", () => {
    expect(shouldPlayForegroundNotificationSound({ kind: "reading-reminder" })).toBe(false);
    expect(shouldPlayForegroundNotificationSound({ kind: "reading-alarm-auto-continue" })).toBe(
      false,
    );
  });

  it("allows other kinds when planFlow inactive", () => {
    expect(shouldPlayForegroundNotificationSound({ kind: "daily-verse" })).toBe(true);
  });
});
