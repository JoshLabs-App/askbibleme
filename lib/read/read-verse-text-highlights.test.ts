import { describe, expect, it } from "vitest";
import {
  LEGACY_VERSE_TEXT_HIGHLIGHT_COLOR_MAP,
  VERSE_TEXT_HIGHLIGHT_PALETTE,
  normalizeVerseTextHighlightColor,
  verseTextHighlightStyle,
} from "./read-verse-text-highlights";

describe("划重点色板迁移", () => {
  it("旧色板的三支笔迁到新色板，不被打回默认黄", () => {
    expect(normalizeVerseTextHighlightColor("#7BC96F")).toBe("#A3B565");
    expect(normalizeVerseTextHighlightColor("#0FBCDB")).toBe("#4E86A0");
    expect(normalizeVerseTextHighlightColor("#F48FB1")).toBe("#C0625F");
  });

  it("小写 / 带空格的旧值同样能迁", () => {
    expect(normalizeVerseTextHighlightColor(" #7bc96f ")).toBe("#A3B565");
  });

  it("新色板原样返回，认不出的回默认黄", () => {
    for (const c of VERSE_TEXT_HIGHLIGHT_PALETTE) {
      expect(normalizeVerseTextHighlightColor(c)).toBe(c);
    }
    expect(normalizeVerseTextHighlightColor("#123456")).toBe("#FFB103");
    expect(normalizeVerseTextHighlightColor(null)).toBe("#FFB103");
  });

  it("迁移表的目标值都在新色板里", () => {
    for (const to of Object.values(LEGACY_VERSE_TEXT_HIGHLIGHT_COLOR_MAP)) {
      expect(VERSE_TEXT_HIGHLIGHT_PALETTE as readonly string[]).toContain(to);
    }
  });

  it("铺色样式给的是颜料 RGB + 两档 alpha，不是不透明 hex", () => {
    expect(verseTextHighlightStyle("#A3B565")).toEqual({
      "--vh-rgb": "163 181 101",
      "--vh-a": "0.5",
      "--vh-a-dark": "0.28",
    });
    // 旧值先迁移再取 alpha
    expect(verseTextHighlightStyle("#7BC96F")["--vh-rgb"]).toBe("163 181 101");
  });
});
