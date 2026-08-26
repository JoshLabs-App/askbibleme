import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readCuvChapterAudioVoice: vi.fn(async () => "mandarin" as const),
  resolveScriptureBundledModule: vi.fn(() => null as number | null),
  warmBundledScriptureChapterAudioUri: vi.fn(async () => null as string | null),
  resolveDownloadedChapterAudioUri: vi.fn(async () => null as string | null),
  resolveStreamCachedChapterAudioUri: vi.fn(async () => null as string | null),
  downloadChapterAudioToCache: vi.fn(
    () =>
      new Promise<string | null>(() => {
        /* hang: first play must not wait for full download */
      }),
  ),
  scheduleChapterAudioBackgroundCache: vi.fn(),
  resolveScripturePlayableSrcForChapter: vi.fn(async () => "https://media.fhl.net/unvdavid/46/46_007.mp3"),
  isMobileScriptureAudioStreamAllowed: vi.fn(() => true),
  getScriptureBookDisplayName: vi.fn(() => "哥林多前书"),
}));

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

vi.mock("../audio/scriptureAudioPlayback", () => ({
  resolveScriptureBundledModule: mocks.resolveScriptureBundledModule,
  warmBundledScriptureChapterAudioUri: mocks.warmBundledScriptureChapterAudioUri,
}));

vi.mock("../audio/shellMusicPlayableAssetUri", () => ({
  normalizeShellMusicFileUri: (uri: string) => uri,
}));

vi.mock("../bible/cuv-chapter-audio-voice-prefs", () => ({
  readCuvChapterAudioVoice: mocks.readCuvChapterAudioVoice,
}));

vi.mock("../bible/scripture-book-display-name", () => ({
  getScriptureBookDisplayName: mocks.getScriptureBookDisplayName,
}));

vi.mock("../bible/read-chapter-audio", () => ({
  resolveScripturePlayableSrcForChapter: mocks.resolveScripturePlayableSrcForChapter,
}));

vi.mock("../config/mobileBundledOnly", () => ({
  isMobileScriptureAudioStreamAllowed: mocks.isMobileScriptureAudioStreamAllowed,
}));

vi.mock("../read/read-audio-package-download", () => ({
  downloadChapterAudioToCache: mocks.downloadChapterAudioToCache,
  scheduleChapterAudioBackgroundCache: mocks.scheduleChapterAudioBackgroundCache,
}));

vi.mock("../read/readAudioPackageDownloadPaths", () => ({
  resolveDownloadedChapterAudioUri: mocks.resolveDownloadedChapterAudioUri,
}));

vi.mock("../read/readChapterAudioStreamCache", () => ({
  resolveStreamCachedChapterAudioUri: mocks.resolveStreamCachedChapterAudioUri,
}));

import { resolveIosNativeScriptureAssetUri } from "./resolveIosNativeScriptureAssetUri";

describe("resolveIosNativeScriptureAssetUri", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isMobileScriptureAudioStreamAllowed.mockReturnValue(true);
    mocks.resolveDownloadedChapterAudioUri.mockResolvedValue(null);
    mocks.resolveStreamCachedChapterAudioUri.mockResolvedValue(null);
    mocks.resolveScriptureBundledModule.mockReturnValue(null);
  });

  it("returns HTTPS immediately and does not wait for the whole file", async () => {
    const remote = "https://media.fhl.net/unvdavid/46/46_007.mp3";
    const result = await Promise.race([
      resolveIosNativeScriptureAssetUri({
        src: remote,
        translationId: "cuv-simp",
        bookId: "1CO",
        chapter: 7,
        voiceId: "mandarin",
      }),
      new Promise<string>((resolve) => {
        setTimeout(() => resolve("TIMEOUT"), 80);
      }),
    ]);

    expect(result).toBe(remote);
    expect(mocks.downloadChapterAudioToCache).not.toHaveBeenCalled();
    expect(mocks.scheduleChapterAudioBackgroundCache).toHaveBeenCalledWith({
      translationId: "cuv-simp",
      voiceId: "mandarin",
      bookId: "1CO",
      chapter: 7,
      remoteSrc: remote,
    });
  });

  it("resolves a remote URL when the pool src is still empty", async () => {
    const result = await resolveIosNativeScriptureAssetUri({
      src: "",
      translationId: "cuv-simp",
      bookId: "1CO",
      chapter: 7,
      voiceId: "mandarin",
    });
    expect(result).toBe("https://media.fhl.net/unvdavid/46/46_007.mp3");
    expect(mocks.resolveScripturePlayableSrcForChapter).toHaveBeenCalled();
  });

  it("prefers an already-downloaded local file over streaming", async () => {
    mocks.resolveDownloadedChapterAudioUri.mockResolvedValue("file:///1CO-7.mp3");
    const result = await resolveIosNativeScriptureAssetUri({
      src: "https://media.fhl.net/unvdavid/46/46_007.mp3",
      translationId: "cuv-simp",
      bookId: "1CO",
      chapter: 7,
      voiceId: "mandarin",
    });
    expect(result).toBe("file:///1CO-7.mp3");
    expect(mocks.scheduleChapterAudioBackgroundCache).not.toHaveBeenCalled();
  });
});
