import { describe, expect, it, vi, beforeEach } from "vitest";
import { resolveTodayPlanScriptureStartTarget } from "./today-plan-scripture-resume";

vi.mock("./reading-plan/today-reading-done", () => ({
  resolveLocalTodayReadingScopeKey: vi.fn(async () => "plan-a:day:12"),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";

const queue = [
  { bookId: "GEN", chapter: 1 },
  { bookId: "GEN", chapter: 2 },
  { bookId: "EXO", chapter: 1 },
];

describe("resolveTodayPlanScriptureStartTarget", () => {
  beforeEach(() => {
    vi.mocked(AsyncStorage.getItem).mockReset();
  });

  it("starts at first chapter when no saved resume", async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    const start = await resolveTodayPlanScriptureStartTarget(queue);
    expect(start).toEqual({ target: { bookId: "GEN", chapter: 1 }, startAtSec: 0 });
  });

  it("resumes same scope at saved chapter and position", async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(
      JSON.stringify({
        version: 1,
        scopeKey: "plan-a:day:12",
        bookId: "GEN",
        chapter: 2,
        positionSec: 93.5,
        updatedAt: 1,
      }),
    );
    const start = await resolveTodayPlanScriptureStartTarget(queue);
    expect(start).toEqual({ target: { bookId: "GEN", chapter: 2 }, startAtSec: 93.5 });
  });

  it("ignores resume from a different scope key", async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(
      JSON.stringify({
        version: 1,
        scopeKey: "plan-a:day:11",
        bookId: "GEN",
        chapter: 2,
        positionSec: 40,
        updatedAt: 1,
      }),
    );
    const start = await resolveTodayPlanScriptureStartTarget(queue);
    expect(start).toEqual({ target: { bookId: "GEN", chapter: 1 }, startAtSec: 0 });
  });
});
