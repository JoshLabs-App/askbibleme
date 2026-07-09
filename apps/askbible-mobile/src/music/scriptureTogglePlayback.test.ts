import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  configureScriptureShellAudioMode: vi.fn(async () => {}),
  readCuvChapterAudioVoice: vi.fn(async () => "cuv-simp"),
  resolveScripturePlayableSrcForChapter: vi.fn(async () => "file:///gen-1.mp3"),
  translationSupportsChapterAudio: vi.fn(() => true),
  safeGetSoundStatus: vi.fn(),
  safePauseSound: vi.fn(async () => {}),
  safePlaySound: vi.fn(async () => true),
  flushTodayPlanScriptureResume: vi.fn(async () => {}),
  getActiveReadChapterPlayback: vi.fn(() => null),
  markScriptureWantPlaying: vi.fn(),
  scriptureAudioUrlsEqual: vi.fn(() => true),
}));

vi.mock("../audio/shellAudioMode", () => ({
  configureScriptureShellAudioMode: mocks.configureScriptureShellAudioMode,
}));

vi.mock("../bible/cuv-chapter-audio-voice-prefs", () => ({
  readCuvChapterAudioVoice: mocks.readCuvChapterAudioVoice,
}));

vi.mock("../bible/read-chapter-audio", () => ({
  resolveScripturePlayableSrcForChapter: mocks.resolveScripturePlayableSrcForChapter,
  translationSupportsChapterAudio: mocks.translationSupportsChapterAudio,
}));

vi.mock("../audio/safeShellSound", () => ({
  safeGetSoundStatus: mocks.safeGetSoundStatus,
  safePauseSound: mocks.safePauseSound,
  safePlaySound: mocks.safePlaySound,
  logShellSoundError: vi.fn(),
}));

vi.mock("../read/flushTodayPlanScriptureResume", () => ({
  flushTodayPlanScriptureResume: mocks.flushTodayPlanScriptureResume,
}));

vi.mock("../read/read-chapter-playback-store", () => ({
  getActiveReadChapterPlayback: mocks.getActiveReadChapterPlayback,
}));

vi.mock("./scriptureResumeAfterInterruption", () => ({
  markScriptureWantPlaying: (ref: { current: boolean }, want: boolean) => {
    mocks.markScriptureWantPlaying(ref, want);
    ref.current = want;
  },
}));

vi.mock("../bible/cuv-chapter-audio", () => ({
  scriptureAudioUrlsEqual: mocks.scriptureAudioUrlsEqual,
}));

import {
  pauseScriptureShellPlayback,
  toggleScripturePlayback,
} from "./scriptureTogglePlayback";

describe("toggleScripturePlayback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("force-pauses scripture without unloading the sound", async () => {
    const ctx = {
      soundRef: { current: null as never },
      activeSoundIdRef: { current: 0 },
      playbackEpochRef: { current: 0 },
      playbackModeRef: { current: "scripture" as const },
      unloadCurrent: vi.fn(async () => {}),
      endMusicSession: vi.fn(),
      readChapter: {
        bookId: "GEN",
        chapter: 1,
        bookName: "创世记",
        translationId: "cuv-simp",
        chapterAudioSrc: "file:///gen-1.mp3",
        onAdvanceNextChapter: vi.fn(),
        onAdvanceNextInBook: vi.fn(),
      },
      readChapterRef: { current: null },
      scripturePlayInFlightRef: { current: null },
      scriptureSrcRef: { current: "file:///old.mp3" },
      scriptureStopAtSecRef: { current: null },
      scriptureStopAtOnEndedRef: { current: null },
      autoPlayScriptureRef: { current: true },
      scriptureWantPlayingRef: { current: true },
      scriptureChapterHandoffRef: { current: false },
      lastScriptureProgressSecRef: { current: 0 },
      setReadChapter: vi.fn(),
      setPlaying: vi.fn(),
      patchReadChapterSrc: vi.fn(),
      tryPlayScriptureWithFallback: vi.fn(),
      playScripture: vi.fn(),
      isStarted: vi.fn(() => true),
      stopScripturePlayback: vi.fn(async () => {}),
      setScriptureCurrentSec: vi.fn(),
    };

    await toggleScripturePlayback(ctx as never, { forcePause: true });

    expect(ctx.unloadCurrent).not.toHaveBeenCalled();
    expect(ctx.stopScripturePlayback).not.toHaveBeenCalled();
    expect(ctx.setPlaying).toHaveBeenCalledWith(false);
  });

  it("pauseScriptureShellPlayback clears replay intent when sound is missing", async () => {
    const ctx = {
      soundRef: { current: null as never },
      autoPlayScriptureRef: { current: true },
      scriptureWantPlayingRef: { current: true },
      setPlaying: vi.fn(),
    };

    await pauseScriptureShellPlayback(ctx as never);

    expect(ctx.scriptureWantPlayingRef.current).toBe(false);
    expect(ctx.autoPlayScriptureRef.current).toBe(false);
    expect(ctx.setPlaying).toHaveBeenCalledWith(false);
  });
});
