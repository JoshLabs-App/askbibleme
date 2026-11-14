import { describe, expect, it } from "vitest";
import { resolveHomeAlbumPlayIndex } from "./home-nature-album-press";

const tracks = [
  { album: "安静", localReady: true },
  { album: "安静", localReady: true },
  { album: "下午茶", localReady: true },
];

describe("reopening background music", () => {
  it("keeps the current song when the same album is turned back on", () => {
    expect(resolveHomeAlbumPlayIndex(tracks, "安静", 1, () => true)).toBe(1);
  });
  it("only changes the song when the user chooses a different album", () => {
    expect(resolveHomeAlbumPlayIndex(tracks, "下午茶", 1, () => true)).toBe(2);
  });
  it("falls back within the selected album when the saved song is unavailable", () => {
    expect(resolveHomeAlbumPlayIndex(tracks, "安静", 1, (_, index) => index !== 1)).toBe(0);
    expect(resolveHomeAlbumPlayIndex([], "安静", 1, () => true)).toBeNull();
  });
});
