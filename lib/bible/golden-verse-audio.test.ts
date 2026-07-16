import { describe, expect, it } from "vitest";
import { buildGoldenVerseAudioRelativePath } from "./golden-verse-audio";
import { isSafeChapterAudioRelativePath } from "./cuv-chapter-audio-storage";

describe("golden verse audio paths", () => {
  it("keeps CUV as the existing default", () => {
    expect(buildGoldenVerseAudioRelativePath("ROM.16.27")).toBe(
      "golden-verses/ROM-16-27-32kbps.mp3",
    );
  });

  it("uses the WEBP audio directory when selected", () => {
    const path = buildGoldenVerseAudioRelativePath("ROM.16.27", "web-en");
    expect(path).toBe("golden-verses-web-en/ROM-16-27-32kbps.mp3");
    expect(isSafeChapterAudioRelativePath(path!)).toBe(true);
  });
});
