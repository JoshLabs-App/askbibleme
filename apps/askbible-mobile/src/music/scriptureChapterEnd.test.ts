import { describe, expect, it, vi } from "vitest";
import {
  finishScriptureChapterOnce,
  isScriptureChapterEndStalled,
  isScriptureNearChapterEnd,
  noteScripturePlaybackProgress,
  resetScriptureChapterEndTracking,
  SCRIPTURE_CHAPTER_END_STALL_MS,
} from "./scriptureChapterEnd";

vi.mock("./scripturePlaybackFinish", () => ({
  handleScriptureDidJustFinish: vi.fn(),
}));

import { handleScriptureDidJustFinish } from "./scripturePlaybackFinish";

describe("scriptureChapterEnd", () => {
  it("detects near chapter end within tolerance", () => {
    expect(isScriptureNearChapterEnd(118_500, 120_000)).toBe(true);
    expect(isScriptureNearChapterEnd(117_000, 120_000)).toBe(false);
  });

  it("does not treat short or buffering durations as chapter end", () => {
    expect(isScriptureNearChapterEnd(0, 1_500)).toBe(false);
    expect(isScriptureNearChapterEnd(1_200, 1_500)).toBe(false);
    expect(isScriptureNearChapterEnd(0, 2_000)).toBe(false);
    expect(isScriptureNearChapterEnd(0, 2_001)).toBe(false);
  });

  it("finishes chapter only once", () => {
    const chapterEndHandledRef = { current: false };
    const args = {
      soundRef: { current: null },
      scriptureSrcRef: { current: null },
      scriptureAudioRepeatRef: { current: "off" as const },
      readChapterRef: { current: null },
      autoPlayScriptureRef: { current: true },
      scriptureChapterHandoffRef: { current: false },
      scriptureWantPlayingRef: { current: false },
      setPlaying: vi.fn(),
      chapterEndHandledRef,
    };

    expect(finishScriptureChapterOnce(args)).toBe(true);
    expect(finishScriptureChapterOnce(args)).toBe(false);
    expect(handleScriptureDidJustFinish).toHaveBeenCalledTimes(1);
  });

  it("detects stall when position unchanged near end", () => {
    vi.useFakeTimers();
    const lastMs = { current: 118_500 };
    const lastAt = { current: Date.now() };
    noteScripturePlaybackProgress(118_500, lastMs, lastAt);

    expect(
      isScriptureChapterEndStalled(118_500, 120_000, lastMs, lastAt),
    ).toBe(false);

    vi.advanceTimersByTime(SCRIPTURE_CHAPTER_END_STALL_MS);
    expect(
      isScriptureChapterEndStalled(118_500, 120_000, lastMs, lastAt),
    ).toBe(true);

    vi.useRealTimers();
  });

  it("resets tracking refs", () => {
    const handled = { current: true };
    const lastMs = { current: 99_000 };
    const lastAt = { current: 0 };
    resetScriptureChapterEndTracking(handled, lastMs, lastAt);
    expect(handled.current).toBe(false);
    expect(lastMs.current).toBe(-1);
    expect(lastAt.current).toBeGreaterThan(0);
  });
});
