import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  findNodeHandle: (node: unknown) => {
    if (node && typeof node === "object" && "nodeHandle" in node) {
      return (node as { nodeHandle: number }).nodeHandle;
    }
    return null;
  },
  UIManager: {
    measureInWindow: () => {},
    measureLayout: (
      _child: number,
      _parent: number,
      onFail: () => void,
    ) => {
      onFail();
    },
  },
}));

import {
  isLikelyVerseHighlightBox,
  isVerseMeasurableHost,
  measureHostInWindow,
  measureLayoutRelativeTo,
  nativeTargetFromLayoutEvent,
  nextScrollYFromWindowDelta,
  paragraphVerseCharRanges,
  scrollDeltaToCenterVerseInWindow,
  readChapterReadableCenterFromScreen,
  verseBoxesFromParagraphTextLayout,
  verseContentLayoutFromParagraphFrames,
  verseRelativeInParagraphGroup,
  verseWindowBoxFromParagraph,
} from "./read-chapter-verse-layout";

describe("nativeTargetFromLayoutEvent", () => {
  it("uses numeric nativeEvent.target", () => {
    expect(
      nativeTargetFromLayoutEvent({
        nativeEvent: { target: 42, layout: { x: 0, y: 0, width: 1, height: 1 } },
      } as never),
    ).toBe(42);
  });

  it("falls back to findNodeHandle(event.target) on Fabric", () => {
    expect(
      nativeTargetFromLayoutEvent({
        target: { nodeHandle: 99 },
        nativeEvent: { layout: { x: 0, y: 0, width: 1, height: 1 } },
      } as never),
    ).toBe(99);
  });
});

describe("measureHostInWindow", () => {
  it("resolves null when node has no measureInWindow", async () => {
    expect(isVerseMeasurableHost({})).toBe(false);
    await expect(measureHostInWindow({})).resolves.toBeNull();
  });

  it("reads the host window box", async () => {
    const host = {
      measureInWindow: (cb: (x: number, y: number, width: number, height: number) => void) => {
        cb(10, 240, 300, 48);
      },
    };
    expect(isVerseMeasurableHost(host)).toBe(true);
    await expect(measureHostInWindow(host)).resolves.toEqual({
      x: 10,
      y: 240,
      width: 300,
      height: 48,
    });
  });
});

describe("verseBoxesFromParagraphTextLayout", () => {
  it("maps wrapped lines to each verse box inside the paragraph", () => {
    const verses = [
      { verse: 1, text: "In the beginning God created the heaven and the earth." },
      { verse: 2, text: "And the earth was without form." },
    ];
    const { fullText, ranges } = paragraphVerseCharRanges(verses, " ");
    const lines = [
      { text: fullText.slice(0, 40), y: 0, height: 24 },
      { text: fullText.slice(40, 80), y: 24, height: 24 },
      { text: fullText.slice(80), y: 48, height: 24 },
    ];
    const boxes = verseBoxesFromParagraphTextLayout(ranges, lines, fullText);
    expect(boxes.get(1)?.y).toBe(0);
    expect((boxes.get(1)?.height ?? 0) > 24).toBe(true);
    expect((boxes.get(2)?.y ?? 0) >= 24).toBe(true);
    expect((boxes.get(2)?.height ?? 0) > 0).toBe(true);
  });

  it("still assigns verse boxes when line.text is missing", () => {
    const verses = [
      { verse: 1, text: "aaaaaaaaaa" },
      { verse: 2, text: "bbbbbbbbbb" },
    ];
    const { fullText, ranges } = paragraphVerseCharRanges(verses, "");
    const boxes = verseBoxesFromParagraphTextLayout(
      ranges,
      [
        { y: 0, height: 20 },
        { y: 20, height: 20 },
        { y: 40, height: 20 },
      ],
      fullText,
    );
    expect(boxes.get(1)?.y).toBe(0);
    expect(boxes.get(2)?.y).toBeGreaterThan(0);
  });

  it("splits collapsed line mapping across verses by character proportion", () => {
    const verses = [
      { verse: 1, text: "aaaa" },
      { verse: 2, text: "bbbb" },
      { verse: 5, text: "cccc" },
    ];
    const { fullText, ranges } = paragraphVerseCharRanges(verses, "");
    const boxes = verseBoxesFromParagraphTextLayout(
      ranges,
      [
        { text: fullText, y: 0, height: 90 },
      ],
      fullText,
    );
    expect(boxes.get(5)?.y ?? 0).toBeGreaterThan(boxes.get(1)?.y ?? 0);
    expect((boxes.get(5)?.y ?? 0) >= 50).toBe(true);
  });
});

