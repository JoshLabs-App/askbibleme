import { describe, expect, it, vi } from "vitest";

vi.mock("@expo/vector-icons/MaterialIcons", () => ({ default: {} }));

import { resolveMusicPagePlayIndex, resolveMusicPageToggleAction } from "./musicPagePlayback";
import type { PlaybackTrack } from "./types";

function track(id: string, album: string, playable = true): PlaybackTrack {
  return {
    id,
    title: id,
    artist: "",
    album,
    src: playable ? "https://cdn.example/music/uploads/a.mp3" : "",
    catalogSrc: playable ? "music/uploads/a.mp3" : "",
    localReady: playable,
  } as PlaybackTrack;
}

const tracks = [
  track("calm", "安静"),
  track("hymn-1", "赞美诗", false),
  track("hymn-2", "赞美诗"),
  track("piano-1", "钢琴"),
  track("piano-2", "钢琴"),
];

const playable = (item: PlaybackTrack) => Boolean(item.localReady);

describe("resolveMusicPagePlayIndex", () => {
  it("keeps the current 钢琴 track", () => {
    expect(resolveMusicPagePlayIndex(tracks, "钢琴", 4, playable)).toBe(4);
  });

  it("picks 赞美诗 for 圣诗 instead of 安静", () => {
    expect(resolveMusicPagePlayIndex(tracks, "圣诗", 0, playable)).toBe(2);
  });

  it("starts 钢琴 from that catalog when current is 安静", () => {
    expect(resolveMusicPagePlayIndex(tracks, "钢琴", 0, playable)).toBe(3);
  });
});

describe("resolveMusicPageToggleAction", () => {
  it("pauses when this page's selected album is already playing", () => {
    expect(
      resolveMusicPageToggleAction({
        selectedAlbum: "钢琴",
        currentAlbum: "钢琴",
        playing: true,
        tracks,
        trackIndex: 4,
        isPlayable: playable,
      }),
    ).toEqual({ type: "pause" });
  });

  it("plays the selected catalog instead of pausing 安静", () => {
    expect(
      resolveMusicPageToggleAction({
        selectedAlbum: "钢琴",
        currentAlbum: "安静",
        playing: true,
        tracks,
        trackIndex: 0,
        isPlayable: playable,
      }),
    ).toEqual({ type: "play", index: 3 });
  });
});
