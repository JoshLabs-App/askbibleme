import { describe, expect, it } from "vitest";
import { parseGoldenVerseKeyFromAudioUri } from "./parseGoldenVerseKeyFromAudioUri";

/**
 * 原生静默接上下一句之后，JS 只能从音轨 URI 认出「现在读的是哪一句」。
 * 认不出来的后果不是报错，是**又抽一句重开**——所以这里的返回值必须和轮播用的
 * key 完全同形（点分大写），否则比较永远不相等。
 */
describe("parseGoldenVerseKeyFromAudioUri", () => {
  it("returns the dotted key the rotation uses", () => {
    expect(
      parseGoldenVerseKeyFromAudioUri("https://cdn/golden-verses/EPH-6-18-32kbps.mp3"),
    ).toBe("EPH.6.18");
    expect(parseGoldenVerseKeyFromAudioUri("file:///cache/PSA-121-2-32kbps.mp3")).toBe("PSA.121.2");
  });

  it("keeps multi-part book ids together", () => {
    expect(parseGoldenVerseKeyFromAudioUri("file:///c/1CO-13-4-32kbps.mp3")).toBe("1CO.13.4");
  });

  it("ignores anything that is not a golden-verse asset", () => {
    expect(parseGoldenVerseKeyFromAudioUri("file:///cache/cuv/GEN-1.mp3")).toBeNull();
    expect(parseGoldenVerseKeyFromAudioUri("")).toBeNull();
    expect(parseGoldenVerseKeyFromAudioUri(null)).toBeNull();
  });

  it("drops a query string before parsing", () => {
    expect(parseGoldenVerseKeyFromAudioUri("https://cdn/JAS-1-19-32kbps.mp3?v=2")).toBe("JAS.1.19");
  });
});
