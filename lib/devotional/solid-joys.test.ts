import { describe, it, expect } from "vitest";
import {
  DEVOTIONAL_PREF,
  dateFromDevotionalKey,
  devotionalAudioUrl,
  devotionalAvailable,
  devotionalBrief,
  devotionalDateLabel,
  devotionalKey,
  devotionalKeyFromAudioSrc,
  devotionalMatchesQuery,
  groupDevotionalDaysByMonth,
  readDevotionalAuto,
  shouldHandoffDevotional,
  writeDevotionalAuto,
  type DevotionalDay,
} from "./solid-joys";

describe("daily devotional handoff & catalog helpers", () => {
  it("enables Chinese locales and hides English locale", () => {
    expect(devotionalAvailable("zh-CN", true)).toBe(true);
    expect(devotionalAvailable("zh-TW", true)).toBe(true);
    expect(devotionalAvailable("zh-CN", false)).toBe(true);
    expect(devotionalAvailable("zh-TW", false)).toBe(true);
    expect(devotionalAvailable("en", true)).toBe(false);
    expect(devotionalAvailable("en", false)).toBe(false);
  });

  it("uses February 28 for leap day", () => {
    expect(devotionalKey(new Date(2024, 1, 29))).toBe("02-28");
  });

  it("defaults after-reading auto-play to true when unset and respects explicit toggle", () => {
    const store = new Map<string, string>();
    const prev = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
    });
    try {
      expect(store.has(DEVOTIONAL_PREF)).toBe(false);
      expect(readDevotionalAuto()).toBe(true);
      writeDevotionalAuto(false);
      expect(readDevotionalAuto()).toBe(false);
      writeDevotionalAuto(true);
      expect(readDevotionalAuto()).toBe(true);
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: prev,
      });
    }
  });

  it("only hands off at the final chapter of a nonempty queue", () => {
    const queue = [
      { bookId: "GEN", chapter: 1 },
      { bookId: "GEN", chapter: 2 },
    ];
    expect(shouldHandoffDevotional(queue, queue[0]!)).toBe(false);
    expect(shouldHandoffDevotional(queue, queue[1]!)).toBe(true);
    expect(shouldHandoffDevotional([], queue[0]!)).toBe(false);
  });

  it("rejects non-HTTPS audio and extracts devotional key from valid playback URL", () => {
    const day: DevotionalDay = {
      md: "11-09",
      title: "在患难中喜乐",
      verse: "",
      ref: "罗5:3",
      paragraphs: [],
    };
    expect(devotionalAudioUrl({ ...day, audio: "javascript:alert(1)" })).toBeNull();
    const url = devotionalAudioUrl({ ...day, audio: "https://www.befaithful.net/test.mp3" });
    expect(url).toContain("askbibleDevotional=11-09");
    expect(devotionalKeyFromAudioSrc(url ?? "")).toBe("11-09");
    expect(devotionalKeyFromAudioSrc("https://example.com/gen-1.mp3")).toBeNull();
  });

  it("extracts brief from first paragraph or query-matched paragraph and groups by month", () => {
    const sample: DevotionalDay[] = [
      {
        md: "03-15",
        title: "信心的根基",
        verse: "信就是所望之事的实底。",
        ref: "希伯来书 11:1",
        paragraphs: ["第一段讲盼望与应许。", "第二段特别谈到在黑夜里的平安与忍耐。"],
      },
      {
        md: "01-01",
        title: "新年的恩典",
        verse: "然而我今日成了何等人，是蒙神的恩才成的。",
        ref: "林前15:10",
        paragraphs: ["恩典不仅是在我们不配得的时候赐下的好处。"],
      },
    ];

    expect(devotionalDateLabel("01-01")).toBe("1月1日");
    expect(devotionalBrief(sample[0]!)).toBe("第一段讲盼望与应许。");
    expect(devotionalBrief(sample[0]!, "黑夜")).toBe("第二段特别谈到在黑夜里的平安与忍耐。");
    expect(devotionalMatchesQuery(sample[0]!, "希伯来书")).toBe(true);
    expect(devotionalMatchesQuery(sample[1]!, "1月1日")).toBe(true);
    expect(devotionalMatchesQuery(sample[1]!, "不存在的词")).toBe(false);

    const allGroups = groupDevotionalDaysByMonth(sample);
    expect(allGroups.map((g) => g.month)).toEqual([1, 3]);

    const marchOnly = groupDevotionalDaysByMonth(sample, { month: 3 });
    expect(marchOnly).toHaveLength(1);
    expect(marchOnly[0]?.items[0]?.md).toBe("03-15");

    const d = dateFromDevotionalKey("11-21", 2026);
    expect(d.getMonth()).toBe(10);
    expect(d.getDate()).toBe(21);
  });
});
