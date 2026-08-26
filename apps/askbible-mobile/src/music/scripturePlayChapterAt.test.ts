import { beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const mocks = vi.hoisted(() => ({
  getScripturePlayingChapter: vi.fn(() => null as null | {
    bookId: string;
    chapter: number;
    translationId: string;
  }),
  safeGetSoundStatus: vi.fn(),
  safePlaySound: vi.fn(async () => true),
  resolveScripturePlayableSrcForChapter: vi.fn(async () => "file:///mat-8.mp3"),
  translationSupportsChapterAudio: vi.fn(() => true),
  readCuvChapterAudioVoice: vi.fn(async () => "cuv-simp"),
  configureScriptureShellAudioMode: vi.fn(async () => {}),
  scriptureChapterPoolStop: vi.fn(),
  scriptureChapterPoolIsActive: vi.fn(() => true),
  scriptureChapterPoolGetCurrentTrack: vi.fn(() => ({
    id: "ACT:9",
    bookId: "ACT",
    chapter: 9,
    bookName: "使徒行传",
    title: "使徒行传 9",
    src: "file:///act-9.mp3",
    translationId: "cuv-simp",
  })),
}));

vi.mock("../audio/shellNativeAudioTakeover", () => ({
  isNativeMainTrackOs: () => false,
  setShellNativeAudioTakeover: vi.fn(),
}));

vi.mock("../audio/shellMediaSceneArtwork", () => ({
  getShellMediaSceneArtworkUri: () => null,
}));

vi.mock("../audio/shellScriptureWantPlaying", () => ({
  getShellScriptureWantPlaying: () => false,
  setShellScriptureWantPlaying: vi.fn(),
}));

vi.mock("../read/read-chapter-playback-store", () => ({
  setActiveReadChapterPlayback: vi.fn(),
  setPlayingReadChapterPlayback: vi.fn(),
  clearPlayingReadChapterPlayback: vi.fn(),
  resolveTransportReadChapterPlayback: vi.fn(() => null),
  getPlayingReadChapterPlayback: vi.fn(() => null),
  getBrowseReadChapterPlayback: vi.fn(() => null),
  getActiveReadChapterPlayback: vi.fn(() => null),
}));

vi.mock("./scripturePlayingChapterStore", () => ({
  getScripturePlayingChapter: mocks.getScripturePlayingChapter,
  setScripturePlayingChapter: vi.fn(),
  clearScripturePlayingChapter: vi.fn(),
}));

vi.mock("./scripture-chapter-pool", () => ({
  scriptureChapterPool: {
    isActive: mocks.scriptureChapterPoolIsActive,
    getCurrentTrack: mocks.scriptureChapterPoolGetCurrentTrack,
    stop: mocks.scriptureChapterPoolStop,
  },
}));

vi.mock("../audio/safeShellSound", () => ({
  safeGetSoundStatus: mocks.safeGetSoundStatus,
  safePlaySound: mocks.safePlaySound,
  safePauseSound: vi.fn(async () => {}),
  logShellSoundError: vi.fn(),
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

vi.mock("../read/read-plan-flow-autoplay", () => ({
  armReadPlanFlowAutoplay: vi.fn(),
  consumeReadPlanFlowAutoplay: vi.fn(() => false),
}));

vi.mock("../audio/shellMediaControls", () => ({
  clearShellMediaSessionUserDismissed: vi.fn(),
  resumeShellAppMusic: vi.fn(),
  syncShellMediaSessionExplicit: vi.fn(),
  pauseShellAppMusic: vi.fn(),
}));

vi.mock("../widget/widgetPlaybackRequest", () => ({
  requestWidgetVerseStop: vi.fn(),
}));
vi.mock("./scriptureResumeAfterInterruption", () => ({
  markScriptureWantPlaying: vi.fn((ref: { current: boolean }, want: boolean) => {
    ref.current = want;
  }),
}));

vi.mock("./scripturePlaybackHelpers", async () => {
  const actual = (await vi.importActual("./scripturePlaybackHelpers")) as Record<string, unknown>;
  return { ...actual, applyScriptureSegmentBounds: vi.fn() };
});

vi.mock("./scripturePlaybackSec", () => ({
  publishScripturePlaybackSec: vi.fn(),
}));

vi.mock("./scriptureReadChapterRegistration", () => ({
  buildReadChapterAdvanceHandlers: vi.fn(() => ({
    onAdvancePreviousChapter: vi.fn(),
    onAdvanceNextChapter: vi.fn(),
    onAdvanceNextInBook: vi.fn(),
  })),
}));

import { playScriptureChapterAt } from "./scripturePlayChapterAt";
import { releaseScriptureUserPause } from "./scriptureUserPause";

describe("playScriptureChapterAt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    releaseScriptureUserPause();
    mocks.scriptureChapterPoolIsActive.mockReturnValue(true);
    mocks.getScripturePlayingChapter.mockReturnValue({
      bookId: "ACT",
      chapter: 9,
      translationId: "cuv-simp",
    });
    mocks.safeGetSoundStatus.mockResolvedValue({ isLoaded: true, isPlaying: false });
  });

  it("loads the browsed chapter instead of resuming plan audio when chapters differ", async () => {
    const sound = { id: "plan" };
    const tryPlayScriptureWithFallback = vi.fn(async () => true);
    const ctx = {
      soundRef: { current: sound },
      scripturePlayInFlightRef: { current: null },
      readChapterRef: {
        current: {
          bookId: "MAT",
          chapter: 8,
          bookName: "马太福音",
          translationId: "cuv-simp",
          chapterAudioSrc: "file:///mat-8.mp3",
          onAdvanceNextChapter: vi.fn(),
          onAdvanceNextInBook: vi.fn(),
        },
      },
      scriptureWantPlayingRef: { current: false },
      autoPlayScriptureRef: { current: false },
      scriptureStopAtSecRef: { current: null },
      scriptureStopAtOnEndedRef: { current: null },
      lastScriptureProgressSecRef: { current: 0 },
      playbackModeRef: { current: "scripture" as const },
      setScripturePreparing: vi.fn(),
      setReadChapter: vi.fn(),
      setPlaying: vi.fn(),
      setScriptureCurrentSec: vi.fn(),
      patchReadChapterSrc: vi.fn(),
      tryPlayScriptureWithFallback,
      isStarted: vi.fn(() => true),
    };

    const ok = await playScriptureChapterAt(
      ctx as never,
      {
        bookId: "MAT",
        chapter: 8,
        bookName: "马太福音",
        translationId: "cuv-simp",
      },
      undefined,
      vi.fn(async () => true),
    );

    expect(ok).toBe(true);
    expect(mocks.safePlaySound).not.toHaveBeenCalled();
    expect(mocks.scriptureChapterPoolStop).toHaveBeenCalled();
    expect(tryPlayScriptureWithFallback).toHaveBeenCalled();
  });

  it("clears the previous chapter position so a new chapter starts from the beginning", async () => {
    const lastScriptureProgressSecRef = { current: 128 };
    const ctx = {
      soundRef: { current: null },
      scripturePlayInFlightRef: { current: null },
      readChapterRef: { current: null },
      scriptureWantPlayingRef: { current: false },
      autoPlayScriptureRef: { current: false },
      scriptureStopAtSecRef: { current: null },
      scriptureStopAtOnEndedRef: { current: null },
      lastScriptureProgressSecRef,
      playbackModeRef: { current: "scripture" as const },
      setScripturePreparing: vi.fn(),
      setReadChapter: vi.fn(),
      setPlaying: vi.fn(),
      setScriptureCurrentSec: vi.fn(),
      patchReadChapterSrc: vi.fn(),
      tryPlayScriptureWithFallback: vi.fn(async () => true),
      isStarted: vi.fn(() => true),
    };

    await playScriptureChapterAt(
      ctx as never,
      {
        bookId: "MAT",
        chapter: 8,
        bookName: "马太福音",
        translationId: "cuv-simp",
      },
      undefined,
      vi.fn(async () => true),
    );

    expect(lastScriptureProgressSecRef.current).toBe(-1);
    expect(ctx.setScriptureCurrentSec).toHaveBeenCalledWith(0);
  });

  it("keeps an explicit resume position when replaying a chapter", async () => {
    const lastScriptureProgressSecRef = { current: -1 };
    const ctx = {
      soundRef: { current: null },
      scripturePlayInFlightRef: { current: null },
      readChapterRef: { current: null },
      scriptureWantPlayingRef: { current: false },
      autoPlayScriptureRef: { current: false },
      scriptureStopAtSecRef: { current: null },
      scriptureStopAtOnEndedRef: { current: null },
      lastScriptureProgressSecRef,
      playbackModeRef: { current: "scripture" as const },
      setScripturePreparing: vi.fn(),
      setReadChapter: vi.fn(),
      setPlaying: vi.fn(),
      setScriptureCurrentSec: vi.fn(),
      patchReadChapterSrc: vi.fn(),
      tryPlayScriptureWithFallback: vi.fn(async () => true),
      isStarted: vi.fn(() => true),
    };

    await playScriptureChapterAt(
      ctx as never,
      {
        bookId: "MAT",
        chapter: 8,
        bookName: "马太福音",
        translationId: "cuv-simp",
      },
      { startAtSec: 93.5 },
      vi.fn(async () => true),
    );

    expect(lastScriptureProgressSecRef.current).toBe(93.5);
  });

  it("does not stop the plan pool when the target chapter has no playable src", async () => {
    mocks.resolveScripturePlayableSrcForChapter.mockResolvedValueOnce(null);
    const setReadChapter = vi.fn();
    const ctx = {
      soundRef: { current: null },
      scripturePlayInFlightRef: { current: null },
      readChapterRef: { current: null },
      scriptureWantPlayingRef: { current: false },
      autoPlayScriptureRef: { current: false },
      scriptureStopAtSecRef: { current: null },
      scriptureStopAtOnEndedRef: { current: null },
      lastScriptureProgressSecRef: { current: 0 },
      playbackModeRef: { current: "scripture" as const },
      setScripturePreparing: vi.fn(),
      setReadChapter,
      setPlaying: vi.fn(),
      setScriptureCurrentSec: vi.fn(),
      patchReadChapterSrc: vi.fn(),
      tryPlayScriptureWithFallback: vi.fn(async () => true),
      isStarted: vi.fn(() => false),
    };

    const ok = await playScriptureChapterAt(
      ctx as never,
      {
        bookId: "MAT",
        chapter: 8,
        bookName: "马太福音",
        translationId: "cuv-simp",
      },
      undefined,
      vi.fn(async () => true),
    );

    expect(ok).toBe(false);
    expect(mocks.scriptureChapterPoolStop).not.toHaveBeenCalled();
    expect(setReadChapter).not.toHaveBeenCalled();
  });

  it("keeps plan pool when replaying the same plan chapter", async () => {
    mocks.resolveScripturePlayableSrcForChapter.mockResolvedValue("file:///act-9.mp3");
    const tryPlayScriptureWithFallback = vi.fn(async () => true);
    const ctx = {
      soundRef: { current: null },
      scripturePlayInFlightRef: { current: null },
      readChapterRef: { current: null },
      scriptureWantPlayingRef: { current: false },
      autoPlayScriptureRef: { current: false },
      scriptureStopAtSecRef: { current: null },
      scriptureStopAtOnEndedRef: { current: null },
      lastScriptureProgressSecRef: { current: 0 },
      playbackModeRef: { current: "scripture" as const },
      setScripturePreparing: vi.fn(),
      setReadChapter: vi.fn(),
      setPlaying: vi.fn(),
      setScriptureCurrentSec: vi.fn(),
      patchReadChapterSrc: vi.fn(),
      tryPlayScriptureWithFallback,
      isStarted: vi.fn(() => true),
    };

    const ok = await playScriptureChapterAt(
      ctx as never,
      {
        bookId: "ACT",
        chapter: 9,
        bookName: "使徒行传",
        translationId: "cuv-simp",
      },
      undefined,
      vi.fn(async () => true),
    );

    expect(ok).toBe(true);
    expect(mocks.scriptureChapterPoolStop).not.toHaveBeenCalled();
    expect(tryPlayScriptureWithFallback).toHaveBeenCalled();
  });
});
