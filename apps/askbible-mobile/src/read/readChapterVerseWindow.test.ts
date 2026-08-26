import { describe, expect, it } from "vitest";
import {
  computeReadChapterWindowRange,
  estimateReadChapterVerseHeight,
} from "./readChapterVerseWindow";

describe("readChapterVerseWindow", () => {
  it("estimates taller blocks for longer text", () => {
    const short = estimateReadChapterVerseHeight({
      textLen: 12,
      fontSize: 18,
      lineHeight: 28,
    });
    const long = estimateReadChapterVerseHeight({
      textLen: 200,
      fontSize: 18,
      lineHeight: 28,
    });
    expect(long).toBeGreaterThan(short);
  });

  it("windows items with spacers", () => {
    const heights = Array.from({ length: 40 }, () => 50);
    const range = computeReadChapterWindowRange({
      itemCount: 40,
      heightAt: (i) => heights[i]!,
      scrollY: 500,
      viewportH: 600,
      overscanPx: 100,
    });
    expect(range.start).toBeGreaterThan(0);
    expect(range.end).toBeLessThan(39);
    expect(range.topSpacer).toBe(range.start * 50);
    expect(range.topSpacer + range.bottomSpacer).toBeLessThan(40 * 50);
  });
});
