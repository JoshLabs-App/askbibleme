import { describe, expect, it, vi } from "vitest";
import { getShellDefaultAudioSrc } from "./shell-default-audio-src";
import type { AudioTrack, MusicCompanionStore } from "./types";

const quiet: AudioTrack = { id: "quiet", src: "/music/quiet.mp3", title: "Quiet", remark: "安静" };
const tea: AudioTrack = { id: "tea", src: "/music/tea.mp3", title: "Tea", remark: "下午茶" };
const store = (tracks: AudioTrack[]): MusicCompanionStore => ({
  version: 1, audioTracks: tracks, scenes: [], backgroundVisuals: [], defaultSceneId: null,
});

describe("the shell's first music selection", () => {
  it("remains stable across catalog refreshes and does not choose another album", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.99);
    try {
      expect(getShellDefaultAudioSrc(store([tea, quiet]))).toBe(quiet.src);
      expect(getShellDefaultAudioSrc(store([{ ...tea }, { ...quiet }]))).toBe(quiet.src);
      expect(random).not.toHaveBeenCalled();
    } finally { random.mockRestore(); }
  });

  it("does not substitute a different album when quiet music is unavailable", () => {
    expect(getShellDefaultAudioSrc(store([tea]))).toBeNull();
  });
});
