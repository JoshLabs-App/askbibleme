import { beforeEach, describe, expect, it, vi } from "vitest";

const interruption = vi.hoisted(() => ({
  getShellAudioInterrupted: vi.fn(() => false),
}));

vi.mock("../audio/shellAudioInterruption", () => interruption);

vi.mock("../audio/shellAudioMode", () => ({
  configureShellAudioMode: vi.fn(async () => {}),
}));

vi.mock("../audio/safeShellSound", () => ({
  safeGetSoundStatus: vi.fn(),
  safePlaySound: vi.fn(async () => true),
}));

vi.mock("../audio/shellMediaControls", () => ({
  clearShellMediaSessionUserDismissed: vi.fn(),
}));

vi.mock("../audio/shellMusicWantPlaying", () => ({
  getShellMusicWantPlaying: vi.fn(() => true),
  setShellMusicWantPlaying: vi.fn(),
}));

vi.mock("../audio/shellNativeAudioTakeover", () => ({
  isShellNativeAudioTakeover: vi.fn(() => false),
}));

import { recoverMusicPlaybackAfterBackground } from "./musicResumeAfterInterruption";

describe("recoverMusicPlaybackAfterBackground", () => {
  beforeEach(() => {
    interruption.getShellAudioInterrupted.mockReturnValue(false);
  });

  it("does not resume while a phone call interruption is active", async () => {
    interruption.getShellAudioInterrupted.mockReturnValue(true);
    const playAsync = vi.fn();
    const ok = await recoverMusicPlaybackAfterBackground({
      playbackModeRef: { current: "music" },
      soundRef: { current: { playAsync } as never },
      playingStateRef: { current: false },
      musicGainRef: { current: 1 },
      setPlaying: vi.fn(),
    });
    expect(ok).toBe(false);
    expect(playAsync).not.toHaveBeenCalled();
  });
});
