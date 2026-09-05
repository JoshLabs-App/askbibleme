import { describe, expect, it } from "vitest";
import {
  isHomeAlbumAudible,
  resolveHomeAlbumPlayIndex,
  resolveHomeAlbumPressAction,
  resolveHomeCenterPlayAction,
} from "./homeNatureAlbumPress";

const hymn = {
  albumName: "赞美诗",
  currentAlbum: "赞美诗",
  playbackMode: "music" as const,
  nativePlaying: false,
  jsPlaying: false,
  platform: "ios",
};

describe("resolveHomeAlbumPressAction", () => {
  it("selects when that album is not selected", () => {
    expect(resolveHomeAlbumPressAction({ playable: true, selected: false })).toBe("select");
  });

  it("deselects when tapping the selected album again", () => {
    expect(resolveHomeAlbumPressAction({ playable: true, selected: true })).toBe("deselect");
  });

  it("ignores empty albums", () => {
    expect(resolveHomeAlbumPressAction({ playable: false, selected: false })).toBe("ignore");
    expect(resolveHomeAlbumPressAction({ playable: false, selected: true })).toBe("ignore");
  });
});

describe("resolveHomeCenterPlayAction", () => {
  it("pauses when music is already on", () => {
    expect(
      resolveHomeCenterPlayAction({
        musicOn: true,
        verseAudible: false,
        albumSelected: true,
        verseSelected: false,
      }),
    ).toBe("pause");
  });

  it("pauses when only verse is audible", () => {
    expect(
      resolveHomeCenterPlayAction({
        musicOn: false,
        verseAudible: true,
        albumSelected: false,
        verseSelected: true,
      }),
    ).toBe("pause");
  });

  it("resumes the last album after a center pause", () => {
    expect(
      resolveHomeCenterPlayAction({
        musicOn: false,
        verseAudible: false,
        albumSelected: true,
        verseSelected: false,
      }),
    ).toBe("resume");
  });

  it("resumes verse after a center pause without music selected", () => {
    expect(
      resolveHomeCenterPlayAction({
        musicOn: false,
        verseAudible: false,
        albumSelected: false,
        verseSelected: true,
      }),
    ).toBe("resume");
  });

  it("starts 安静 when nothing is selected", () => {
    expect(
      resolveHomeCenterPlayAction({
        musicOn: false,
        verseAudible: false,
        albumSelected: false,
        verseSelected: false,
      }),
    ).toBe("play-default");
  });
});

describe("isHomeAlbumAudible", () => {
  it("does not light iOS hymns from JS playing alone", () => {
    expect(isHomeAlbumAudible({ ...hymn, jsPlaying: true })).toBe(false);
    expect(isHomeAlbumAudible({ ...hymn, nativePlaying: true })).toBe(true);
  });

  it("trusts JS playing on Android", () => {
    expect(isHomeAlbumAudible({ ...hymn, platform: "android", jsPlaying: true })).toBe(true);
  });

  it("lights the album when wantPlaying is set", () => {
    expect(isHomeAlbumAudible({ ...hymn, wantPlaying: true })).toBe(true);
  });
});

describe("resolveHomeAlbumPlayIndex", () => {
  const tracks = [
    { album: "安静", localReady: true },
    { album: "下午茶", localReady: true },
    { album: "赞美诗", localReady: false },
    { album: "赞美诗", localReady: false },
    { album: "钢琴", localReady: true },
    { album: "钢琴", localReady: false },
  ];
  const playable = (track: { localReady?: boolean; album?: string | null }) =>
    Boolean(track.localReady) || track.album === "赞美诗";

  it("picks only 赞美诗 for 圣诗", () => {
    for (let i = 0; i < 12; i += 1) {
      const idx = resolveHomeAlbumPlayIndex(tracks, "圣诗", 0, playable);
      expect(tracks[idx!]?.album).toBe("赞美诗");
    }
  });

  it("picks only 钢琴 for 钢琴目录", () => {
    for (let i = 0; i < 12; i += 1) {
      const idx = resolveHomeAlbumPlayIndex(tracks, "钢琴", 0, playable);
      expect(tracks[idx!]?.album).toBe("钢琴");
    }
  });

  it("still plays 赞美诗 when none are localReady", () => {
    const idx = resolveHomeAlbumPlayIndex(tracks, "赞美诗", 0, () => false);
    expect(tracks[idx!]?.album).toBe("赞美诗");
  });
});
