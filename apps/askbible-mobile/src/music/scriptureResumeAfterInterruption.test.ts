import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  markScriptureWantPlaying,
  recoverScripturePlaybackAfterBackground,
  type ScriptureBackgroundRecoveryCtx,
  type ScriptureResumeCtx,
  tryResumeScriptureAfterInterruption,
} from "./scriptureResumeAfterInterruption";

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

vi.mock("../audio/shellAudioMode", () => ({
  configureShellAudioMode: vi.fn(async () => {}),
  configureScriptureShellAudioMode: vi.fn(async () => {}),
}));

vi.mock("../audio/safeShellSound", () => ({
  safeGetSoundStatus: vi.fn(),
  safePlaySound: vi.fn(async () => true),
}));

import { safeGetSoundStatus, safePlaySound } from "../audio/safeShellSound";

function makeCtx(overrides: Partial<ScriptureResumeCtx> = {}): ScriptureResumeCtx {
  const scriptureWantPlayingRef = { current: true };
  const playbackModeRef = { current: "scripture" as const };
  const soundRef = { current: { playAsync: vi.fn() } as unknown as import("expo-av").Audio.Sound };
  const scripturePlayInFlightRef = { current: null as Promise<void> | null };
  const scriptureStopAtSecRef = { current: null as number | null };
  const setPlaying = vi.fn();

  return {
    scriptureWantPlayingRef,
    playbackModeRef,
    soundRef,
    scripturePlayInFlightRef,
    scriptureStopAtSecRef,
    setPlaying,
    ...overrides,
  } satisfies ScriptureResumeCtx;
}

function makeRecoveryCtx(overrides: Partial<ScriptureBackgroundRecoveryCtx> = {}): ScriptureBackgroundRecoveryCtx {
  const onAdvancePreviousChapter = vi.fn();
  const onAdvanceNextChapter = vi.fn();
  return {
    ...makeCtx(),
    readChapterRef: {
      current: {
        bookId: "GEN",
        chapter: 1,
        bookName: "创世记",
        translationId: "cuv-simp",
        chapterAudioSrc: "file:///gen-1.mp3",
        onAdvancePreviousChapter: onAdvancePreviousChapter,
        onAdvanceNextChapter: onAdvanceNextChapter,
        onAdvanceNextInBook: vi.fn(),
      },
    },
    autoPlayScriptureRef: { current: true },
    scriptureAudioRepeatRef: { current: "off" as const },
    scriptureChapterHandoffRef: { current: false },
    scriptureChapterEndHandledRef: { current: false },
    scriptureLastProgressMsRef: { current: -1 },
    scriptureLastProgressAtRef: { current: Date.now() },
    scriptureSrcRef: { current: null },
    tryPlayScriptureWithFallback: vi.fn(async () => true),
    ...overrides,
  } satisfies ScriptureBackgroundRecoveryCtx;
}

describe("tryResumeScriptureAfterInterruption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resumes when user still wants playback and sound is paused mid-chapter", async () => {
    const ctx = makeCtx();
    vi.mocked(safeGetSoundStatus).mockResolvedValue({
      isLoaded: true,
      isPlaying: false,
      positionMillis: 12_000,
      durationMillis: 120_000,
    } as never);

    const ok = await tryResumeScriptureAfterInterruption(ctx);

    expect(ok).toBe(true);
    expect(safePlaySound).toHaveBeenCalledWith(ctx.soundRef.current);
    expect(ctx.setPlaying).toHaveBeenCalledWith(true);
  });

  it("does not resume after user pause", async () => {
    const ctx = makeCtx();
    markScriptureWantPlaying(ctx.scriptureWantPlayingRef, false);

    const ok = await tryResumeScriptureAfterInterruption(ctx);

    expect(ok).toBe(false);
    expect(safeGetSoundStatus).not.toHaveBeenCalled();
  });

  it("does not resume near chapter end", async () => {
    const ctx = makeCtx();
    vi.mocked(safeGetSoundStatus).mockResolvedValue({
      isLoaded: true,
      isPlaying: false,
      positionMillis: 119_600,
      durationMillis: 120_000,
    } as never);

    const ok = await tryResumeScriptureAfterInterruption(ctx);

    expect(ok).toBe(false);
    expect(safePlaySound).not.toHaveBeenCalled();
  });

  it("advances at chapter end when recovering from background", async () => {
    const ctx = makeRecoveryCtx();
    vi.mocked(safeGetSoundStatus).mockResolvedValue({
      isLoaded: true,
      isPlaying: false,
      positionMillis: 119_600,
      durationMillis: 120_000,
    } as never);

    const ok = await recoverScripturePlaybackAfterBackground(ctx as never);

    expect(ok).toBe(true);
    expect(ctx.readChapterRef!.current!.onAdvanceNextChapter).toHaveBeenCalledTimes(1);
    expect(safePlaySound).not.toHaveBeenCalled();
  });
});
