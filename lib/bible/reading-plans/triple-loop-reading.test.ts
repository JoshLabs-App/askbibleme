import { describe, expect, it } from "vitest";
import { getReadingPlanDaySinceEpoch } from "../../read/reading-plan-epoch";
import {
  clipCoordinatedTripleLoopAheadToPlanDay,
  createDefaultTripleLoopReadingState,
  normalizeTripleLoopReadingState,
  snapTripleLoopStateToPlanDay,
  tripleLoopStateForPlanDay,
} from "./triple-loop-reading";

describe("snapTripleLoopStateToPlanDay", () => {
  it("lifts stale pointers to the calendar day so yesterday does not linger", () => {
    const day131 = tripleLoopStateForPlanDay(131);
    const day136 = tripleLoopStateForPlanDay(136);
    const snapped = snapTripleLoopStateToPlanDay(day131, 136);

    expect(day131).toMatchObject({
      nt: { bookId: "ROM", chapter: 14 },
      wisdom: { bookId: "PSA", chapter: 89 },
      ot: { bookId: "NUM", chapter: 14 },
    });
    expect(snapped).toMatchObject({
      nt: { bookId: day136.nt.bookId, chapter: day136.nt.chapter },
      wisdom: { bookId: day136.wisdom.bookId, chapter: day136.wisdom.chapter },
      ot: { bookId: day136.ot.bookId, chapter: day136.ot.chapter },
    });
    expect(snapped).not.toMatchObject({
      nt: { bookId: "ROM", chapter: 14 },
      ot: { bookId: "NUM", chapter: 14 },
    });
  });

  it("keeps a track that is already ahead of the calendar floor", () => {
    const calendar = tripleLoopStateForPlanDay(10);
    const aheadNt = {
      ...createDefaultTripleLoopReadingState(),
      ot: calendar.ot,
      nt: { bookId: "MAT", chapter: 20 },
      wisdom: calendar.wisdom,
    };
    const snapped = snapTripleLoopStateToPlanDay(aheadNt, 10);
    expect(snapped.nt).toEqual({ bookId: "MAT", chapter: 20 });
    expect(snapped.ot).toEqual(calendar.ot);
    expect(snapped.wisdom).toEqual(calendar.wisdom);
  });

  it("keeps chaptersReadKeys when snapping forward", () => {
    const stale = {
      ...tripleLoopStateForPlanDay(2),
      chaptersReadKeys: { ot: ["GEN:1"], nt: ["MAT:1"], wisdom: ["JOB:1"] },
    };
    const snapped = snapTripleLoopStateToPlanDay(stale, 5);
    expect(snapped.chaptersReadKeys).toEqual({
      ot: ["GEN:1"],
      nt: ["MAT:1"],
      wisdom: ["JOB:1"],
    });
  });
});

describe("clipCoordinatedTripleLoopAheadToPlanDay", () => {
  it("pulls three tracks back when they jumped ahead together", () => {
    const stuck = tripleLoopStateForPlanDay(161);
    const today = tripleLoopStateForPlanDay(137);
    const clipped = clipCoordinatedTripleLoopAheadToPlanDay(stuck, 137);

    expect(clipped).toMatchObject({
      nt: { bookId: today.nt.bookId, chapter: today.nt.chapter },
      wisdom: { bookId: today.wisdom.bookId, chapter: today.wisdom.chapter },
      ot: { bookId: today.ot.bookId, chapter: today.ot.chapter },
    });
    expect(stuck).toMatchObject({
      nt: { bookId: "2CO", chapter: 12 },
      wisdom: { bookId: "PSA", chapter: 119 },
      ot: { bookId: "DEU", chapter: 8 },
    });
  });

  it("keeps a single track that is ahead of the others", () => {
    const calendar = tripleLoopStateForPlanDay(137);
    const aheadNt = {
      ...createDefaultTripleLoopReadingState(),
      ot: calendar.ot,
      nt: { bookId: "2CO", chapter: 12 },
      wisdom: calendar.wisdom,
    };
    const clipped = clipCoordinatedTripleLoopAheadToPlanDay(aheadNt, 137);
    expect(clipped.nt).toEqual({ bookId: "2CO", chapter: 12 });
    expect(clipped.ot).toEqual(calendar.ot);
    expect(clipped.wisdom).toEqual(calendar.wisdom);
  });
});

describe("triple-loop calendar day", () => {
  it("Aug 19 2026 is day 137 = 1 Corinthians 4, not yesterday's chapter 3", () => {
    const day = getReadingPlanDaySinceEpoch(new Date(2026, 7, 19));
    expect(day).toBe(137);
    expect(tripleLoopStateForPlanDay(136).nt).toEqual({ bookId: "1CO", chapter: 3 });
    expect(tripleLoopStateForPlanDay(day).nt).toEqual({ bookId: "1CO", chapter: 4 });
  });
});

/**
 * 「读了几章」只有一个存放处：章名列表。计数是数出来的。
 *
 * 这条规则手机侧一直有，网页侧的归一化却把存档里的计数单独留着——两者能对不上，
 * 而这份状态正是两端互相同步的，于是同一个账号在两台设备上会显示不同的进度数字。
 */
describe("normalizeTripleLoopReadingState 的章数", () => {
  it("按列表长度算，不信存档里的计数", () => {
    const state = normalizeTripleLoopReadingState({
      chaptersReadKeys: { ot: ["GEN:1", "GEN:2"], nt: ["MAT:1"], wisdom: [] },
      chaptersRead: { ot: 99, nt: 0, wisdom: 42 },
    });
    expect(state.chaptersRead).toEqual({ ot: 2, nt: 1, wisdom: 0 });
  });

  it("列表为空就是零，哪怕存档说读过", () => {
    const state = normalizeTripleLoopReadingState({ chaptersRead: { ot: 7, nt: 7, wisdom: 7 } });
    expect(state.chaptersRead).toEqual({ ot: 0, nt: 0, wisdom: 0 });
  });

  /** 重复的章名不该被数两次。 */
  it("同一章记两次只算一次", () => {
    const state = normalizeTripleLoopReadingState({
      chaptersReadKeys: { ot: ["GEN:1", "GEN:1", "GEN:2"], nt: [], wisdom: [] },
    });
    expect(state.chaptersRead.ot).toBe(2);
  });
});
