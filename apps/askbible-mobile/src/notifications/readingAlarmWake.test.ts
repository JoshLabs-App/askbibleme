import { describe, expect, it } from "vitest";
import { resolveReadingAlarmWakeKind } from "./readingAlarmWake";

describe("resolveReadingAlarmWakeKind", () => {
  it("prefers scripture handoff when a trigger is pending", () => {
    expect(
      resolveReadingAlarmWakeKind({
        pendingTrigger: true,
        preludeActive: true,
        dueStarted: true,
      }),
    ).toBe("handoff");
  });

  it("joins the native prelude when music is already playing", () => {
    expect(
      resolveReadingAlarmWakeKind({
        pendingTrigger: false,
        preludeActive: true,
        dueStarted: false,
      }),
    ).toBe("prelude-sync");
  });

  it("starts a due alarm when nothing is already running", () => {
    expect(
      resolveReadingAlarmWakeKind({
        pendingTrigger: false,
        preludeActive: false,
        dueStarted: true,
      }),
    ).toBe("started");
  });

  it("stays idle when nothing is due", () => {
    expect(
      resolveReadingAlarmWakeKind({
        pendingTrigger: false,
        preludeActive: false,
        dueStarted: false,
      }),
    ).toBe("none");
  });
});
