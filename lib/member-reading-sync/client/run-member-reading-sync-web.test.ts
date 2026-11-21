import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  push: vi.fn(),
  apply: vi.fn(),
  clear: vi.fn(),
  exportLocal: vi.fn(),
  hasProgress: vi.fn(),
  snapshot: vi.fn(),
}));

vi.mock("./reading-sync-local-web", () => ({
  applyMemberReadingSyncBlobsWeb: mocks.apply,
  clearMemberReadingLocalDataWeb: mocks.clear,
  exportLocalReadingBlobsWeb: mocks.exportLocal,
  exportLocalReadingBlobsWebSnapshot: mocks.snapshot,
  localHasMemberReadingProgressWeb: mocks.hasProgress,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const SESSION_KEY = "askbible.web.member-session.v2";
const META = "askbible.member-reading-sync-meta.v1";
const blob = { updatedAt: "2026-11-17T00:00:00.000Z", value: { "JHN:3:16": true } };

let storage: Map<string, string>;

function setActiveOwner(id: string | null) {
  if (!id) {
    storage.delete(SESSION_KEY);
    return;
  }
  storage.set(
    SESSION_KEY,
    JSON.stringify({
      sessionToken: `tok-${id}`,
      expiresAt: new Date(Date.now() + 86400_000).toISOString(),
      user: { id, email: `${id.toLowerCase()}@example.com`, name: id, isAdmin: false, createdAt: null },
    }),
  );
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  storage = new Map();
  const ls = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
  };
  vi.stubGlobal("window", { localStorage: ls, dispatchEvent: vi.fn() });
  vi.stubGlobal("localStorage", ls);
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal(
    "CustomEvent",
    class {
      constructor(public type: string) {}
    },
  );

  setActiveOwner("A");
  mocks.read.mockResolvedValue({ ok: true, doc: null });
  mocks.push.mockImplementation(async (blobs: unknown) => ({
    ok: true,
    doc: {
      schemaVersion: 1,
      userId: "A",
      revision: "rev-1",
      updatedAt: "2026-11-20T00:00:00.000Z",
      blobs: blobs ?? {},
    },
  }));
  mocks.apply.mockResolvedValue(false);
  mocks.exportLocal.mockResolvedValue({ schemaVersion: 1, blobs: { bookmarks: blob } });
  mocks.snapshot.mockReturnValue({ schemaVersion: 1, blobs: { bookmarks: blob } });
  mocks.hasProgress.mockReturnValue(true);
  mocks.clear.mockImplementation(() => {
    mocks.exportLocal.mockResolvedValue({ schemaVersion: 1, blobs: {} });
    mocks.hasProgress.mockReturnValue(false);
  });

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/v1/auth/logout")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      if (init?.method === "POST") {
        const parsed = init.body ? JSON.parse(String(init.body)) : {};
        const out = await mocks.push(parsed.blobs);
        if (!out?.ok) return { ok: false, status: out?.status ?? 500, json: async () => out };
        return { ok: true, status: 200, json: async () => out };
      }
      const out = await mocks.read();
      if (!out?.ok) return { ok: false, status: out?.status ?? 500, json: async () => out };
      return { ok: true, status: 200, json: async () => out };
    }),
  );
});

describe("web member account isolation on askbible-sync (D-44)", () => {
  it("isolates accounts and recovers A when its archive hits browser storage quota", async () => {
    storage.set(META, JSON.stringify({ boundUserId: "A" }));
    vi.spyOn(localStorage, "setItem").mockImplementation((key, value) => {
      if (key.includes("owner-archive")) throw new Error("QuotaExceededError");
      storage.set(key, value);
    });
    const sync = await import("./run-member-reading-sync-web");
    expect(() => sync.handleMemberReadingAuthChangeWeb(null)).not.toThrow();
    expect(mocks.clear).toHaveBeenCalledOnce();
    sync.handleMemberReadingAuthChangeWeb("A");
    mocks.read.mockResolvedValue({ ok: false, status: 503 });
    expect(await sync.runMemberReadingSyncWeb()).toBe("skipped");
    expect(mocks.apply).toHaveBeenCalledWith({ bookmarks: blob }, expect.any(Function));
  });

  it("clears personal data even when writing sign-out metadata is denied", async () => {
    storage.set(META, JSON.stringify({ boundUserId: "A" }));
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const sync = await import("./run-member-reading-sync-web");
    expect(() => sync.handleMemberReadingAuthChangeWeb(null)).not.toThrow();
    expect(mocks.clear).toHaveBeenCalledOnce();
    expect(await sync.readMemberReadingSyncMetaWeb()).toMatchObject({
      boundUserId: null,
      requirePullOnly: true,
    });
  });

  it("does not apply or upload a remote response arriving after sign-out", async () => {
    const waiting = deferred<unknown>();
    mocks.read.mockReturnValue(waiting.promise);
    const auth = await import("@/lib/askbible-web-auth-client");
    const sync = await import("./run-member-reading-sync-web");
    const running = sync.runMemberReadingSyncWeb();
    await vi.waitFor(() => expect(mocks.read).toHaveBeenCalled());
    await auth.signOutAskbibleWeb();
    sync.handleMemberReadingAuthChangeWeb(null);
    waiting.resolve({
      ok: true,
      doc: { schemaVersion: 1, userId: "A", revision: "1", updatedAt: "", blobs: { bookmarks: blob } },
    });
    expect(await running).toBe("unauthorized");
    expect(mocks.apply).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it.each([undefined, "local-change", "sign-out"])(
    "replaces account A with empty B without uploading A (%s)",
    async (reason) => {
      storage.set(META, JSON.stringify({ boundUserId: "A" }));
      setActiveOwner("B");
      const { runMemberReadingSyncWeb } = await import("./run-member-reading-sync-web");
      expect(await runMemberReadingSyncWeb(reason)).toBe("ok");
      expect(mocks.clear).toHaveBeenCalledOnce();
      expect(mocks.push).not.toHaveBeenCalled();
      expect(JSON.parse(storage.get(META)!)).toMatchObject({ boundUserId: "B", requirePullOnly: false });
    },
  );

  it("a flush requested during sync waits for its queued push", async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    mocks.read.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { scheduleMemberReadingSyncWeb, flushMemberReadingSyncWebNow } = await import(
      "./run-member-reading-sync-web"
    );
    const initial = scheduleMemberReadingSyncWeb();
    await vi.waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(1));
    let flushed = false;
    const flush = flushMemberReadingSyncWebNow("sign-out").then(() => {
      flushed = true;
    });
    first.resolve({ ok: true, doc: null });
    await vi.waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(2));
    expect(flushed).toBe(false);
    second.resolve({ ok: true, doc: null });
    await Promise.all([initial, flush]);
    expect(flushed).toBe(true);
    expect(mocks.push).toHaveBeenCalledTimes(2);
  });
});
