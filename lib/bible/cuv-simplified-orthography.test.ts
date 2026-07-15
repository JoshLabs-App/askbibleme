import { describe, expect, it } from "vitest";
import {
  findLegacyCuvSimplifiedOrthography,
  normalizeCuvSimplifiedOrthography,
} from "./cuv-simplified-orthography.mjs";

describe("CUV simplified orthography", () => {
  it("uses modern simplified forms without changing the sentence", () => {
    expect(
      normalizeCuvSimplifiedOrthography(
        "就是二十两银子的饼，叫他们各人吃一点也是不彀的。",
      ),
    ).toBe("就是二十两银子的饼，叫他们各人吃一点也是不够的。");
    expect(normalizeCuvSimplifiedOrthography("痲疯、繙译、窗櫺、餽送、牠们"))
      .toBe("麻疯、翻译、窗棂、馈送、它们");
  });

  it("only modernizes 相彷 and keeps 彷徨 intact", () => {
    expect(normalizeCuvSimplifiedOrthography("相彷，彷徨"))
      .toBe("相仿，彷徨");
  });

  it("reports every remaining legacy form", () => {
    expect(findLegacyCuvSimplifiedOrthography("彀彀摀口")).toEqual([
      { legacy: "彀", modern: "够", count: 2 },
      { legacy: "摀", modern: "捂", count: 1 },
    ]);
  });
});
