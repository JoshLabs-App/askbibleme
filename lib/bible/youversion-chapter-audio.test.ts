import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildYouVersionAudioPageUrl,
  isYouVersionAudioWebProxyRuntime,
  resolveYouVersionChapterAudioPlayableSrc,
  translationHasVerifiedYouVersionChapterAudio,
  translationUsesYouVersionChapterAudio,
} from "./youversion-chapter-audio";

describe("youversion-chapter-audio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not mistake React Native's window global for a DOM browser", () => {
    expect(isYouVersionAudioWebProxyRuntime({ window: globalThis })).toBe(false);
    expect(isYouVersionAudioWebProxyRuntime({ window: globalThis, document: {} })).toBe(true);
  });

  it("recognizes rcuvss as a YouVersion audio translation", () => {
    expect(translationUsesYouVersionChapterAudio("rcuvss-zh-hans")).toBe(true);
    expect(translationUsesYouVersionChapterAudio("esv")).toBe(true);
    expect(translationUsesYouVersionChapterAudio("cunp-zh-hant")).toBe(true);
    expect(translationHasVerifiedYouVersionChapterAudio("rcuvss-zh-hans")).toBe(true);
    expect(translationHasVerifiedYouVersionChapterAudio("cunp-zh-hant")).toBe(true);
  });

  it("builds the expected Bible.com audio page URL", () => {
    expect(
      buildYouVersionAudioPageUrl({
        translationId: "rcuvss-zh-hans",
        bookId: "MAT",
        chapter: 13,
      }),
    ).toBe("https://www.bible.com/audio-bible/140/MAT.13.RCUVSS");
  });

  it("uses the official audio edition for simplified CUNPSS", () => {
    expect(
      buildYouVersionAudioPageUrl({
        translationId: "cunpss-zh-hans",
        bookId: "EPH",
        chapter: 5,
      }),
    ).toBe("https://www.bible.com/audio-bible/48/EPH.5.CUNPSS-Shen");
  });

  it("uses current Bible.com abbreviations for NIV and traditional CCB", () => {
    expect(
      buildYouVersionAudioPageUrl({ translationId: "niv", bookId: "JHN", chapter: 1 }),
    ).toBe("https://www.bible.com/audio-bible/111/JHN.1.NIV");
    expect(
      buildYouVersionAudioPageUrl({ translationId: "ccb-zh-hant", bookId: "JHN", chapter: 1 }),
    ).toBe("https://www.bible.com/audio-bible/1392/JHN.1.CCB");
  });

  it("extracts a playable mp3 URL from the chapter page HTML", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () =>
        [
          "<html><script>",
          '"audioChapterInfo":{"format_mp3_32k":"//audio-bible-cdn.youversionapi.com/46/32k/MAT/13-test.mp3?version_id=140"}',
          "</script></html>",
        ].join(""),
    }));
    (globalThis as any).fetch = fetchMock;

    const result = await resolveYouVersionChapterAudioPlayableSrc({
      translationId: "rcuvss-zh-hans",
      bookId: "MAT",
      chapter: 13,
    });

    expect(result).toEqual({
      ok: true,
      src: "https://audio-bible-cdn.youversionapi.com/46/32k/MAT/13-test.mp3?version_id=140",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.bible.com/zh-CN/audio-bible/140/MAT.13.RCUVSS",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "text/html,application/xhtml+xml",
        }),
      }),
    );
  });

  it("extracts a playable mp3 URL from schema.org contentUrl", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () =>
        '<script type="application/ld+json">{"contentUrl":"https://audio-bible-cdn.youversionapi.com/3/32k/JHN/2-test.mp3?version_id=111"}</script>',
    }));
    (globalThis as any).fetch = fetchMock;

    const result = await resolveYouVersionChapterAudioPlayableSrc({
      translationId: "niv",
      bookId: "JHN",
      chapter: 2,
    });

    expect(result).toEqual({
      ok: true,
      src: "https://audio-bible-cdn.youversionapi.com/3/32k/JHN/2-test.mp3?version_id=111",
    });
  });

  it("extracts the current api-cdn URL when the page escapes slashes", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () =>
        '<script>"format_mp3_32k":"https:\\/\\/api-cdn.youversionapi.com\\/audio-bible-youversionapi\\/123\\/32k\\/MAT\\/13-hash.mp3?version_id=59"</script>',
    }));
    (globalThis as any).fetch = fetchMock;

    const result = await resolveYouVersionChapterAudioPlayableSrc({
      translationId: "esv",
      bookId: "MAT",
      chapter: 13,
    });

    expect(result).toEqual({
      ok: true,
      src: "https://api-cdn.youversionapi.com/audio-bible-youversionapi/123/32k/MAT/13-hash.mp3?version_id=59",
    });
  });
});
