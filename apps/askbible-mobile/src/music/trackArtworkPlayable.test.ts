import { describe, expect, it, vi } from "vitest";

vi.mock("@expo/vector-icons/MaterialIcons", () => ({ default: {} }));
vi.mock("../config/mobileBundledOnly", () => ({
  isMobileBundledOnly: () => true,
}));
vi.mock("../media/bundledMusicMedia", () => ({
  musicTrackHasRemoteR2Fallback: (src: string) => Boolean(src && src.includes("music/uploads")),
}));

import { resolveShellMusicPlayIndex } from "./trackArtworkPlayable";
import { pickRandomNextTrackIndexInAlbum } from "./musicCalmTrackAdvance";
import type { PlaybackTrack } from "./types";

function track(
  id: string,
  album: string,
  opts: { localReady?: boolean; remote?: boolean } = {},
): PlaybackTrack {
  const remote = opts.remote === true;
  return {
    id,
    title: id,
    artist: "",
    album,
    src: remote ? "/music/uploads/piano.mp3" : "",
    catalogSrc: remote ? "/music/uploads/piano.mp3" : "",
    localReady: opts.localReady ?? !remote,
  } as PlaybackTrack;
}

describe("resolveShellMusicPlayIndex", () => {
  it("keeps a playable piano R2 track instead of jumping to 安静", () => {
    const tracks = [
      track("calm-1", "安静", { localReady: true }),
      track("piano-1", "钢琴", { remote: true }),
    ];
    expect(resolveShellMusicPlayIndex(tracks, 1)).toBe(1);
  });

  it("falls back to 安静 only when preferred is not playable", () => {
    const tracks = [
      track("calm-1", "安静", { localReady: true }),
      {
        id: "broken",
        title: "broken",
        artist: "",
        album: "钢琴",
        src: "",
        catalogSrc: "",
        localReady: false,
      } as PlaybackTrack,
    ];
    expect(resolveShellMusicPlayIndex(tracks, 1)).toBe(0);
  });
});

describe("pickRandomNextTrackIndexInAlbum", () => {
  it("stays inside 钢琴", () => {
    const tracks = [
      track("calm-1", "安静"),
      track("piano-1", "钢琴"),
      track("piano-2", "钢琴"),
      track("piano-3", "钢琴"),
    ];
    for (let i = 0; i < 20; i += 1) {
      const next = pickRandomNextTrackIndexInAlbum(tracks, 1, tracks.length);
      expect(tracks[next]?.album).toBe("钢琴");
      expect(next).not.toBe(1);
    }
  });
});
