import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scriptureBooks } from "./scripture-books";
import { parseCuvChapterVerseTimingsPayload, verseNumberAtChapterAudioTime } from "./cuv-chapter-verse-timings";

describe("TV Mandarin recording timing assets", () => {
  it("ships aligned timing tracks for every chapter, including exact verse boundaries", () => {
    let count = 0;
    for (const book of scriptureBooks) {
      for (let chapter = 1; chapter <= book.chapters; chapter++) {
        const file = path.resolve("public/verse-timings/cuv-v20", `${book.bookId}-${chapter}.json`);
        const timings = parseCuvChapterVerseTimingsPayload(JSON.parse(fs.readFileSync(file, "utf8")));
        expect(timings, file).not.toBeNull();
        for (const [index, row] of timings!.entries()) {
          expect(row.end, file).toBeGreaterThanOrEqual(row.start);
          expect(row.verse, file).toBe(index + 1);
          const lastAtStart = timings!.filter((t) => t.start <= row.start).at(-1)!;
          expect(verseNumberAtChapterAudioTime(row.start, timings!), file).toBe(lastAtStart.verse);
        }
        count++;
      }
    }
    expect(count).toBe(1189);
  });
});
