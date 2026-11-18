import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), read: vi.fn(), upsert: vi.fn(), apply: vi.fn(), clear: vi.fn(),
  exportLocal: vi.fn(), hasProgress: vi.fn(),
  snapshot: vi.fn(),
  listeners: new Set<(event: string) => void>(),
}));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseAuthConfigured: () => true }));
vi.mock("@/lib/supabase/browser", () => ({ createSupabaseBrowserClient: () => ({
  auth: {
    getUser: mocks.getUser,
    onAuthStateChange: (callback: (event: string) => void) => {
      mocks.listeners.add(callback);
      return { data: { subscription: { unsubscribe: () => mocks.listeners.delete(callback) } } };
    },
  },
  from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: mocks.read }) }),
    upsert: mocks.upsert,
  }),
}) }));
vi.mock("./reading-sync-local-web", () => ({
  applyMemberReadingSyncBlobsWeb: mocks.apply,
  clearMemberReadingLocalDataWeb: mocks.clear,
  exportLocalReadingBlobsWeb: mocks.exportLocal,
  exportLocalReadingBlobsWebSnapshot: mocks.snapshot,
  localHasMemberReadingProgressWeb: mocks.hasProgress,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function signOut() { for (const callback of mocks.listeners) callback("SIGNED_OUT"); }
let storage: Map<string, string>;
const META = "askbible.member-reading-sync-meta.v1";
const blob = { updatedAt: "2026-11-17T00:00:00.000Z", value: { "JHN:3:16": true } };

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.listeners.clear();
  storage = new Map();
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal("CustomEvent", class { constructor(public type: string) {} });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  mocks.getUser.mockResolvedValue({ data: { user: { id: "A" } }, error: null });
  mocks.read.mockResolvedValue({ data: null, error: null });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.apply.mockResolvedValue(false);
  mocks.exportLocal.mockResolvedValue({ schemaVersion: 1, blobs: { bookmarks: blob } });
  mocks.snapshot.mockReturnValue({ schemaVersion: 1, blobs: { bookmarks: blob } });
  mocks.hasProgress.mockReturnValue(true);
  mocks.clear.mockImplementation(() => {
    mocks.exportLocal.mockResolvedValue({ schemaVersion: 1, blobs: {} });
    mocks.hasProgress.mockReturnValue(false);
  });
});

describe("web member account isolation", () => {
  it("still isolates accounts and can recover A when its archive hits the browser storage quota", async () => {
    storage.set(META, JSON.stringify({ boundUserId: "A" }));
    vi.spyOn(localStorage, "setItem").mockImplementation((key, value) => {
      if (key.includes("owner-archive")) throw new Error("QuotaExceededError");
      storage.set(key, value);
    });
    const sync = await import("./run-member-reading-sync-web");
    expect(() => sync.handleMemberReadingAuthChangeWeb(null)).not.toThrow();
    expect(mocks.clear).toHaveBeenCalledOnce();
    sync.handleMemberReadingAuthChangeWeb("A");
    mocks.read.mockResolvedValue({ data: null, error: new Error("offline") });
    expect(await sync.runMemberReadingSyncWeb()).toBe("skipped");
    expect(mocks.apply).toHaveBeenCalledWith({ bookmarks: blob }, expect.any(Function));
  });

  it("clears personal data even when writing sign-out metadata is denied", async () => {
    storage.set(META, JSON.stringify({ boundUserId: "A" }));
    vi.spyOn(localStorage, "setItem").mockImplementation(() => { throw new Error("QuotaExceededError"); });
    const sync = await import("./run-member-reading-sync-web");
    expect(() => sync.handleMemberReadingAuthChangeWeb(null)).not.toThrow();
    expect(mocks.clear).toHaveBeenCalledOnce();
    expect(await sync.readMemberReadingSyncMetaWeb()).toMatchObject({ boundUserId: null, requirePullOnly: true });
  });

  it("discards getUser that completes after sign-out", async () => {
    const waiting = deferred<unknown>();
    mocks.getUser.mockReturnValue(waiting.promise);
    const { runMemberReadingSyncWeb } = await import("./run-member-reading-sync-web");
    const running = runMemberReadingSyncWeb();
    signOut();
    waiting.resolve({ data: { user: { id: "A" } }, error: null });
    expect(await running).toBe("unauthorized");
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.listeners.size).toBe(0);
  });

  it("does not apply or upload a remote response arriving after sign-out", async () => {
    const waiting = deferred<unknown>();
    mocks.read.mockReturnValue(waiting.promise);
    const { runMemberReadingSyncWeb } = await import("./run-member-reading-sync-web");
    const running = runMemberReadingSyncWeb();
    await vi.waitFor(() => expect(mocks.read).toHaveBeenCalled());
    signOut();
    waiting.resolve({ data: { user_id: "A", revision: "1", blobs: { bookmarks: blob } }, error: null });
    expect(await running).toBe("unauthorized");
    expect(mocks.apply).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(storage.size).toBe(0);
  });

  it("does not restore local data after a delayed upload completes", async () => {
    const waiting = deferred<unknown>();
    mocks.upsert.mockReturnValue(waiting.promise);
    const { runMemberReadingSyncWeb } = await import("./run-member-reading-sync-web");
    const running = runMemberReadingSyncWeb("local-change");
    await vi.waitFor(() => expect(mocks.upsert).toHaveBeenCalled());
    signOut();
    waiting.resolve({ error: null });
    expect(await running).toBe("unauthorized");
    expect(mocks.apply).not.toHaveBeenCalled();
    expect(storage.size).toBe(0);
  });

  it.each([undefined, "local-change", "sign-out"])("replaces account A with empty B without uploading A (%s)", async (reason) => {
    storage.set(META, JSON.stringify({ boundUserId: "A" }));
    mocks.getUser.mockResolvedValue({ data: { user: { id: "B" } }, error: null });
    const { runMemberReadingSyncWeb } = await import("./run-member-reading-sync-web");
    expect(await runMemberReadingSyncWeb(reason)).toBe("ok");
    expect(mocks.clear).toHaveBeenCalledOnce();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(JSON.parse(storage.get(META)!)).toMatchObject({ boundUserId: "B", requirePullOnly: false });
  });

  it("pull-only after logout clears guest data before a forced push", async () => {
    storage.set(META, JSON.stringify({ boundUserId: null, requirePullOnly: true }));
    const { runMemberReadingSyncWeb } = await import("./run-member-reading-sync-web");
    expect(await runMemberReadingSyncWeb("sign-out")).toBe("ok");
    expect(mocks.clear).toHaveBeenCalledOnce();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("failed account replacement hides A and preserves its private archive", async () => {
    storage.set(META, JSON.stringify({ boundUserId: "B" }));
    mocks.read.mockResolvedValue({ data: null, error: new Error("offline") });
    const { runMemberReadingSyncWeb } = await import("./run-member-reading-sync-web");
    expect(await runMemberReadingSyncWeb()).toBe("skipped");
    expect(mocks.clear).toHaveBeenCalledOnce();
    expect(JSON.parse(storage.get("askbible.member-reading-sync-owner-archive.v1:B")!)).toMatchObject({ blobs: { bookmarks: blob } });
    expect(JSON.parse(storage.get(META)!)).toMatchObject({ boundUserId: "A" });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("restores only the returning owner's archive even when cloud is unavailable", async () => {
    storage.set(META, JSON.stringify({ boundUserId: "B" }));
    storage.set("askbible.member-reading-sync-owner-archive.v1:A", JSON.stringify({ schemaVersion: 1, blobs: { bookmarks: blob } }));
    mocks.read.mockResolvedValue({ data: null, error: new Error("offline") });
    const { runMemberReadingSyncWeb } = await import("./run-member-reading-sync-web");
    expect(await runMemberReadingSyncWeb()).toBe("skipped");
    expect(mocks.apply).toHaveBeenCalledWith({ bookmarks: blob }, expect.any(Function));
  });

  it("external sign-out archives and clears personal data without an async gap", async () => {
    storage.set(META, JSON.stringify({ boundUserId: "A" }));
    const { handleMemberReadingAuthChangeWeb } = await import("./run-member-reading-sync-web");
    handleMemberReadingAuthChangeWeb(null);
    expect(mocks.clear).toHaveBeenCalledOnce();
    expect(JSON.parse(storage.get(META)!)).toMatchObject({ boundUserId: null, requirePullOnly: true });
    handleMemberReadingAuthChangeWeb("B");
    expect(JSON.parse(storage.get(META)!)).toMatchObject({ boundUserId: "B", requirePullOnly: false });
  });

  it("keeps a new member's unsynced progress when signing out before the first cloud sync", async () => {
    const { handleMemberReadingAuthChangeWeb } = await import("./run-member-reading-sync-web");
    handleMemberReadingAuthChangeWeb("A");
    handleMemberReadingAuthChangeWeb(null);
    expect(JSON.parse(storage.get("askbible.member-reading-sync-owner-archive.v1:A")!)).toMatchObject({ blobs: { bookmarks: blob } });
    expect(mocks.clear).toHaveBeenCalledOnce();
  });

  it("keeps guest progress on an initial anonymous visit but isolates an expired member", async () => {
    const { handleMemberReadingAuthChangeWeb } = await import("./run-member-reading-sync-web");
    handleMemberReadingAuthChangeWeb(null, true);
    expect(mocks.clear).not.toHaveBeenCalled();
    storage.set(META, JSON.stringify({ boundUserId: "A" }));
    handleMemberReadingAuthChangeWeb(null, true);
    expect(mocks.clear).toHaveBeenCalledOnce();
    expect(storage.has("askbible.member-reading-sync-owner-archive.v1:A")).toBe(true);
  });

  it("a flush requested during sync waits for its queued push", async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    mocks.read.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { scheduleMemberReadingSyncWeb, flushMemberReadingSyncWebNow } = await import("./run-member-reading-sync-web");
    const initial = scheduleMemberReadingSyncWeb();
    await vi.waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(1));
    let flushed = false;
    const flush = flushMemberReadingSyncWebNow("sign-out").then(() => { flushed = true; });
    first.resolve({ data: null, error: null });
    await vi.waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(2));
    expect(flushed).toBe(false);
    second.resolve({ data: null, error: null });
    await Promise.all([initial, flush]);
    expect(flushed).toBe(true);
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
  });
});