describe("verseRelativeInParagraphGroup", () => {
  it("falls back to equal split when the highlight box was not measured", () => {
    const box = verseRelativeInParagraphGroup(5, [1, 2, 3, 4, 5, 6], 600, null);
    expect(box).toEqual({ y: 400, height: 100 });
  });
});

describe("verseWindowBoxFromParagraph", () => {
  it("places a late verse using character fraction of the measured paragraph", () => {
    const box = verseWindowBoxFromParagraph({
      paragraphWindow: { y: 200, height: 800 },
      verseNum: 5,
      verses: [1, 2, 3, 4, 5, 6],
      fraction: { verse: 5, start: 600, end: 700, total: 800 },
      measuredRelative: { y: 0, height: 800 },
    });
    expect(box?.y).toBe(200 + 600);
    expect(box?.height).toBe(100);
  });
});

describe("scrollDeltaToCenterVerseInWindow", () => {
  it("moves the highlight to the readable center by window delta", () => {
    const delta = scrollDeltaToCenterVerseInWindow({
      verseWindowY: 820,
      verseHeight: 40,
      scrollWindowY: 100,
      scrollViewportHeight: 700,
      chrome: { safeTop: 47, safeBottom: 34, audioDockVisible: true },
    });
    expect(delta).toBeGreaterThan(100);
    expect(nextScrollYFromWindowDelta(40, delta, 700, 5000)).toBe(40 + delta);
  });

  it("uses the screen reading pane midpoint when screen height is known", () => {
    const center = readChapterReadableCenterFromScreen({
      screenHeight: 1544,
      safeTop: 47,
      safeBottom: 34,
      audioDockVisible: true,
    });
    expect(center).toBeGreaterThan(600);
    expect(center).toBeLessThan(720);
  });
});

describe("isLikelyVerseHighlightBox", () => {
  it("rejects a full-paragraph box that fills the viewport", () => {
    expect(isLikelyVerseHighlightBox(820, 780)).toBe(false);
  });

  it("accepts a few-line highlight", () => {
    expect(isLikelyVerseHighlightBox(96, 780)).toBe(true);
  });
});

describe("measureLayoutRelativeTo", () => {
  it("resolves null when native handles are missing", async () => {
    await expect(measureLayoutRelativeTo({}, {})).resolves.toBeNull();
  });
});

describe("verseContentLayoutFromParagraphFrames", () => {
  it("uses cumulative height when every paragraph reports y=0", () => {
    const layout = verseContentLayoutFromParagraphFrames({
      verseNum: 20,
      originY: 120,
      relative: { y: 40, height: 48 },
      groups: [
        { verses: [1, 2, 3], y: 0, height: 200 },
        { verses: [4, 5], y: 0, height: 160 },
        { verses: [20, 21], y: 0, height: 180 },
      ],
    });
    expect(layout).toEqual({ y: 120 + 200 + 14 + 160 + 14 + 40, height: 48 });
  });

  it("uses native y when paragraphs have distinct offsets", () => {
    const layout = verseContentLayoutFromParagraphFrames({
      verseNum: 20,
      originY: 100,
      relative: { y: 24, height: 36 },
      groups: [
        { verses: [1], y: 0, height: 80 },
        { verses: [20], y: 900, height: 120 },
      ],
    });
    expect(layout).toEqual({ y: 100 + 900 + 24, height: 36 });
  });
});
