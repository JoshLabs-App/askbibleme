import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyNativePlaybackState } from "../audio/playbackState";
import {
  clearScriptureChapterHandoff,
  isScripturePlaybackProtected,
  markScriptureChapterHandoff,
  releaseScriptureShellForMusic,
  type ScripturePriorityRefs,
} from "./scripturePlaybackPriority";

function makeRefs(overrides: Partial<ScripturePriorityRefs> = {}): ScripturePriorityRefs {
  return {
    scriptureWantPlayingRef: { current: true },
    scripturePlayInFlightRef: { current: null as Promise<void> | null },
    autoPlayScriptureRef: { current: false },
    ...overrides,
  };
}

/** 主轨是谁由原生说了算：读经这条流有没有音轨。 */
function nativeScriptureUri(uri: string | null): void {
  applyNativePlaybackState({ scripture: { uri, playing: uri != null } });
}

describe("scripturePlaybackPriority", () => {
  beforeEach(() => nativeScriptureUri(null));

  it("stops scripture when user starts music", async () => {
    nativeScriptureUri("file:///cache/cuv/GEN-1.mp3");
    const stop = vi.fn(async () => nativeScriptureUri(null));
    await releaseScriptureShellForMusic(stop);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("skips stop when shell is already in music mode", async () => {
    const stop = vi.fn(async () => {});
    await releaseScriptureShellForMusic(stop);
    expect(stop).not.toHaveBeenCalled();
  });

  it("detects protected scripture session during handoff", () => {
    nativeScriptureUri("file:///cache/cuv/GEN-1.mp3");
    const refs = makeRefs({ scriptureWantPlayingRef: { current: false } });
    markScriptureChapterHandoff();
    expect(isScripturePlaybackProtected(refs)).toBe(true);
    clearScriptureChapterHandoff();
    expect(isScripturePlaybackProtected(refs)).toBe(false);
  });

  /** 读经流上没有音轨时，保护无从谈起——否则音乐永远抢不到主轨。 */
  it("is not protected when native holds no scripture track", () => {
    const refs = makeRefs();
    expect(isScripturePlaybackProtected(refs)).toBe(false);
  });
});
