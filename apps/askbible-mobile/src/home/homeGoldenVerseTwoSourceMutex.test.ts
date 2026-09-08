import { beforeEach, describe, expect, it, vi } from "vitest";

/** 三条流的状态现在由原生推来；测试直接喂快照，不再 mock 一堆影子 store。 */
const flags = vi.hoisted(() => ({
  musicPlaying: false,
  versePlaying: false,
  scripturePlaying: false,
  ambientSlot: "" as string,
}));

vi.mock("../audio/playbackState", () => ({
  getPlaybackSnapshot: () => ({
    music: { playing: flags.musicPlaying, wantPlaying: flags.musicPlaying },
    verse: { playing: flags.versePlaying, wantPlaying: flags.versePlaying },
    scripture: { playing: flags.scripturePlaying, wantPlaying: flags.scripturePlaying },
  }),
}));
vi.mock("../nature/natureAmbientExclusiveStop", () => ({
  getNatureAmbientSlotId: () => flags.ambientSlot,
  clearNatureAmbientSlot: vi.fn(),
}));

import {
  setHomeGoldenVerseSessionActive,
  shouldYieldMusicWhenOpeningAmbient,
} from "./homeGoldenVerseTwoSourceMutex";

describe("shouldYieldMusicWhenOpeningAmbient", () => {
  beforeEach(() => {
    flags.musicPlaying = false;
    flags.versePlaying = false;
    flags.scripturePlaying = false;
    flags.ambientSlot = "";
    setHomeGoldenVerseSessionActive(false);
  });

  it("stops music when golden verse and music are both on", () => {
    setHomeGoldenVerseSessionActive(true);
    flags.musicPlaying = true;
    expect(shouldYieldMusicWhenOpeningAmbient()).toBe(true);
  });

  it("stops music when scripture and music are both on", () => {
    flags.scripturePlaying = true;
    flags.musicPlaying = true;
    expect(shouldYieldMusicWhenOpeningAmbient()).toBe(true);
  });

  it("leaves music alone when only music is on", () => {
    flags.musicPlaying = true;
    expect(shouldYieldMusicWhenOpeningAmbient()).toBe(false);
  });

  it("leaves music alone when only voice is on", () => {
    flags.versePlaying = true;
    expect(shouldYieldMusicWhenOpeningAmbient()).toBe(false);
  });
});
