import { describe, expect, it, vi } from "vitest";
import {
  clearScriptureChapterHandoff,
  isScripturePlaybackProtected,
  markScriptureChapterHandoff,
  releaseScriptureShellForMusic,
  type ScripturePriorityRefs,
} from "./scripturePlaybackPriority";
import type { MutableRefObject } from "react";

function makeRefs(overrides: Partial<ScripturePriorityRefs> = {}): ScripturePriorityRefs {
  return {
    playbackModeRef: { current: "scripture" as const },
    soundRef: { current: {} as never },
    scriptureWantPlayingRef: { current: true },
    scripturePlayInFlightRef: { current: null as Promise<void> | null },
    autoPlayScriptureRef: { current: false },
    scriptureChapterHandoffRef: { current: false },
    ...overrides,
  };
}

describe("scripturePlaybackPriority", () => {
  it("stops scripture when user starts music", async () => {
    const playbackModeRef: MutableRefObject<"music" | "scripture"> = { current: "scripture" };
    const stop = vi.fn(async () => {
      playbackModeRef.current = "music";
    });
    await releaseScriptureShellForMusic(playbackModeRef, stop);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("skips stop when shell is already in music mode", async () => {
    const playbackModeRef: MutableRefObject<"music" | "scripture"> = { current: "music" };
    const stop = vi.fn(async () => {});
    await releaseScriptureShellForMusic(playbackModeRef, stop);
    expect(stop).not.toHaveBeenCalled();
  });

  it("detects protected scripture session during handoff", () => {
    const refs = makeRefs({ scriptureWantPlayingRef: { current: false } });
    markScriptureChapterHandoff(refs.scriptureChapterHandoffRef);
    expect(isScripturePlaybackProtected(refs)).toBe(true);
    clearScriptureChapterHandoff(refs.scriptureChapterHandoffRef);
    expect(isScripturePlaybackProtected(refs)).toBe(false);
  });
});
