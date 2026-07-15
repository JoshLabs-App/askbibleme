import { describe, expect, it } from "vitest";
import { resolveCorrespondingChapterAudioTranslationId } from "./resolve-corresponding-chapter-audio-translation";

describe("chapter audio translation correspondence", () => {
  it("keeps KJV as the target instead of falling back to WEB", () => {
    expect(resolveCorrespondingChapterAudioTranslationId("kjv")).toBe("kjv");
  });
});
