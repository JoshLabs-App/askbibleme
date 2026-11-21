import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/member-reading-sync/client/run-member-reading-sync-web", () => ({
  flushMemberReadingSyncWebNow: vi.fn(),
}));

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); },
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
  };
}

const bookmark = {
  "cuv-simp:GEN:1:1": {
    bookId: "GEN", bookName: "创世记", chapter: 1, verse: 1,
    translationId: "cuv-simp", text: "起初", savedAt: 1,
  },
};
const blob = (value: unknown) => ({ updatedAt: "2026-11-17T00:00:00Z", value });

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/read/today-reading-plan-payload");
  const local = memoryStorage();
  const session = memoryStorage();
  vi.stubGlobal("localStorage", local);
  vi.stubGlobal("sessionStorage", session);
  vi.stubGlobal("window", Object.assign(new EventTarget(), {
    localStorage: local, sessionStorage: session, setInterval: vi.fn(),
    location: { search: "", protocol: "http:" },
  }));
  vi.stubGlobal("document", Object.assign(new EventTarget(), {
    cookie: "", visibilityState: "visible", documentElement: { lang: "en" },
  }));
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
});
afterEach(() => vi.unstubAllGlobals());

describe("member local data isolation", () => {
  it("clears personal persisted data and hydrated stores while preserving display preferences", async () => {
    const sync = await import("./reading-sync-local-web");
    const bookmarks = await import("@/lib/bible/scripture-verse-bookmarks-client");
    const highlights = await import("@/lib/read/read-verse-text-highlights");
    const last = await import("@/lib/read/read-last-position");
    const recent = await import("@/lib/read/read-recent-chapters-web");
    const completion = await import("@/lib/read/read-chapter-completion");
    const dates = await import("@/lib/read/plan-play-listened-dates-web");
    const habit = await import("@/lib/read/reading-habit-stats");
    const listen = await import("@/lib/read/scripture-listen-totals-web");
    const prefs = await import("@/lib/read/reading-plan-prefs");
    const triple = await import("@/lib/read/triple-loop-progress");
    const nt = await import("@/lib/read/nt-deep-repeat-progress");
    const done = await import("@/lib/read/today-reading-done");
    const fraction = await import("@/lib/read/today-reading-chapter-fraction");
    const search = await import("@/lib/read/scripture-recent-searches");
    const profile = await import("@/lib/explore/explore-birth-year-prefs");
    const achievements = await import("@/lib/achievements/achievement-store-web");
    const typography = await import("@/lib/read/read-bible-typography-prefs");
    const locale = await import("@/lib/i18n/config");

    localStorage.setItem(typography.READ_BIBLE_TYPOGRAPHY_STORAGE_KEY, "device-font-choice");
    localStorage.setItem(locale.LOCALE_STORAGE_KEY, "en");
    bookmarks.replaceScriptureVerseBookmarkStore(bookmark);
    highlights.replaceVerseTextHighlightStore({ "cuv-simp:GEN:1:1": [{ i: 0, c: "#ff0" }] });
    last.writeLastReadPosition({ bookId: "GEN", bookName: "创世记", chapter: 1 });
    completion.markReadChapterCompleted("GEN", 1);
    dates.markPlanPlayListenedDate("2026-11-17");
    listen.writeScriptureListenTotalsWeb({ version: 1, totalSec: 300 });
    prefs.writeReadingPlanPrefs({ version: 1, planId: "test-plan", anchor: "from-today", chosen: true });
    triple.writeTripleLoopProgress(triple.readTripleLoopProgress());
    nt.writeNtDeepRepeatProgress(nt.createFreshNtDeepRepeatProgress());
    done.replaceTodayReadingDoneRecord({ version: 1, scopeKey: "test-plan", doneKeys: ["GEN:1"] });
    fraction.replaceTodayReadingChapterFractionRecord({ version: 1, scopeKey: "test-plan", fractions: { "GEN:1": 0.8 } });
    search.replaceScriptureRecentSearches({ version: 1, terms: ["creation"] });
    profile.writeExploreYearDayProfile({ displayName: "Account A", birthDate: { year: 1990, month: 1, day: 1 } });
    achievements.noteChapterRead("GEN", 2);
    sessionStorage.setItem("selah-reading-plan-audio-v1", "old account queue");
    localStorage.setItem("askbible-today-plan-scripture-resume-v1", "old account resume");
    expect(sync.localHasMemberReadingProgressWeb()).toBe(true);

    sync.clearMemberReadingLocalDataWeb();
    // Pending chapter/listening imports must not restore A's data after the switch.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(bookmarks.getScriptureVerseBookmarkStoreSnapshot()).toEqual({});
    expect(highlights.readVerseTextHighlightStore()).toEqual({});
    expect(last.readLastReadPosition()).toBeNull();
    expect(recent.getReadRecentChapters()).toEqual([]);
    expect(completion.readReadChapterCompletionRecord().completed).toEqual([]);
    expect([...dates.getPlanPlayListenedDates()]).toEqual([]);
    expect(habit.readReadingHabitStats().completedDates).toEqual([]);
    expect(listen.readScriptureListenTotalsWeb().totalSec).toBe(0);
    expect(prefs.readReadingPlanPrefs()).toBeNull();
    expect(triple.hasUserTripleLoopProgress()).toBe(false);
    expect(nt.hasUserNtDeepRepeatProgress()).toBe(false);
    expect(done.readTodayReadingDoneRecord()).toBeNull();
    expect(fraction.readTodayReadingChapterFractionRecord()).toBeNull();
    expect(search.readScriptureRecentSearches().terms).toEqual([]);
    expect(profile.readExploreYearDayProfile().displayName).toBeNull();
    expect(achievements.localHasAchievementsProgressWeb()).toBe(false);
    expect(sync.localHasMemberReadingProgressWeb()).toBe(false);
    expect(sessionStorage.getItem("selah-reading-plan-audio-v1")).toBeNull();
    expect(localStorage.getItem("askbible-today-plan-scripture-resume-v1")).toBeNull();
    expect(localStorage.getItem(typography.READ_BIBLE_TYPOGRAPHY_STORAGE_KEY)).toBe("device-font-choice");
    expect(localStorage.getItem(locale.LOCALE_STORAGE_KEY)).toBe("en");

    // Reopening must not resurrect any persisted personal progress.
    vi.resetModules();
    const reopened = await import("./reading-sync-local-web");
    expect(reopened.localHasMemberReadingProgressWeb()).toBe(false);
    expect((await import("@/lib/read/read-recent-chapters-web")).getReadRecentChapters()).toEqual([]);
    expect([...(await import("@/lib/read/plan-play-listened-dates-web")).getPlanPlayListenedDates()]).toEqual([]);
  }, 15_000);

  it("applies and exports non-translation progress without requiring the catalog network", async () => {
    const sync = await import("./reading-sync-local-web");
    await sync.applyMemberReadingSyncBlobsWeb({ bookmarks: blob(bookmark) });
    const exported = await sync.exportLocalReadingBlobsWeb();
    expect(exported.blobs.bookmarks?.value).toEqual(bookmark);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("discards a delayed translation response and following blobs after an account switch", async () => {
    let resolveCatalog!: (response: Response) => void;
    vi.mocked(fetch).mockImplementation(() => new Promise((resolve) => { resolveCatalog = resolve; }));
    const sync = await import("./reading-sync-local-web");
    let current = true;
    const pending = sync.applyMemberReadingSyncBlobsWeb({
      readTranslation: blob({ version: 1, prefs: { version: 1, primaryTranslationId: "cuv-simp" } }),
      recentSearches: blob({ version: 1, terms: ["Account A query"] }),
    }, () => current);
    expect(fetch).toHaveBeenCalledOnce();
    current = false;
    resolveCatalog(new Response(JSON.stringify({ translations: [], defaultTranslationId: null })));
    await pending;
    expect(localStorage.getItem("selah_read_bible_translation_v1")).toBeNull();
    expect((await import("@/lib/read/scripture-recent-searches")).readScriptureRecentSearches().terms).toEqual([]);
  });

  it("does not write data for an already superseded sync", async () => {
    const sync = await import("./reading-sync-local-web");
    await sync.applyMemberReadingSyncBlobsWeb({ bookmarks: blob(bookmark) }, () => false);
    expect((await import("@/lib/bible/scripture-verse-bookmarks-client")).getScriptureVerseBookmarkStoreSnapshot()).toEqual({});
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["visit", "fraction"])("ignores a delayed %s plan result after clearing the account", async (kind) => {
    let finishPlan!: (value: unknown) => void;
    vi.doMock("@/lib/read/today-reading-plan-payload", () => ({
      loadTodayReadingPlanPayload: vi.fn(() => new Promise((resolve) => { finishPlan = resolve; })),
    }));
    const sync = await import("./reading-sync-local-web");
    const done = await import("@/lib/read/today-reading-done");
    const fraction = await import("@/lib/read/today-reading-chapter-fraction");
    const pending = kind === "visit"
      ? done.markTodayReadingChapterVisit("GEN", 1)
      : fraction.recordTodayReadingChapterFraction("GEN", 1, 1);
    sync.clearMemberReadingLocalDataWeb();
    finishPlan({ day: { readings: [{ bookId: "GEN", startChapter: 1, endChapter: 1 }] } });
    await pending;
    expect(done.readTodayReadingDoneRecord()).toBeNull();
    expect(fraction.readTodayReadingChapterFractionRecord()).toBeNull();
    expect(sync.localHasMemberReadingProgressWeb()).toBe(false);
  });

  it("exports bookmark tombstones and highlight _t tombstones even when live stores are empty", async () => {
    const sync = await import("./reading-sync-local-web");
    const bookmarks = await import("@/lib/bible/scripture-verse-bookmarks-client");
    const highlights = await import("@/lib/read/read-verse-text-highlights");

    const ref = {
      bookId: "JHN",
      bookName: "约翰福音",
      chapter: 3,
      verse: 16,
      translationId: "cuv-simp",
      text: "神爱世人",
    };
    await bookmarks.toggleScriptureVerseBookmark(ref);
    await bookmarks.toggleScriptureVerseBookmark(ref);
    expect(bookmarks.getScriptureVerseBookmarkStoreSnapshot()).toEqual({});

    highlights.writeVerseTextHighlightIndices(
      { translationId: "cuv-simp", bookId: "JHN", chapter: 3, verse: 16 },
      [[0, "#FFB103"]],
    );
    highlights.writeVerseTextHighlightIndices(
      { translationId: "cuv-simp", bookId: "JHN", chapter: 3, verse: 16 },
      [],
    );
    expect(highlights.readVerseTextHighlightStore()).toEqual({});

    expect(sync.localHasMemberReadingProgressWeb()).toBe(true);
    const exported = await sync.exportLocalReadingBlobsWeb();
    const bmVal = exported.blobs.bookmarks?.value as Record<string, { deleted?: boolean; deletedAt?: number }>;
    expect(bmVal["cuv-simp:JHN:3:16"]?.deleted).toBe(true);
    expect(typeof bmVal["cuv-simp:JHN:3:16"]?.deletedAt).toBe("number");

    const hlVal = exported.blobs.highlights?.value as Record<string, unknown>;
    expect(hlVal["cuv-simp:JHN:3:16"]).toBeUndefined();
    expect(typeof (hlVal._t as Record<string, number>)["cuv-simp:JHN:3:16"]).toBe("number");

    sync.clearMemberReadingLocalDataWeb();
    expect(sync.localHasMemberReadingProgressWeb()).toBe(false);
    expect(bookmarks.getScriptureVerseBookmarkTombstonesSnapshot()).toEqual({});
    expect(highlights.readVerseTextHighlightTimestamps()).toEqual({});
  });
});
