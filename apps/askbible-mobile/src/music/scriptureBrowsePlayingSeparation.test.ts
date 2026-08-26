import { beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock("react-native", () => ({
  Platform: { OS: "ios", select: (spec: Record<string, unknown>) => spec.ios },
}));

vi.mock("../bible/cuv-chapter-audio", () => ({
  scriptureAudioUrlsEqual: (a: string, b: string) => a === b,
}));

vi.mock("../audio/safeShellSound", () => ({
  logShellSoundError: vi.fn(),
}));

vi.mock("../read/read-plan-flow-autoplay", () => ({
  armReadPlanFlowAutoplay: vi.fn(),
  consumeReadPlanFlowAutoplay: vi.fn(),
  notifyPlanFlowChapterRegistered: vi.fn(),
  peekReadPlanFlowAutoplay: vi.fn(() => false),
}));

vi.mock("./scriptureResumeAfterInterruption", () => ({
  markScriptureWantPlaying: vi.fn(),
}));

vi.mock("./scripturePlaybackExclusive", () => ({
  isSameScriptureChapter: (
    a: { bookId: string; chapter: number; translationId: string } | null | undefined,
    b: { bookId: string; chapter: number; translationId: string } | null | undefined,
  ) =>
    !!a &&
    !!b &&
    a.bookId === b.bookId &&
    a.chapter === b.chapter &&
    a.translationId === b.translationId,
  isScripturePlaybackBusy: () => true,
}));

vi.mock("./scripture-chapter-pool", () => ({
  scriptureChapterPool: {
    isActive: vi.fn(() => true),
    getCurrentTrack: vi.fn(() => ({
      bookId: "GEN",
      chapter: 3,
      translationId: "cuv-simp",
      bookName: "创世记",
      src: "file:///gen-3.mp3",
      id: "GEN:3",
      title: "创世记 3",
    })),
    shouldPreservePlaybackOnUIUnmount: vi.fn(() => true),
  },
}));

import { registerReadChapterPlayback } from "./scriptureRegisterReadChapter";
import {
  getBrowseReadChapterPlayback,
  getPlayingReadChapterPlayback,
  resetReadChapterPlaybackStoresForTests,
  resolveTransportReadChapterPlayback,
  setPlayingReadChapterPlayback,
} from "../read/read-chapter-playback-store";
import type { ChapterPlaybackCtx } from "./scriptureChapterPlaybackTypes";

function makeReg(
  chapter: number,
  handlers?: { onNext?: () => void; onPrev?: () => void },
) {
  return {
    bookId: "GEN",
    chapter,
    bookName: "创世记",
    translationId: "cuv-simp",
    chapterAudioSrc: `file:///gen-${chapter}.mp3`,
    onAdvancePreviousChapter: handlers?.onPrev ?? vi.fn(),
    onAdvanceNextChapter: handlers?.onNext ?? vi.fn(),
    onAdvanceNextInBook: vi.fn(),
  };
}

describe("browse vs playing registration", () => {
  beforeEach(() => {
    resetReadChapterPlaybackStoresForTests();
  });

  it("browse register does not replace playing transport callbacks", () => {
    const playingNext = vi.fn();
    const playingReg = makeReg(3, { onNext: playingNext });
    setPlayingReadChapterPlayback(playingReg);

    const browseNext = vi.fn();
    const browseReg = makeReg(1, { onNext: browseNext });

    const readChapterRef = { current: playingReg };
    const setReadChapter = vi.fn();
    const ctx = {
      readChapterRef,
      setReadChapter,
      autoPlayScriptureRef: { current: false },
      scriptureWantPlayingRef: { current: true },
      scriptureSrcRef: { current: "file:///gen-3.mp3" },
      playbackModeRef: { current: "scripture" as const },
      isStarted: () => true,
      tryPlayScriptureWithFallback: vi.fn(),
    } as unknown as ChapterPlaybackCtx;

    registerReadChapterPlayback(ctx, browseReg);

    expect(getBrowseReadChapterPlayback()?.chapter).toBe(1);
    expect(getPlayingReadChapterPlayback()?.chapter).toBe(3);
    expect(resolveTransportReadChapterPlayback()?.chapter).toBe(3);
    // 引擎 ref 仍指向在播章
    expect(readChapterRef.current?.chapter).toBe(3);
    resolveTransportReadChapterPlayback()?.onAdvanceNextChapter();
    expect(playingNext).toHaveBeenCalledTimes(1);
    expect(browseNext).not.toHaveBeenCalled();
  });
});
