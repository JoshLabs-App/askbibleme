import { describe, expect, it } from "vitest";
import { buildAudioTreasureKjvChapterUrl } from "./kjv-chapter-audio-url";

describe("KJV AudioTreasure chapter audio", () => {
  it("maps regular and exceptional book names to their actual KJV recordings", () => {
    const cases: Array<[string, number, string]> = [
      ["GEN", 1, "01_Genesis001.mp3"],
      ["JOB", 42, "18_Job042.mp3"],
      ["PSA", 150, "19_Psalms150.mp3"],
      ["SNG", 8, "22_Song_of_Soloman008.mp3"],
      ["PHM", 1, "57_Philemon.mp3"],
      ["2JN", 1, "63_2John.mp3"],
      ["3JN", 1, "64_3John.mp3"],
      ["JUD", 1, "65_Jude.mp3"],
      ["REV", 22, "66_Revelation022.mp3"],
    ];
    for (const [bookId, chapter, filename] of cases) {
      expect(buildAudioTreasureKjvChapterUrl(bookId, chapter)).toBe(
        `https://www.audiotreasure.com/content/KJV_AT/${filename}`,
      );
    }
  });
});
