import { describe, expect, it, vi, afterEach } from "vitest";

vi.mock("@expo/vector-icons/MaterialIcons", () => ({ default: {} }));
vi.mock("../config/mobileBundledOnly", () => ({
  isMobileBundledOnly: () => true,
}));
vi.mock("../media/bundledMusicMedia", () => ({
  musicTrackHasRemoteR2Fallback: () => false,
}));
import { HOME_MUSIC_ALBUMS } from "./musicAlbumCatalog";
import { pickRandomPlayableTrackIndexInAlbum } from "./musicAlbumPlayback";
import type { PlaybackTrack } from "./types";

function track(id: string, album: string, localReady = true): PlaybackTrack {
  return {
    id,
    title: id,
    artist: "",
    album,
    src: localReady ? "file://local.mp3" : "",
    catalogSrc: "",
    localReady,
  } as PlaybackTrack;
}

describe("HOME_MUSIC_ALBUMS", () => {
  it("keeps calm / cafe / hymns / piano and excludes work and sleep", () => {
    expect([...HOME_MUSIC_ALBUMS]).toEqual(["安静", "下午茶", "赞美诗", "钢琴"]);
  });
});

describe("pickRandomPlayableTrackIndexInAlbum", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when the album has no playable tracks", () => {
    const tracks = [track("a", "安静"), track("b", "钢琴", false)];
    expect(pickRandomPlayableTrackIndexInAlbum(tracks, "钢琴")).toBeNull();
  });

  it("returns the only playable index", () => {
    const tracks = [track("a", "安静"), track("b", "钢琴")];
    expect(pickRandomPlayableTrackIndexInAlbum(tracks, "钢琴")).toBe(1);
  });

  it("picks among playable tracks instead of always the first", () => {
    const tracks = [
      track("a", "钢琴"),
      track("b", "安静"),
      track("c", "钢琴"),
      track("d", "钢琴"),
    ];
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    expect(pickRandomPlayableTrackIndexInAlbum(tracks, "钢琴")).toBe(3);
  });

  it("can exclude the current track when another playable exists", () => {
    const tracks = [track("a", "钢琴"), track("b", "钢琴")];
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(pickRandomPlayableTrackIndexInAlbum(tracks, "钢琴", 0)).toBe(1);
  });
});
