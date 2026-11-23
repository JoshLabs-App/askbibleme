import { describe, expect, it } from "vitest";
import { pickTranslationIdForLocale } from "./pick-translation-for-locale";

const index = {
  translations: [
    { id: "web-en", language: "en" },
    { id: "kjv", language: "en" },
    { id: "cuv-simp", language: "zh-Hans" },
  ],
  defaultTranslationId: "cuv-simp",
} as never;

const alphabeticalCatalogIndex = {
  translations: [
    { id: "asv", language: "en" },
    { id: "cbs-zh", language: "zh-Hans" },
    { id: "ccb-zh-hans", language: "zh-Hans" },
    { id: "ccb-zh-hant", language: "zh-Hant" },
    { id: "cuv-simp", language: "zh-Hans" },
    { id: "cuv-trad", language: "zh-Hant" },
    { id: "kjv", language: "en" },
    { id: "web-en", language: "en" },
  ],
  defaultTranslationId: "cbs-zh",
} as never;

describe("pickTranslationIdForLocale", () => {
  it("uses WEB as the default English translation even when KJV appears later", () => {
    expect(pickTranslationIdForLocale(index, "en")).toBe("web-en");
  });

  it("prefers cuv-simp for zh-CN even when cbs-zh appears earlier", () => {
    expect(pickTranslationIdForLocale(alphabeticalCatalogIndex, "zh-CN")).toBe("cuv-simp");
  });

  it("prefers cuv-trad for zh-TW even when ccb-zh-hant appears earlier", () => {
    expect(pickTranslationIdForLocale(alphabeticalCatalogIndex, "zh-TW")).toBe("cuv-trad");
  });

  it("falls back in priority order when preferred CUV ids are absent", () => {
    const noCuvSimp = {
      translations: [
        { id: "cbs-zh", language: "zh-Hans" },
        { id: "cuv-trad", language: "zh-Hant" },
      ],
      defaultTranslationId: "cbs-zh",
    } as never;
    expect(pickTranslationIdForLocale(noCuvSimp, "zh-CN")).toBe("cbs-zh");

    const onlyTrad = {
      translations: [
        { id: "ccb-zh-hant", language: "zh-Hant" },
        { id: "cuv-trad", language: "zh-Hant" },
      ],
      defaultTranslationId: "ccb-zh-hant",
    } as never;
    expect(pickTranslationIdForLocale(onlyTrad, "zh-CN")).toBe("cuv-trad");

    const noCuvTrad = {
      translations: [
        { id: "ccb-zh-hant", language: "zh-Hant" },
        { id: "cuv-simp", language: "zh-Hans" },
      ],
      defaultTranslationId: "ccb-zh-hant",
    } as never;
    expect(pickTranslationIdForLocale(noCuvTrad, "zh-TW")).toBe("ccb-zh-hant");

    const onlySimp = {
      translations: [
        { id: "cbs-zh", language: "zh-Hans" },
        { id: "cuv-simp", language: "zh-Hans" },
      ],
      defaultTranslationId: "cbs-zh",
    } as never;
    expect(pickTranslationIdForLocale(onlySimp, "zh-TW")).toBe("cuv-simp");
  });
});
