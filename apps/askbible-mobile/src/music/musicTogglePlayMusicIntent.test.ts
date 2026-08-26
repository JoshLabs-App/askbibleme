import { describe, expect, it } from "vitest";
import {
  canResumeExistingMusicSound,
  isMusicTogglePauseIntent,
} from "./musicTogglePlayMusicIntent";

describe("isMusicTogglePauseIntent", () => {
  it("ignores scripture playing when deciding music pause", () => {
    expect(
      isMusicTogglePauseIntent({
        playbackMode: "scripture",
        musicWantPlaying: false,
        musicNativePlaying: false,
        playing: true,
        playingState: true,
      }),
    ).toBe(false);
  });

  it("pauses only in music mode", () => {
    expect(
      isMusicTogglePauseIntent({
        playbackMode: "music",
        musicWantPlaying: false,
        musicNativePlaying: false,
        playing: true,
        playingState: false,
      }),
    ).toBe(true);
  });
});

describe("canResumeExistingMusicSound", () => {
  it("does not resume the shared sound after leaving scripture", () => {
    expect(
      canResumeExistingMusicSound({ leavingScripture: true, sameLoadedTrack: true }),
    ).toBe(false);
  });

  it("resumes the same loaded music track", () => {
    expect(
      canResumeExistingMusicSound({ leavingScripture: false, sameLoadedTrack: true }),
    ).toBe(true);
  });
});
