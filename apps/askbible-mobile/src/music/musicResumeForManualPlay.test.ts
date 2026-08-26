import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncMusicResumeForManualPlay } from "./musicResumeForManualPlay";
import type { PlaybackTrack } from "./types";

vi.mock("./music-playback-prefs", () => ({
  readMusicPlaybackResume: vi.fn(),
  normalizeMusicResumeSec: (sec: number) => Math.max(0, sec),
}));

import { readMusicPlaybackResume } from "./music-playback-prefs";

const readResume = vi.mocked(readMusicPlaybackResume);

function track(id: string, durationSec = 120): PlaybackTrack {
  return {
    id,
    title: id,
    artist: "",
    album: "",
    durationSec,
    localReady: true,
  } as PlaybackTrack;
}

describe("syncMusicResumeForManualPlay", () => {
  beforeEach(() => {
    readResume.mockReset();
  });

  it("loads saved track index and position into refs", async () => {
    readResume.mockResolvedValue({ trackId: "b", positionSec: 42 });
    const tracks = [track("a"), track("b"), track("c")];
    const trackIndexRef = { current: 0 };
    const resumeTrackIdRef = { current: null as string | null };
    const resumePositionSecRef = { current: 0 };

    const idx = await syncMusicResumeForManualPlay({
      tracks,
      trackIndexRef,
      resumeTrackIdRef,
      resumePositionSecRef,
    });

    expect(idx).toBe(1);
    expect(trackIndexRef.current).toBe(1);
    expect(resumeTrackIdRef.current).toBe("b");
    expect(resumePositionSecRef.current).toBe(42);
  });

  it("falls back to in-memory resume refs when storage empty", async () => {
    readResume.mockResolvedValue(null);
    const tracks = [track("a"), track("b")];
    const trackIndexRef = { current: 0 };
    const resumeTrackIdRef = { current: "b" };
    const resumePositionSecRef = { current: 18 };

    const idx = await syncMusicResumeForManualPlay({
      tracks,
      trackIndexRef,
      resumeTrackIdRef,
      resumePositionSecRef,
    });

    expect(idx).toBe(1);
    expect(trackIndexRef.current).toBe(1);
    expect(resumePositionSecRef.current).toBe(18);
  });
});
