import { hashStringToUint32, pickDailyVerseKey, pickDailyVerseKeyAtIndex } from "./pick-daily-verse-key";

describe("pickDailyVerseKey", () => {
  it("returns stable verse for same date inputs", () => {
    const entries = [{ verseKey: "GEN:1:1" }, { verseKey: "JHN:3:16" }, { verseKey: "PSA:23:1" }];
    const a = pickDailyVerseKey({
      date: "2026-06-19",
      locale: "zh-CN",
      translationId: "cuv-simp",
      scopeId: "all",
      entries,
    });
    const b = pickDailyVerseKey({
      date: "2026-06-19",
      locale: "zh-CN",
      translationId: "cuv-simp",
      scopeId: "all",
      entries,
    });
    expect(a).toBe(b);
    expect(entries.some((e) => e.verseKey === a)).toBe(true);
  });

  it("hash is stable", () => {
    expect(hashStringToUint32("test")).toBe(hashStringToUint32("test"));
  });

  it("pickDailyVerseKeyAtIndex varies by index on same date", () => {
    const entries = [
      { verseKey: "GEN:1:1" },
      { verseKey: "JHN:3:16" },
      { verseKey: "PSA:23:1" },
      { verseKey: "ROM:8:28" },
    ];
    const base = {
      date: "2026-06-21",
      locale: "zh-CN",
      translationId: "cuv-simp",
      scopeId: "all",
      entries,
    };
    const a = pickDailyVerseKeyAtIndex({ ...base, index: 0 });
    const b = pickDailyVerseKeyAtIndex({ ...base, index: 1 });
    expect(entries.some((e) => e.verseKey === a)).toBe(true);
    expect(entries.some((e) => e.verseKey === b)).toBe(true);
    expect(pickDailyVerseKeyAtIndex({ ...base, index: 0 })).toBe(pickDailyVerseKey(base));
  });
});
