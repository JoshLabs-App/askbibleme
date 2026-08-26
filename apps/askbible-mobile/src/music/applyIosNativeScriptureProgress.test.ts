import { afterEach, describe, expect, it, vi } from "vitest";

const { getWant, publishSec, setClock } = vi.hoisted(() => ({
  getWant: vi.fn(() => true),
  publishSec: vi.fn(),
  setClock: vi.fn(),
}));

vi.mock("../audio/shellScriptureWantPlaying", () => ({
  getShellScriptureWantPlaying: () => getWant(),
}));

vi.mock("./scripturePlaybackSec", () => ({
  publishScripturePlaybackSec: (...args: unknown[]) => publishSec(...args),
  setScripturePlaybackClockPlaying: (...args: unknown[]) => setClock(...args),
}));

import { applyIosNativeScriptureProgress } from "./applyIosNativeScriptureProgress";

function sink() {
  return {
    setScriptureCurrentSec: vi.fn(),
    setScriptureDurationSec: vi.fn(),
    scripturePlaybackRateRef: { current: 1.25 },
    playingStateRef: { current: false },
    setPlaying: vi.fn(),
  };
}

afterEach(() => {
  getWant.mockReturnValue(true);
  publishSec.mockReset();
  setClock.mockReset();
});

describe("applyIosNativeScriptureProgress", () => {
  it("writes position and duration then starts the interpolating clock", () => {
    const s = sink();
    applyIosNativeScriptureProgress(
      { playing: true, positionSec: 12.4, durationSec: 180, rate: 1.5, kind: "scripture" },
      s,
    );
    expect(publishSec).toHaveBeenCalledWith(12.4);
    expect(s.setScriptureCurrentSec).toHaveBeenCalledWith(12.4);
    expect(s.setScriptureDurationSec).toHaveBeenCalledWith(180);
    expect(setClock).toHaveBeenCalledWith(true, 1.5);
    expect(s.setPlaying).toHaveBeenCalledWith(true);
  });

  it("keeps duration while paused and does not revive playback", () => {
    getWant.mockReturnValue(false);
    const s = sink();
    applyIosNativeScriptureProgress(
      { playing: true, positionSec: 40, durationSec: 90, kind: "scripture" },
      s,
    );
    expect(s.setScriptureDurationSec).toHaveBeenCalledWith(90);
    expect(setClock).toHaveBeenCalledWith(false, 1.25);
    expect(s.setPlaying).not.toHaveBeenCalled();
  });

  it("ignores verse/ambient progress on the scripture path", () => {
    const s = sink();
    applyIosNativeScriptureProgress({ playing: true, positionSec: 3, durationSec: 10, kind: "verse" }, s);
    expect(s.setScriptureDurationSec).not.toHaveBeenCalled();
    expect(setClock).not.toHaveBeenCalled();
  });
});
