import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveEsvChapterAudioDirectUrl,
  translationUsesEsvChapterAudio,
} from "./esv-chapter-audio";

describe("esv-chapter-audio", () => {
  const originalKey = process.env.ESV_API_KEY;

  beforeEach(() => {
    process.env.ESV_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.ESV_API_KEY = originalKey;
    vi.unstubAllGlobals();
  });

  it("only claims the ESV translation", () => {
    expect(translationUsesEsvChapterAudio("esv")).toBe(true);
    expect(translationUsesEsvChapterAudio("ESV")).toBe(true);
    expect(translationUsesEsvChapterAudio("web-en")).toBe(false);
    expect(translationUsesEsvChapterAudio("niv")).toBe(false);
    expect(translationUsesEsvChapterAudio("")).toBe(false);
  });

  it("reads the direct mp3 URL out of Crossway's 302 without downloading the audio", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(null, {
        status: 302,
        headers: { location: "https://audio.esv.org/hw/John%205.mp3" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const src = await resolveEsvChapterAudioDirectUrl({ bookId: "JHN", chapter: 5 });
    expect(src).toBe("https://audio.esv.org/hw/John%205.mp3");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.esv.org/v3/passage/audio/?q=John%205");
    // 跟随重定向会把整个 mp3 拉到我们服务器上，必须保持 manual。
    expect(init?.redirect).toBe("manual");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Token test-key");
  });

  it("returns null without an API key instead of calling Crossway", async () => {
    process.env.ESV_API_KEY = "";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await resolveEsvChapterAudioDirectUrl({ bookId: "JHN", chapter: 5 })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unknown books and bad chapter numbers before spending API quota", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await resolveEsvChapterAudioDirectUrl({ bookId: "ZZZ", chapter: 1 })).toBeNull();
    expect(await resolveEsvChapterAudioDirectUrl({ bookId: "JHN", chapter: 0 })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores a non-https redirect target", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(null, { status: 302, headers: { location: "http://audio.esv.org/x.mp3" } }),
      ),
    );
    expect(await resolveEsvChapterAudioDirectUrl({ bookId: "GEN", chapter: 1 })).toBeNull();
  });
});
