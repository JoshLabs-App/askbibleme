import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChapterPlaybackCtx } from "./scriptureChapterPlaybackTypes";

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const mocks = vi.hoisted(() => ({
  configureScriptureShellAudioMode: vi.fn(async () => {}),
  readCuvChapterAudioVoice: vi.fn(async () => "cuv-simp"),
  resolveScripturePlayableSrcForChapter: vi.fn(async () => "file:///mat-8.mp3"),
  translationSupportsChapterAudio: vi.fn(() => true),
  safeGetSoundStatus: vi.fn(),
  safePauseSound: vi.fn(async () => {}),
  safePlaySound: vi.fn(async () => true),
  flushTodayPlanScriptureResume: vi.fn(async () => {}),
  getActiveReadChapterPlayback: vi.fn(() => null as null | Record<string, unknown>),
  getScripturePlayingChapter: vi.fn(
    () => null as null | { bookId: string; chapter: number; translationId: string },
  ),
  scriptureChapterPoolStop: vi.fn(),
  scriptureChapterPoolIsActive: vi.fn(() => false),
  scriptureChapterPoolGetCurrentTrack: vi.fn(() => null as null | Record<string, unknown>),
  getPlanFlowUiHost: vi.fn(() => "chapter"),
  markScriptureWantPlaying: vi.fn(),
  scriptureAudioUrlsEqual: vi.fn(() => false),
  logShellSoundError: vi.fn(),
  syncShellMediaSessionExplicit: vi.fn(),
}));

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
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
  logShellSoundError: mocks.logShellSoundError,
}));

vi.mock("../read/flushTodayPlanScriptureResume", () => ({
  flushTodayPlanScriptureResume: mocks.flushTodayPlanScriptureResume,
}));

vi.mock("../read/read-chapter-playback-store", () => ({
  getActiveReadChapterPlayback: mocks.getActiveReadChapterPlayback,
}));

vi.mock("../read/read-plan-flow-autoplay", () => ({
  consumeReadPlanFlowAutoplay: vi.fn(() => false),
  getPlanFlowUiHost: mocks.getPlanFlowUiHost,
}));

vi.mock("../widget/widgetPlaybackRequest", () => ({
  requestWidgetVerseStop: vi.fn(),
}));

vi.mock("./scripturePlayingChapterStore", () => ({
  getScripturePlayingChapter: mocks.getScripturePlayingChapter,
}));

vi.mock("./scripture-chapter-pool", () => ({
  scriptureChapterPool: {
    isActive: mocks.scriptureChapterPoolIsActive,
    getCurrentTrack: mocks.scriptureChapterPoolGetCurrentTrack,
    stop: mocks.scriptureChapterPoolStop,
    abortPendingPlay: vi.fn(),
  },
}));

vi.mock("./scriptureResumeAfterInterruption", () => ({
  markScriptureWantPlaying: (ref: { current: boolean }, want: boolean) => {
    mocks.markScriptureWantPlaying(ref, want);
    ref.current = want;
  },
  clearScriptureResumeTimer: vi.fn(),
}));

vi.mock("../audio/shellMediaControls", () => ({
  clearShellMediaSessionUserDismissed: vi.fn(),
  pauseShellAppMusic: vi.fn(),
  resumeShellAppMusic: vi.fn(),
  syncShellMediaSessionExplicit: mocks.syncShellMediaSessionExplicit,
}));

vi.mock("../audio/shellMediaSceneArtwork", () => ({
  getShellMediaSceneArtworkUri: () => null,
}));

vi.mock("./scripturePlaybackSec", () => ({
  getScripturePlaybackSecNow: () => 0,
  setScripturePlaybackClockPlaying: vi.fn(),
  publishScripturePlaybackSec: vi.fn(),
}));

vi.mock("../audio/shellNativeAudioTakeover", () => ({
  setShellNativeAudioTakeover: vi.fn(),
  isNativeMainTrackOs: () => true,
}));

vi.mock("../audio/shellScriptureWantPlaying", () => ({
  getShellScriptureWantPlaying: () => false,
  setShellScriptureWantPlaying: vi.fn(),
}));

vi.mock("../bible/cuv-chapter-audio", () => ({
  scriptureAudioUrlsEqual: mocks.scriptureAudioUrlsEqual,
}));

import {
  pauseScriptureShellPlayback,
  toggleScripturePlayback,
} from "./scriptureTogglePlayback";
import { releaseScriptureUserPause } from "./scriptureUserPause";
import { applyNativePlaybackState } from "../audio/playbackState";

