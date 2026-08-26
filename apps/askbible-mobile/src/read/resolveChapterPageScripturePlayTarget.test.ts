import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveReadChapterPlayback: vi.fn(() => null as null | {
    bookId: string;
    chapter: number;
    bookName: string;
    translationId: string;
  }),
  getPlayingReadChapterPlayback: vi.fn(() => null),
  getScripturePlayingChapter: vi.fn(() => null as null | {
    bookId: string;
    chapter: number;
    translationId: string;
  }),
  bookNameForId: vi.fn((id: string) => `Book:${id}`),
}));

vi.mock("./read-chapter-playback-store", () => ({
  getActiveReadChapterPlayback: mocks.getActiveReadChapterPlayback,
  getPlayingReadChapterPlayback: mocks.getPlayingReadChapterPlayback,
}));

vi.mock("../music/scripturePlayingChapterStore", () => ({
  getScripturePlayingChapter: mocks.getScripturePlayingChapter,
}));

vi.mock("./canonCatalog", () => ({
  bookNameForId: mocks.bookNameForId,
}));

import {
  parseReadChapterPathname,
  resolveChapterPageScripturePlayTarget,
} from "./resolveChapterPageScripturePlayTarget";

describe("parseReadChapterPathname", () => {
  it("parses tabs and bare read chapter routes", () => {
    expect(parseReadChapterPathname("/(tabs)/read/ACT/9")).toEqual({
      bookId: "ACT",
      chapter: 9,
    });
    expect(parseReadChapterPathname("/read/mat/8")).toEqual({
      bookId: "MAT",
      chapter: 8,
    });
  });

  it("rejects non-chapter paths", () => {
    expect(parseReadChapterPathname("/(tabs)/read/plan-play")).toBeNull();
    expect(parseReadChapterPathname("/(tabs)/read/catalog")).toBeNull();
  });
});

describe("resolveChapterPageScripturePlayTarget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActiveReadChapterPlayback.mockReturnValue(null);
    mocks.getPlayingReadChapterPlayback.mockReturnValue(null);
    mocks.getScripturePlayingChapter.mockReturnValue({
      bookId: "ACT",
      chapter: 9,
      translationId: "cuv-simp",
    });
  });

  it("uses route chapter even when browse is still the plan track", () => {
    mocks.getActiveReadChapterPlayback.mockReturnValue({
      bookId: "ACT",
      chapter: 9,
      bookName: "使徒行传",
      translationId: "cuv-simp",
    });

    expect(resolveChapterPageScripturePlayTarget("/read/MAT/8")).toEqual({
      bookId: "MAT",
      chapter: 8,
      bookName: "Book:MAT",
      translationId: "cuv-simp",
    });
    expect(mocks.bookNameForId).toHaveBeenCalledWith("MAT");
  });

  it("prefers matching browse bookName and translation", () => {
    mocks.getActiveReadChapterPlayback.mockReturnValue({
      bookId: "MAT",
      chapter: 8,
      bookName: "马太福音",
      translationId: "cuv-simp",
    });

    expect(resolveChapterPageScripturePlayTarget("/(tabs)/read/MAT/8")).toEqual({
      bookId: "MAT",
      chapter: 8,
      bookName: "马太福音",
      translationId: "cuv-simp",
    });
  });

  it("reproduces plan→other chapter→play: route wins over sticky plan browse", () => {
    // 计划 ACT:9 仍写在 browse（卸载保留 / 注册未跟上），用户已在 MAT:8 章页点播放。
    mocks.getActiveReadChapterPlayback.mockReturnValue({
      bookId: "ACT",
      chapter: 9,
      bookName: "使徒行传",
      translationId: "cuv-simp",
    });
    mocks.getScripturePlayingChapter.mockReturnValue({
      bookId: "ACT",
      chapter: 9,
      translationId: "cuv-simp",
    });

    const target = resolveChapterPageScripturePlayTarget("/(tabs)/read/MAT/8", {
      bookId: "MAT",
      chapter: 8,
      translationId: "cuv-simp",
    });

    expect(target).toEqual({
      bookId: "MAT",
      chapter: 8,
      bookName: "Book:MAT",
      translationId: "cuv-simp",
    });
  });
});
