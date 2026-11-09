import { describe, it, expect } from "vitest";
import { devotionalAvailable, devotionalKey, shouldHandoffDevotional, devotionalAudioUrl } from "./solid-joys";

describe("daily devotional handoff", () => {
  it("preserves Chinese administrator access", () => {
    expect(devotionalAvailable("zh-CN", true)).toBe(true);
    expect(devotionalAvailable("zh-TW", true)).toBe(true);
    expect(devotionalAvailable("en", true)).toBe(false);
    expect(devotionalAvailable("zh-CN", false)).toBe(false);
  });
  it("uses February 28 for leap day", () => {
    expect(devotionalKey(new Date(2024, 1, 29))).toBe("02-28");
  });
  it("only hands off at the final chapter of a nonempty queue", () => {
    const queue = [{ bookId: "GEN", chapter: 1 }, { bookId: "GEN", chapter: 2 }];
    expect(shouldHandoffDevotional(queue, queue[0])).toBe(false);
    expect(shouldHandoffDevotional(queue, queue[1])).toBe(true);
    expect(shouldHandoffDevotional([], queue[0])).toBe(false);
  });
  it("rejects non-HTTPS audio and marks valid devotional playback", () => {
    const day = { md: "11-09", title: "", verse: "", ref: "", paragraphs: [] };
    expect(devotionalAudioUrl({ ...day, audio: "javascript:alert(1)" })).toBeNull();
    expect(devotionalAudioUrl({ ...day, audio: "https://www.befaithful.net/test.mp3" })).toContain("askbibleDevotional=11-09");
  });
});
