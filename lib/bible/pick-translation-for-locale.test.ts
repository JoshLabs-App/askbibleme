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

describe("pickTranslationIdForLocale", () => {
  it("uses KJV as the default English translation even when WEBP appears first", () => {
    expect(pickTranslationIdForLocale(index, "en")).toBe("kjv");
  });
});
