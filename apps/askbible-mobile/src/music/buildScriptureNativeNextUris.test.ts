import { describe, expect, it, vi, beforeEach } from "vitest";

const poolState = { active: false, upcoming: [] as { bookId: string; chapter: number }[] };

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

vi.mock("./scripture-chapter-pool", () => ({
  SCRIPTURE_NATIVE_NEXT_PREFETCH: 10,
  scriptureChapterPool: {
    isActive: () => poolState.active,
    peekUpcoming: (count: number) => poolState.upcoming.slice(0, count),
  },
}));

// 顺章逻辑是纯计算，音频解析的那一串依赖与本测试无关，全部挡掉。
vi.mock("./resolveIosNativeScriptureAssetUri", () => ({
  resolveIosNativeScriptureAssetUri: vi.fn(async () => null),
}));
vi.mock("../bible/read-chapter-audio", () => ({
  resolveScripturePlayableSrcForChapter: vi.fn(async () => null),
}));
vi.mock("../bible/scripture-book-display-name", () => ({
  getScriptureBookDisplayName: vi.fn((bookId: string) => bookId),
}));

import { peekUpcomingScriptureChapters } from "./buildScriptureNativeNextUris";

beforeEach(() => {
  poolState.active = false;
  poolState.upcoming = [];
});

describe("peekUpcomingScriptureChapters", () => {
  it("单章循环不需要队列", () => {
    expect(
      peekUpcomingScriptureChapters({ bookId: "PSA", chapter: 23, repeatMode: "chapter" }),
    ).toEqual([]);
  });

  it("池激活时以池队列为准", () => {
    poolState.active = true;
    poolState.upcoming = [
      { bookId: "JHN", chapter: 2 },
      { bookId: "JHN", chapter: 3 },
    ];
    expect(
      peekUpcomingScriptureChapters({ bookId: "JHN", chapter: 1, repeatMode: "off", count: 2 }),
    ).toEqual([
      { bookId: "JHN", chapter: 2 },
      { bookId: "JHN", chapter: 3 },
    ]);
  });

  // 这是本次修复的核心：非池播放过去拿到的是空队列，锁屏一到章末就断。
  it("非池顺序播放按跨卷顺章推进", () => {
    const out = peekUpcomingScriptureChapters({
      bookId: "GEN",
      chapter: 1,
      repeatMode: "off",
      count: 3,
    });
    expect(out).toEqual([
      { bookId: "GEN", chapter: 2 },
      { bookId: "GEN", chapter: 3 },
      { bookId: "GEN", chapter: 4 },
    ]);
  });

  it("本卷模式在卷内推进，且绕回起点即停止", () => {
    // 犹大书只有 1 章：本卷循环下一章就是自己，队列应为空而不是无限重复。
    expect(
      peekUpcomingScriptureChapters({ bookId: "JUD", chapter: 1, repeatMode: "book", count: 5 }),
    ).toEqual([]);
  });

  it("本卷模式末章回到第 1 章", () => {
    // 腓立比书 4 章：从第 3 章起应是 4、1，然后绕回起点停。
    const out = peekUpcomingScriptureChapters({
      bookId: "PHP",
      chapter: 3,
      repeatMode: "book",
      count: 5,
    });
    expect(out).toEqual([
      { bookId: "PHP", chapter: 4 },
      { bookId: "PHP", chapter: 1 },
      { bookId: "PHP", chapter: 2 },
    ]);
  });

  it("count 为 0 时不产生队列", () => {
    expect(
      peekUpcomingScriptureChapters({ bookId: "GEN", chapter: 1, repeatMode: "off", count: 0 }),
    ).toEqual([]);
  });
});
