import { beforeEach, describe, expect, it, vi } from "vitest";

const flags = vi.hoisted(() => ({
  musicWant: false,
  musicNative: false,
  verseWant: false,
  scriptureWant: false,
  ambientSlot: "" as string,
}));

vi.mock("../audio/shellMusicWantPlaying", () => ({
  getShellMusicWantPlaying: () => flags.musicWant,
}));
vi.mock("../audio/shellMusicNativePlaying", () => ({
  getShellMusicNativePlaying: () => flags.musicNative,
}));
vi.mock("../audio/shellVerseWantPlaying", () => ({
  getShellVerseWantPlaying: () => flags.verseWant,
}));
vi.mock("../audio/shellScriptureWantPlaying", () => ({
  getShellScriptureWantPlaying: () => flags.scriptureWant,
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
    flags.musicWant = false;
    flags.musicNative = false;
    flags.verseWant = false;
    flags.scriptureWant = false;
    flags.ambientSlot = "";
    setHomeGoldenVerseSessionActive(false);
  });

  it("stops music when golden verse and music are both on", () => {
    setHomeGoldenVerseSessionActive(true);
    flags.musicWant = true;
    expect(shouldYieldMusicWhenOpeningAmbient()).toBe(true);
  });

  it("stops music when scripture and music are both on", () => {
    flags.scriptureWant = true;
    flags.musicNative = true;
    expect(shouldYieldMusicWhenOpeningAmbient()).toBe(true);
  });

  it("leaves music alone when only music is on", () => {
    flags.musicWant = true;
    expect(shouldYieldMusicWhenOpeningAmbient()).toBe(false);
  });

  it("leaves music alone when only voice is on", () => {
    flags.verseWant = true;
    expect(shouldYieldMusicWhenOpeningAmbient()).toBe(false);
  });
});
