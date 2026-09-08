import { beforeEach, describe, expect, it } from "vitest";
import {
  clearScriptureQueueChapterMap,
  lookupScriptureQueueChapter,
  rememberScriptureQueueChapter,
} from "./scriptureQueueChapterMap";

/**
 * 这张表存在的意义：原生接播下一章后，JS 靠它知道那是哪一章。
 *
 * 以前 JS 是照着原生同一套规则**再推演一遍**下一章是谁，两处独立推演同一件事，
 * 不一致时没人发现，界面章号就和音轨错开（2026-09-08 真机复现）。
 */
describe("scriptureQueueChapterMap", () => {
  beforeEach(() => clearScriptureQueueChapterMap());

  it("returns the chapter that was queued under a uri", () => {
    rememberScriptureQueueChapter("file:///cache/cuv/GEN-2.mp3", {
      bookId: "GEN",
      chapter: 2,
      translationId: "cuv-simp",
    });

    expect(lookupScriptureQueueChapter("file:///cache/cuv/GEN-2.mp3")).toEqual({
      bookId: "GEN",
      chapter: 2,
      translationId: "cuv-simp",
    });
  });

  it("has no answer for a uri it never queued", () => {
    expect(lookupScriptureQueueChapter("file:///cache/cuv/EXO-1.mp3")).toBeNull();
    expect(lookupScriptureQueueChapter(null)).toBeNull();
    expect(lookupScriptureQueueChapter("")).toBeNull();
  });

  /** 同一条音频会被重复排入（整卷循环），后写的覆盖先写的。 */
  it("keeps the most recent chapter for a repeated uri", () => {
    const uri = "file:///cache/cuv/PSA-1.mp3";
    rememberScriptureQueueChapter(uri, { bookId: "PSA", chapter: 1, translationId: "a" });
    rememberScriptureQueueChapter(uri, { bookId: "PSA", chapter: 1, translationId: "b" });

    expect(lookupScriptureQueueChapter(uri)?.translationId).toBe("b");
  });

  it("ignores blank uris", () => {
    rememberScriptureQueueChapter("   ", { bookId: "GEN", chapter: 1, translationId: "x" });
    expect(lookupScriptureQueueChapter("   ")).toBeNull();
  });
});
