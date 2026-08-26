import { describe, expect, it } from "vitest";
import {
  buildMusicAudioRemoteUrl,
  isHymnCommonsDirectAudioUrl,
  normalizeMusicAudioObjectKey,
} from "./musicAudioRemote";

const HYMN_SRC = "https://hymncommons.org/wp-content/uploads/2025/09/amazing-grace.mp3";

describe("isHymnCommonsDirectAudioUrl", () => {
  it("accepts Hymn Commons piano mp3s", () => {
    expect(isHymnCommonsDirectAudioUrl(HYMN_SRC)).toBe(true);
  });

  it("rejects other hosts and non-mp3", () => {
    expect(isHymnCommonsDirectAudioUrl("https://example.com/amazing-grace.mp3")).toBe(false);
    expect(isHymnCommonsDirectAudioUrl("https://hymncommons.org/piano-hymn-library/")).toBe(false);
    expect(isHymnCommonsDirectAudioUrl("/music/uploads/amazing-grace.mp3")).toBe(false);
  });
});

describe("hymn commons remote cache key", () => {
  it("keeps a stable cache key and does not rewrite the src onto R2", () => {
    expect(normalizeMusicAudioObjectKey(HYMN_SRC)).toBe("music/hymncommons/amazing-grace.mp3");
    expect(buildMusicAudioRemoteUrl(HYMN_SRC)).toBe(HYMN_SRC);
  });
});
