import { beforeEach, describe, expect, it } from "vitest";
import {
  getScripturePauseHoldReasons,
  holdScriptureUserPause,
  isScriptureUserPauseHeld,
  releaseScriptureUserPause,
  resetScriptureUserPauseForTests,
} from "./scriptureUserPause";

describe("scriptureUserPause reasons", () => {
  beforeEach(() => {
    resetScriptureUserPauseForTests();
  });

  it("stacks reasons and only clears the released one", () => {
    holdScriptureUserPause("alarm-prelude");
    holdScriptureUserPause("sleep-timer");
    expect(isScriptureUserPauseHeld()).toBe(true);
    expect(getScripturePauseHoldReasons().has("alarm-prelude")).toBe(true);

    releaseScriptureUserPause("alarm-prelude");
    expect(isScriptureUserPauseHeld()).toBe(true);
    expect(getScripturePauseHoldReasons().has("alarm-prelude")).toBe(false);
    expect(getScripturePauseHoldReasons().has("sleep-timer")).toBe(true);
  });

  it("release() clears all holds for explicit play", () => {
    holdScriptureUserPause("alarm-prelude");
    holdScriptureUserPause("user");
    releaseScriptureUserPause();
    expect(isScriptureUserPauseHeld()).toBe(false);
  });
});