describe("toggleScripturePlayback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPlanFlowUiHost.mockReturnValue("chapter");
    releaseScriptureUserPause();
    /** 主轨是谁由原生状态回答：读经流上有音轨就是读经模式。 */
    applyNativePlaybackState({ scripture: { uri: "file:///mat-8.mp3", playing: true } });
  });

  it("force-pauses scripture without unloading the sound", async () => {
    const ctx = {
      soundRef: { current: null },
      activeSoundIdRef: { current: 0 },
      playbackEpochRef: { current: 0 },
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
      setScripturePreparing: vi.fn(),
      patchReadChapterSrc: vi.fn(),
      tryPlayScriptureWithFallback: vi.fn(),
      playScripture: vi.fn(),
      isStarted: vi.fn(() => true),
      stopScripturePlayback: vi.fn(async () => {}),
      setScriptureCurrentSec: vi.fn(),
    };

    await toggleScripturePlayback(ctx as unknown as ChapterPlaybackCtx, { forcePause: true });

    expect(ctx.unloadCurrent).not.toHaveBeenCalled();
    expect(ctx.stopScripturePlayback).not.toHaveBeenCalled();
    /** 暂停意图要送到原生；界面由原生回报的状态驱动，不再靠 JS 自己置 playing。 */
    expect(mocks.syncShellMediaSessionExplicit).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "scripture", userPause: true }),
    );
    expect(mocks.resolveScripturePlayableSrcForChapter).not.toHaveBeenCalled();
    expect(mocks.configureScriptureShellAudioMode).not.toHaveBeenCalled();
  });

  it("pauseScriptureShellPlayback clears replay intent when sound is missing", async () => {
    const ctx = {
      soundRef: { current: null },
      autoPlayScriptureRef: { current: true },
      scriptureWantPlayingRef: { current: true },
    };

    await pauseScriptureShellPlayback(
      ctx as unknown as Parameters<typeof pauseScriptureShellPlayback>[0],
    );

    expect(ctx.scriptureWantPlayingRef.current).toBe(false);
    expect(ctx.autoPlayScriptureRef.current).toBe(false);
    expect(mocks.syncShellMediaSessionExplicit).toHaveBeenCalledWith(
      expect.objectContaining({
        playing: false,
        kind: "scripture",
        userPause: true,
      }),
    );
  });

  it("force-pause does not stop shared music sound while in music mode", async () => {
    const sound = { id: "music-sound" };
    const ctx = {
      soundRef: { current: sound },
      autoPlayScriptureRef: { current: true },
      scriptureWantPlayingRef: { current: true },
      setScripturePreparing: vi.fn(),
      unloadCurrent: vi.fn(async () => {}),
      stopScripturePlayback: vi.fn(async () => {}),
    };

    await toggleScripturePlayback(ctx as unknown as ChapterPlaybackCtx, { forcePause: true });

    expect(ctx.scriptureWantPlayingRef.current).toBe(false);
    expect(ctx.autoPlayScriptureRef.current).toBe(false);
    expect(mocks.safePauseSound).not.toHaveBeenCalled();
  });

  it("does not resume plan audio when browsing a different chapter", async () => {
    const sound = { id: "plan-sound" };
    mocks.getScripturePlayingChapter.mockReturnValue({
      bookId: "ACT",
      chapter: 9,
      translationId: "cuv-simp",
    });
    mocks.getActiveReadChapterPlayback.mockReturnValue({
      bookId: "MAT",
      chapter: 8,
      bookName: "马太福音",
      translationId: "cuv-simp",
      chapterAudioSrc: "file:///mat-8.mp3",
      onAdvanceNextChapter: vi.fn(),
      onAdvanceNextInBook: vi.fn(),
    });
    mocks.safeGetSoundStatus.mockResolvedValue({ isLoaded: true, isPlaying: false });
    mocks.resolveScripturePlayableSrcForChapter.mockResolvedValue("file:///mat-8.mp3");
    mocks.scriptureAudioUrlsEqual.mockReturnValue(false);
    mocks.translationSupportsChapterAudio.mockReturnValue(true);
    mocks.scriptureChapterPoolIsActive.mockReturnValue(true);
    mocks.scriptureChapterPoolGetCurrentTrack.mockReturnValue({
      id: "ACT:9",
      bookId: "ACT",
      chapter: 9,
      bookName: "使徒行传",
      title: "使徒行传 9",
      src: "file:///act-9.mp3",
      translationId: "cuv-simp",
    });

    const unloadCurrent = vi.fn(async () => {});
    const tryPlayScriptureWithFallback = vi.fn(async () => true);
    const ctx = {
      soundRef: { current: sound },
      activeSoundIdRef: { current: 1 },
      playbackEpochRef: { current: 1 },
      unloadCurrent,
      endMusicSession: vi.fn(),
      readChapter: null,
      readChapterRef: { current: null },
      scripturePlayInFlightRef: { current: null },
      scriptureSrcRef: { current: "file:///act-9.mp3" },
      scriptureStopAtSecRef: { current: null },
      scriptureStopAtOnEndedRef: { current: null },
      autoPlayScriptureRef: { current: false },
      scriptureWantPlayingRef: { current: false },
      scriptureChapterHandoffRef: { current: false },
      lastScriptureProgressSecRef: { current: 0 },
      setReadChapter: vi.fn(),
      setScripturePreparing: vi.fn(),
      patchReadChapterSrc: vi.fn(),
      tryPlayScriptureWithFallback,
      playScripture: vi.fn(),
      isStarted: vi.fn(() => true),
      stopScripturePlayback: vi.fn(async () => {}),
      setScriptureCurrentSec: vi.fn(),
    };

    await toggleScripturePlayback(ctx as unknown as ChapterPlaybackCtx);

    expect(mocks.safePlaySound).not.toHaveBeenCalled();
    expect(mocks.scriptureChapterPoolStop).toHaveBeenCalled();
    expect(tryPlayScriptureWithFallback).toHaveBeenCalledWith(
      expect.objectContaining({ bookId: "MAT", chapter: 8 }),
      "file:///mat-8.mp3",
    );
  });


  /**
   * 计划播放页：应该续播池里的当前轨（使徒行传 9），而不是章页残留的注册（马太福音 8）。
   *
   * 早先这条断言的是 expo-av 的「已加载会话直接 resume」快捷路径。那条路径已删——
   * 真机上音频全部由原生播放器出声，soundRef 永远是 null，整段执行不到。
   * 要守的行为没变，只是现在经由原生起播。
   */
  it("on listen host plays the plan pool track instead of the stale read-chapter registration", async () => {
    mocks.getPlanFlowUiHost.mockReturnValue("listen");
    mocks.resolveScripturePlayableSrcForChapter.mockResolvedValue("file:///act-9.mp3");
    mocks.getScripturePlayingChapter.mockReturnValue({
      bookId: "ACT",
      chapter: 9,
      translationId: "cuv-simp",
    });
    mocks.getActiveReadChapterPlayback.mockReturnValue({
      bookId: "MAT",
      chapter: 8,
      bookName: "马太福音",
      translationId: "cuv-simp",
      chapterAudioSrc: "file:///mat-8.mp3",
      onAdvanceNextChapter: vi.fn(),
      onAdvanceNextInBook: vi.fn(),
    });
    mocks.safeGetSoundStatus.mockResolvedValue({ isLoaded: true, isPlaying: false });
    mocks.scriptureChapterPoolIsActive.mockReturnValue(true);
    mocks.scriptureChapterPoolGetCurrentTrack.mockReturnValue({
      id: "ACT:9",
      bookId: "ACT",
      chapter: 9,
      bookName: "使徒行传",
      title: "使徒行传 9",
      src: "file:///act-9.mp3",
      translationId: "cuv-simp",
    });

    const ctx = {
      soundRef: { current: null },
      activeSoundIdRef: { current: 1 },
      playbackEpochRef: { current: 1 },
      unloadCurrent: vi.fn(async () => {}),
      endMusicSession: vi.fn(),
      readChapter: null,
      readChapterRef: { current: null },
      scripturePlayInFlightRef: { current: null },
      scriptureSrcRef: { current: "file:///act-9.mp3" },
      scriptureStopAtSecRef: { current: null },
      scriptureStopAtOnEndedRef: { current: null },
      autoPlayScriptureRef: { current: false },
      scriptureWantPlayingRef: { current: false },
      scriptureChapterHandoffRef: { current: false },
      lastScriptureProgressSecRef: { current: 12 },
      setReadChapter: vi.fn(),
      setScripturePreparing: vi.fn(),
      patchReadChapterSrc: vi.fn(),
      tryPlayScriptureWithFallback: vi.fn(async () => true),
      playScripture: vi.fn(),
      isStarted: vi.fn(() => true),
      stopScripturePlayback: vi.fn(async () => {}),
      setScriptureCurrentSec: vi.fn(),
    };

    await toggleScripturePlayback(ctx as unknown as ChapterPlaybackCtx);

    /**
     * 续播的是池里的使徒行传 9，不是章页残留的马太福音 8。
     * 同一章已有音轨时走原生续播，不必重新解析源，所以 tryPlayScriptureWithFallback 不该被调。
     */
    expect(mocks.syncShellMediaSessionExplicit).toHaveBeenCalledWith(
      expect.objectContaining({
        assetUri: "file:///act-9.mp3",
        title: expect.stringContaining("使徒行传"),
        kind: "scripture",
        userPlay: true,
      }),
    );
    expect(ctx.tryPlayScriptureWithFallback).not.toHaveBeenCalled();
    expect(mocks.scriptureChapterPoolStop).not.toHaveBeenCalled();
  });

});
