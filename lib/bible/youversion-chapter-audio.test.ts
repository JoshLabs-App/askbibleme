import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildYouVersionAudioPageUrl,
  resolveYouVersionChapterAudioPlayableSrc,
  translationUsesYouVersionChapterAudio,
} from "./youversion-chapter-audio";

describe("youversion-chapter-audio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recognizes rcuvss as a YouVersion audio translation", () => {
    expect(translationUsesYouVersionChapterAudio("rcuvss-zh-hans")).toBe(true);
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
      "https://www.bible.com/audio-bible/140/MAT.13.RCUVSS",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "text/html,application/xhtml+xml",
        }),
      }),
    );
  });
});
