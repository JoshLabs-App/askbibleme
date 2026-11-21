import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LEGACY_VERSE_TEXT_HIGHLIGHT_COLOR_MAP,
  READ_VERSE_TEXT_HIGHLIGHT_TOMBSTONE_TTL_MS,
  VERSE_TEXT_HIGHLIGHT_PALETTE,
  clearVerseTextHighlightsForAccountSwitch,
  exportVerseTextHighlightSyncValue,
  extractHighlightTimestampsFromSyncValue,
  normalizeVerseTextHighlightColor,
  parseVerseTextHighlightStoreValue,
  readVerseTextHighlightStore,
  readVerseTextHighlightTimestamps,
  verseTextHighlightStyle,
  writeVerseTextHighlightIndices,
} from "./read-verse-text-highlights";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); },
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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

  it("记录节级 _t 时间戳与擦除墓碑、兼容解析并支持切号清理", () => {
    const local = memoryStorage();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", local);
    vi.spyOn(Date, "now").mockReturnValue(10_000);

    const ref = { translationId: "cuv", bookId: "GEN", chapter: 1, verse: 1 };
    writeVerseTextHighlightIndices(ref, [[0, "#FFB103"], [1, "#A3B565"]]);
    expect(readVerseTextHighlightTimestamps(10_000)).toEqual({ "cuv:GEN:1:1": 10_000 });
    expect(exportVerseTextHighlightSyncValue()).toEqual({
      "cuv:GEN:1:1": [{ i: 0, c: "#FFB103" }, { i: 1, c: "#A3B565" }],
      _t: { "cuv:GEN:1:1": 10_000 },
    });

    // 整节擦除：store 变空但 _t 保留擦除时间戳 60 天
    vi.spyOn(Date, "now").mockReturnValue(20_000);
    writeVerseTextHighlightIndices(ref, []);
    expect(readVerseTextHighlightStore()).toEqual({});
    expect(exportVerseTextHighlightSyncValue(readVerseTextHighlightStore(), undefined, 20_000)).toEqual({
      _t: { "cuv:GEN:1:1": 20_000 },
    });
    expect(parseVerseTextHighlightStoreValue({
      "cuv:JHN:3:16": [{ i: 0, c: "#FFB103" }],
      _t: { "cuv:GEN:1:1": 20_000, "cuv:JHN:3:16": 20_000 },
    })).toEqual({ "cuv:JHN:3:16": [{ i: 0, c: "#FFB103" }] });
    expect(extractHighlightTimestampsFromSyncValue({
      _t: { "cuv:GEN:1:1": 20_000 },
    }, 20_000 + READ_VERSE_TEXT_HIGHLIGHT_TOMBSTONE_TTL_MS + 1)).toEqual({});

    clearVerseTextHighlightsForAccountSwitch();
    expect(readVerseTextHighlightStore()).toEqual({});
    expect(readVerseTextHighlightTimestamps()).toEqual({});
  });
});
