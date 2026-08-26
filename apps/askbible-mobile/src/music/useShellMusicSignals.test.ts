import { describe, expect, it } from "vitest";
import { isShellMusicOn } from "./useShellMusicSignals";

describe("isShellMusicOn", () => {
  const off = { wantPlaying: false, nativePlaying: false };

  it("is false when playbackMode is scripture even if JS playing is true", () => {
    expect(isShellMusicOn(off, true, "scripture")).toBe(false);
    expect(isShellMusicOn({ wantPlaying: true, nativePlaying: true }, true, "scripture")).toBe(
      false,
    );
  });

  it("stays true for music mode when any signal is on", () => {
    expect(isShellMusicOn({ wantPlaying: true, nativePlaying: false }, false, "music")).toBe(true);
    expect(isShellMusicOn({ wantPlaying: false, nativePlaying: true }, false, "music")).toBe(true);
    expect(isShellMusicOn(off, true, "music")).toBe(true);
  });

  it("without playbackMode keeps legacy three-way OR", () => {
    expect(isShellMusicOn(off, true)).toBe(true);
    expect(isShellMusicOn(off, false)).toBe(false);
  });
});
