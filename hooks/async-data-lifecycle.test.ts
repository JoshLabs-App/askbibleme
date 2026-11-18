import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  values: [] as unknown[], refs: [] as { current: unknown }[],
  effects: [] as (() => void | (() => void))[], index: 0, refIndex: 0,
  prefs: { version: 1, planId: "first", anchor: "calendar-jan1", dayCount: 365 },
  load: vi.fn(),
}));

// Isolate asynchronous effect lifetimes; a render and its cleanup are controlled
// explicitly so network responses can arrive in the reverse of their start order.
vi.mock("react", () => ({
  useState: (initial: unknown) => {
    const i = state.index++;
    if (!(i in state.values)) state.values[i] = typeof initial === "function" ? initial() : initial;
    return [state.values[i], (next: unknown) => {
      state.values[i] = typeof next === "function" ? next(state.values[i]) : next;
    }];
  },
  useRef: (initial: unknown) => state.refs[state.refIndex++] ??= { current: initial },
  useEffect: (effect: () => void | (() => void)) => { state.effects.push(effect); },
  useMemo: (fn: () => unknown) => fn(),
  useCallback: (fn: unknown) => fn,
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
}));
vi.mock("@/lib/read/reading-plan-prefs", () => ({
  getEffectiveReadingPlanPrefsSnapshot: () => state.prefs,
  getEffectiveReadingPlanPrefsServerSnapshot: () => state.prefs,
  subscribeReadingPlanPrefs: vi.fn(),
  resolveReadingPlanDayIndex: () => 0,
}));
vi.mock("@/lib/read/triple-loop-progress", () => ({
  getTripleLoopProgressSnapshot: () => ({}),
  getTripleLoopProgressServerSnapshot: () => ({}),
  subscribeTripleLoopProgress: vi.fn(),
}));
vi.mock("@/lib/read/reading-plan-ahead", () => ({
  readAheadDays: () => 0,
  resolveEffectiveEpochDay: () => 1,
  resolveEffectiveReadingPlanDayIndex: () => 0,
}));
vi.mock("@/lib/read/today-reading-plan-payload", () => ({
  loadTodayReadingPlanPayload: (...args: unknown[]) => state.load(...args),
}));
import { useTodayReadingPlan } from "./useTodayReadingPlan";
import { useGoldenVersePageBackgrounds } from "./useGoldenVersePageBackgrounds";

function render<T>(hook: () => T): T {
  state.index = 0;
  state.refIndex = 0;
  state.effects = [];
  return hook();
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
async function settle() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }
const initial = [{ id: "saved", url: "/saved.jpg", filename: "saved.jpg" }];
const newer = [{ id: "new", url: "/new.jpg", filename: "new.jpg" }];

beforeEach(() => {
  state.values = []; state.refs = []; state.effects = []; state.index = 0; state.refIndex = 0;
  state.prefs = { version: 1, planId: "first", anchor: "calendar-jan1", dayCount: 365 };
  state.load.mockReset();
  vi.unstubAllGlobals();
});

describe("today reading request lifetime", () => {
  it.each([false, true])("ignores a stale plan's late response (failure=%s)", async (failure) => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    state.load.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    render(() => useTodayReadingPlan([]));
    const cleanup = state.effects[0]();
    if (cleanup) cleanup();
    state.prefs = { ...state.prefs, planId: "second" };
    render(() => useTodayReadingPlan([]));
    state.effects[0]();
    second.resolve({ planId: "second" });
    await settle();
    if (failure) first.reject(new Error("old request failed"));
    else first.resolve({ planId: "first" });
    await settle();
    const result = render(() => useTodayReadingPlan([]));
    expect(result.payload?.planId).toBe("second");
    expect(result.loading).toBe(false);
  });

  it("does not expose the old playback queue while a new plan starts loading", async () => {
    state.load.mockResolvedValue({ planId: "first" });
    render(() => useTodayReadingPlan([]));
    const cleanup = state.effects[0]();
    await settle();
    expect(render(() => useTodayReadingPlan([])).payload?.planId).toBe("first");
    if (cleanup) cleanup();
    state.prefs = { ...state.prefs, planId: "second" };
    expect(render(() => useTodayReadingPlan([])).payload).toBeNull();
  });

  it("does not update state after the reader unmounts", async () => {
    const pending = deferred<unknown>(); state.load.mockReturnValue(pending.promise);
    render(() => useTodayReadingPlan([]));
    const cleanup = state.effects[0](); if (cleanup) cleanup();
    const before = [...state.values];
    pending.resolve({ planId: "first" }); await settle();
    expect(state.values).toEqual(before);
  });
});

describe("golden verse background refresh", () => {
  it.each(["network", "http", "json", "schema"])("keeps usable backgrounds after a %s failure", async (failure) => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      if (failure === "network") throw new Error("offline");
      return { ok: failure !== "http", json: async () => {
        if (failure === "json") throw new Error("invalid JSON");
        return { error: "unavailable" };
      } };
    }));
    const { refresh } = render(() => useGoldenVersePageBackgrounds(initial));
    expect(await refresh()).toEqual(initial);
    expect(render(() => useGoldenVersePageBackgrounds(initial)).backgrounds).toEqual(initial);
  });

  it("accepts a successful empty catalog when all backgrounds were deleted", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ backgrounds: [] }) })));
    const { refresh } = render(() => useGoldenVersePageBackgrounds(initial));
    expect(await refresh()).toEqual([]);
    expect(render(() => useGoldenVersePageBackgrounds(initial)).backgrounds).toEqual([]);
  });

  it("does not roll back newer backgrounds when an older refresh finishes late", async () => {
    const old = deferred<unknown>(); const current = deferred<unknown>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise));
    const { refresh } = render(() => useGoldenVersePageBackgrounds(initial));
    const oldRun = refresh(); const currentRun = refresh();
    current.resolve({ ok: true, json: async () => ({ backgrounds: newer }) });
    await currentRun;
    old.resolve({ ok: true, json: async () => ({ backgrounds: initial }) });
    expect(await oldRun).toEqual(newer);
    expect(render(() => useGoldenVersePageBackgrounds(initial)).backgrounds).toEqual(newer);
  });
});
