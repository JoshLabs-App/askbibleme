import { describe, expect, it } from "vitest";
import {
  canResumeExistingMusicSound,
  isMusicTogglePauseIntent,
} from "./musicTogglePlayMusicIntent";

describe("isMusicTogglePauseIntent", () => {
  /**
   * 音乐在响 → 这一下是暂停。
   * 判断只看音乐这一条流；金句叠在背景上时不该影响音乐键
   * （2026-09-08 真机复现：金句在播时点音乐没有起播，因为共用的 playing 为真被判成暂停）。
   */
  it("pauses only when music itself is audible", () => {
    expect(isMusicTogglePauseIntent({ musicPlaying: true })).toBe(true);
    expect(isMusicTogglePauseIntent({ musicPlaying: false })).toBe(false);
  });
});

describe("canResumeExistingMusicSound", () => {
  it("refuses to resume when the loaded track is still the scripture chapter", () => {
    expect(canResumeExistingMusicSound({ leavingScripture: true, sameLoadedTrack: true })).toBe(
      false,
    );
    expect(canResumeExistingMusicSound({ leavingScripture: false, sameLoadedTrack: true })).toBe(
      true,
    );
    expect(canResumeExistingMusicSound({ leavingScripture: false, sameLoadedTrack: false })).toBe(
      false,
    );
  });
});
