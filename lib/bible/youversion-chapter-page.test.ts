import { describe, expect, it, vi } from "vitest";
import {
  loadYouVersionChapterRowsFromPage,
  parseYouVersionChapterContent,
  parseYouVersionChapterPageHtml,
  stripYouVersionNoteNodes,
  truncateYouVersionRscTail,
} from "./youversion-chapter-page";

const CHAPTER_HTML = [
  '<div class="chapter ch1" data-usfm="MAT.1">',
  '<span class="verse v1" data-usfm="MAT.1.1"><span class="label">1</span><span class="content">第一节</span></span>',
  '<span class="verse v2" data-usfm="MAT.1.2"><span class="label">2</span><span class="content">第二节</span></span>',
  "</div>",
].join("");

describe("youversion-chapter-page", () => {
  it("parses verse spans", () => {
    expect(parseYouVersionChapterContent(CHAPTER_HTML)).toEqual([
      { verse: 1, text: "第一节" },
      { verse: 2, text: "第二节" },
    ]);
  });

  it("parses CSS-module verse spans", () => {
    const html = [
      '<div class="ChapterContent-module__x__verse" data-usfm="MAT.1.1"><span class="label">1</span><span class="content">第一节</span></div>',
      '<div class="ChapterContent-module__x__verse" data-usfm="MAT.1.2"><span class="label">2</span><span class="content">第二节</span></div>',
    ].join("");
    expect(parseYouVersionChapterContent(html)).toEqual([
      { verse: 1, text: "第一节" },
      { verse: 2, text: "第二节" },
    ]);
  });

  it("loads current React Flight chapter payloads", async () => {
    const flight = `<script>self.__next_f.push([1,${JSON.stringify(CHAPTER_HTML)}])</script>`;
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => flight }));
    (globalThis as any).fetch = fetchMock;

    await expect(
      loadYouVersionChapterRowsFromPage({
        translationId: "rcuvss-zh-hans",
        bookId: "MAT",
        chapter: 1,
      }),
    ).resolves.toEqual([
      { verse: 1, text: "第一节" },
      { verse: 2, text: "第二节" },
    ]);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("can load text-only YouVersion ids without audio-page mapping", async () => {
    const flight = `<script>self.__next_f.push([1,${JSON.stringify(CHAPTER_HTML)}])</script>`;
    const fetchMock = vi.fn(async (_input: string) => ({ ok: true, text: async () => flight }));
    (globalThis as any).fetch = fetchMock;

    await expect(
      loadYouVersionChapterRowsFromPage({
        translationId: "mandarin-zh-hans",
        bookId: "MAT",
        chapter: 1,
        remoteId: "3780",
      }),
    ).resolves.toEqual([
      { verse: 1, text: "第一节" },
      { verse: 2, text: "第二节" },
    ]);
    expect(String(fetchMock.mock.calls[0]?.[0] ?? "")).toContain("/bible/3780/");
  });

  it("strips YouVersion note / xref markers from verse text", () => {
    const html = [
      '<div class="ChapterContent_verse" data-usfm="GEN.40.21">',
      '<span class="ChapterContent_label">21</span>',
      '<span class="ChapterContent_content">He restored the chief cupbearer</span>',
      '<span class="ChapterContent__note ChapterContent__x">',
      '<span class="ChapterContent__label">#</span>',
      '<span class="ChapterContent__body"><span class="xta">ver. </span><span class="ref">13</span></span>',
      "</span>",
      '<span class="ChapterContent_content"> to his position</span>',
      "</div>",
    ].join("");
    expect(parseYouVersionChapterContent(html)).toEqual([
      { verse: 21, text: "He restored the chief cupbearer to his position" },
    ]);
    expect(stripYouVersionNoteNodes(html)).not.toContain("__note");
  });

  it("truncates RSC / Flight tails glued after last verse", () => {
    const payload = [
      '<div class="ChapterContent_verse" data-usfm="GEN.40.23">',
      '<span class="ChapterContent_label">23</span>',
      '<span class="ChapterContent_content">Yet the chief cupbearer did not remember Joseph, but forgot him.</span>',
      "</div>",
      '83:["$","$L84",null,{"analyticsUsfmRef":"GEN.40","pageProps":{"title":"Bible"}}]',
      '["$","meta","12",{"name":"fb:app_id","content":"117344358296665"}]',
    ].join("");
    expect(truncateYouVersionRscTail(payload)).not.toContain("analyticsUsfmRef");
    expect(parseYouVersionChapterPageHtml(`<script>self.__next_f.push([1,${JSON.stringify(payload)}])</script>`)).toEqual([
      {
        verse: 23,
        text: "Yet the chief cupbearer did not remember Joseph, but forgot him.",
      },
    ]);
  });
});
