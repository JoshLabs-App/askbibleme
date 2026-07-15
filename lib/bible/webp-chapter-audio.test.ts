import { describe, expect, it } from "vitest";
import { webpChapterAudioUrl } from "./web-chapter-audio-book-names";

describe("official WEBP chapter audio URLs", () => {
  it("matches regular and irregular eBible.org OGG filenames", () => {
    const cases: Array<[string, number, string]> = [
      ["GEN", 1, "01_Genesis/01_Genesis_C01.ogg"],
      ["PSA", 23, "19_Psalms/19_Psalms_C23.ogg"],
      ["JON", 2, "32_Jonah/32_Jonah_2.ogg"],
      ["GAL", 1, "48_Galatians/40_Galatians_C1.ogg"],
      ["COL", 4, "51_Colossians/52_Colossians_C4.ogg"],
      ["PHM", 1, "57_Philemon/57_Philemon_C1.ogg"],
      ["REV", 22, "66_Revelation/66_Revelation_C22.ogg"],
    ];

    for (const [bookId, chapter, path] of cases) {
      expect(webpChapterAudioUrl(bookId, chapter)).toBe(
        `https://ebible.org/engwebp/ogg/${path}`,
      );
    }
  });
});
