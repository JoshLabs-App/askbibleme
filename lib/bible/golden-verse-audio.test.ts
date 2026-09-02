import { describe, expect, it } from "vitest";
import { buildGoldenVerseAudioRelativePath } from "./golden-verse-audio";

describe("golden verse audio paths", () => {
  it("keeps CUV as the existing default", () => {
    expect(buildGoldenVerseAudioRelativePath("ROM.16.27")).toBe(
      "golden-verses/ROM-16-27-32kbps.mp3",
    );
  });

  it("uses the WEBP audio directory when selected", () => {
    expect(buildGoldenVerseAudioRelativePath("ROM.16.27", "web-en")).toBe(
      "golden-verses-web-en/ROM-16-27-32kbps.mp3",
    );
  });
});
