import { describe, expect, it } from "vitest";
import {
  isIosNativeLocalMusicUri,
  isIosNativePlayableMusicUri,
} from "./shellMusicPlayableAssetUri";

describe("isIosNativePlayableMusicUri", () => {
  it("allows local files and TEMP HTTPS music", () => {
    expect(isIosNativePlayableMusicUri("file:///var/music/a.mp3")).toBe(true);
    expect(
      isIosNativePlayableMusicUri(
        "https://hymncommons.org/wp-content/uploads/2025/09/amazing-grace.mp3",
      ),
    ).toBe(true);
    expect(
      isIosNativePlayableMusicUri(
        "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev/music/uploads/a.mp3",
      ),
    ).toBe(true);
  });

  it("rejects Metro http and non-music paths", () => {
    expect(isIosNativePlayableMusicUri("http://localhost:8081/assets/a.mp3")).toBe(false);
    expect(isIosNativePlayableMusicUri("https://example.com/scenes/wave.mp3")).toBe(false);
    expect(isIosNativeLocalMusicUri("https://hymncommons.org/a.mp3")).toBe(false);
  });
});
