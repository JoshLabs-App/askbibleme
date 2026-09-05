import { beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const pool = vi.hoisted(() => ({
  isActive: vi.fn(() => false),
  isPlayInFlight: vi.fn(() => false),
  skipToNext: vi.fn(async () => true),
  skipToPrev: vi.fn(async () => true),
  abortPendingPlay: vi.fn(),
  getCurrentTrack: vi.fn(
    () => null as null | { bookId: string; chapter: number; translationId: string },
  ),
}));

vi.mock("react-native", () => ({
  Platform: { OS: "ios", select: (s: Record<string, unknown>) => s.ios },
}));

vi.mock("./scripture-chapter-pool", () => ({
  scriptureChapterPool: pool,
}));

vi.mock("../audio/shellMediaControls", () => ({
  pauseShellAppMusic: vi.fn(),
}));

vi.mock("../audio/shellScriptureWantPlaying", () => ({
  setShellScriptureWantPlaying: vi.fn(),
}));

vi.mock("../audio/shellVerseWantPlaying", () => ({
  setShellVerseWantPlaying: vi.fn(),
}));

vi.mock("../read/read-plan-flow-autoplay", () => ({
  consumeReadPlanFlowAutoplay: vi.fn(),
}));

vi.mock("../widget/widgetPlaybackRequest", () => ({
  requestWidgetVerseStop: vi.fn(),
}));

const transport = vi.hoisted(() => ({
  resolveTransportReadChapterPlayback: vi.fn(() => null as null | {
    bookId?: string;
    chapter?: number;
    translationId?: string;
    onAdvanceNextChapter: () => void;
    onAdvancePreviousChapter: () => void;
  }),
}));

vi.mock("../read/read-chapter-playback-store", () => transport);

import {
  scriptureCommandQuietExclusive,
  scriptureCommandSkipNext,
  scriptureCommandSkipPrev,
  scriptureCommandEndHold,
} from "./scriptureCommands";
import {
  isScriptureUserPauseHeld,
  resetScriptureUserPauseForTests,
} from "./scriptureUserPause";
import { requestWidgetVerseStop } from "../widget/widgetPlaybackRequest";
import { setShellScriptureWantPlaying } from "../audio/shellScriptureWantPlaying";

describe("scriptureCommands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetScriptureUserPauseForTests();
    pool.isActive.mockReturnValue(false);
  });

  it("quietExclusive holds reason and stops verse intent", () => {
    scriptureCommandQuietExclusive({ holdReason: "alarm-prelude" });
    expect(isScriptureUserPauseHeld()).toBe(true);
    expect(pool.abortPendingPlay).toHaveBeenCalled();
    expect(requestWidgetVerseStop).toHaveBeenCalled();
    expect(setShellScriptureWantPlaying).toHaveBeenCalledWith(false);
    scriptureCommandEndHold("alarm-prelude");
    expect(isScriptureUserPauseHeld()).toBe(false);
  });

  it("skipNext prefers pool when active and pool track matches the playing chapter", async () => {
    pool.isActive.mockReturnValue(true);
    pool.getCurrentTrack.mockReturnValue({ bookId: "MAT", chapter: 8, translationId: "cuv-simp" });
    transport.resolveTransportReadChapterPlayback.mockReturnValue({
      bookId: "MAT",
      chapter: 8,
      translationId: "cuv-simp",
      onAdvanceNextChapter: vi.fn(),
      onAdvancePreviousChapter: vi.fn(),
    });
    await scriptureCommandSkipNext({ skipNavigate: true });
    expect(pool.skipToNext).toHaveBeenCalledWith({ skipNavigate: true });
  });

  it("skipNext falls back to transport when pool track is not the playing chapter", async () => {
    const onNext = vi.fn();
    pool.isActive.mockReturnValue(true);
    pool.getCurrentTrack.mockReturnValue({ bookId: "ACT", chapter: 9, translationId: "cuv-simp" });
    transport.resolveTransportReadChapterPlayback.mockReturnValue({
      bookId: "MAT",
      chapter: 8,
      translationId: "cuv-simp",
      onAdvanceNextChapter: onNext,
      onAdvancePreviousChapter: vi.fn(),
    });
    const ok = await scriptureCommandSkipNext();
    expect(ok).toBe(true);
    expect(onNext).toHaveBeenCalled();
    expect(pool.skipToNext).not.toHaveBeenCalled();
  });

  it("skipPrev uses transport when pool inactive", async () => {
    const onPrev = vi.fn();
    transport.resolveTransportReadChapterPlayback.mockReturnValue({
      onAdvanceNextChapter: vi.fn(),
      onAdvancePreviousChapter: onPrev,
    });
    const ok = await scriptureCommandSkipPrev();
    expect(ok).toBe(true);
    expect(onPrev).toHaveBeenCalled();
    expect(pool.skipToPrev).not.toHaveBeenCalled();
  });
});
