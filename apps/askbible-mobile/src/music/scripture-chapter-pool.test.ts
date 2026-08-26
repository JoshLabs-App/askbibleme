import { beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock("react-native", () => ({
  Platform: { OS: "ios", select: (spec: Record<string, unknown>) => spec.ios },
}));

vi.mock("../read/read-plan-flow-autoplay", () => ({
  armReadPlanFlowTodayLoop: vi.fn(),
  clearPlanFlowSessionActive: vi.fn(),
  clearReadPlanFlowTodayLoop: vi.fn(),
  markPlanFlowSessionActive: vi.fn(),
}));

vi.mock("../read/reading-plan/today-reading-done", () => ({
  markTodayReadingAudioChapterComplete: vi.fn(async () => {}),
  resolveLocalTodayReadingScopeKey: vi.fn(async () => "today"),
}));

vi.mock("../read/today-plan-scripture-resume", () => ({
  writeTodayPlanScriptureResume: vi.fn(async () => {}),
}));

vi.mock("../widget/widgetPlaybackRequest", () => ({
  requestWidgetVerseStop: vi.fn(),
}));

import { scriptureChapterPool } from "./scripture-chapter-pool";
import { holdScriptureUserPause, releaseScriptureUserPause } from "./scriptureUserPause";

const track = {
  id: "GEN:1",
  bookId: "GEN",
  chapter: 1,
  bookName: "创世记",
  title: "创世记 1",
  src: "file:///gen-1.mp3",
  translationId: "cuv-simp",
};

describe("scriptureChapterPool retry / pause", () => {
  beforeEach(() => {
    releaseScriptureUserPause();
    scriptureChapterPool.stop();
  });

  it("does not retry while the user pause hold is on", async () => {
    const playScriptureChapter = vi.fn(async () => true);
    scriptureChapterPool.registerDeps({
      playScriptureChapter,
      navigateToChapter: vi.fn(),
    });
    scriptureChapterPool.load([track], { loop: false });
    holdScriptureUserPause();

    const ok = await scriptureChapterPool.retryCurrent();

    expect(ok).toBe(false);
    expect(playScriptureChapter).not.toHaveBeenCalled();
  });

  it("aborts an in-flight playAt when the user pauses", async () => {
    let releasePlay!: (value: boolean) => void;
    const playScriptureChapter = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          releasePlay = resolve;
        }),
    );
    scriptureChapterPool.registerDeps({
      playScriptureChapter,
      navigateToChapter: vi.fn(),
    });
    scriptureChapterPool.load([track], { loop: false });

    const pending = scriptureChapterPool.playAt(0, { skipNavigate: true, maxAttempts: 2 });
    scriptureChapterPool.abortPendingPlay();
    releasePlay(false);

    const ok = await pending;
    expect(ok).toBe(false);
  });

  it("rolls index back when playAt fails after optimistic update", async () => {
    const track2 = {
      ...track,
      id: "GEN:2",
      chapter: 2,
      title: "创世记 2",
      src: "file:///gen-2.mp3",
    };
    const playScriptureChapter = vi.fn(async () => false);
    scriptureChapterPool.registerDeps({
      playScriptureChapter,
      navigateToChapter: vi.fn(),
    });
    scriptureChapterPool.load([track, track2], { loop: false });
    expect(await scriptureChapterPool.playAt(0, { skipNavigate: true, maxAttempts: 1 })).toBe(false);

    // Seed a successful first track so index is 0.
    playScriptureChapter.mockResolvedValueOnce(true);
    expect(await scriptureChapterPool.playAt(0, { skipNavigate: true, maxAttempts: 1 })).toBe(true);
    expect(scriptureChapterPool.getCurrentTrack()?.chapter).toBe(1);

    playScriptureChapter.mockResolvedValue(false);
    const ok = await scriptureChapterPool.playAt(1, { skipNavigate: true, maxAttempts: 1 });
    expect(ok).toBe(false);
    expect(scriptureChapterPool.getCurrentTrack()?.chapter).toBe(1);
  });
});
