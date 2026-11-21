import { beforeEach, describe, expect, it, vi } from "vitest";

const SESSION_KEY = "askbible.web.member-session.v2";

let store: Map<string, string>;

function seedSession(id: string) {
  store.set(
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
  store = new Map();
  const ls = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  vi.stubGlobal("window", { localStorage: ls });
  vi.stubGlobal("localStorage", ls);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    }),
  );
});

describe("askbible-sync web auth client", () => {
  it("signs out the deleted owner after confirmed account deletion", async () => {
    seedSession("A");
    const m = await import("./askbible-web-auth-client");
    expect(await m.deleteAskbibleWebAccount()).toEqual({ ok: true });
    expect(m.readStoredAskbibleWebSession()).toBeNull();
  });

  it("a rejected deletion keeps the account signed in", async () => {
    seedSession("A");
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ ok: false, error: "try_again" }),
    } as Response);
    const m = await import("./askbible-web-auth-client");
    expect(await m.deleteAskbibleWebAccount()).toEqual({
      ok: false,
      error: "try_again",
      code: undefined,
    });
    expect(m.readStoredAskbibleWebSession()?.user.id).toBe("A");
  });

  it("does not sign out B when A's deletion response arrives after switching to B", async () => {
    seedSession("A");
    const m = await import("./askbible-web-auth-client");
    vi.mocked(fetch).mockImplementationOnce(async () => {
      // Simulate user logging into B while A's delete request is in flight
      await m.verifyAskbibleWebOtp({ email: "b@example.com", token: "123456" });
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        sessionToken: "tok-B",
        expiresAt: new Date(Date.now() + 86400_000).toISOString(),
        user: { id: "B", email: "b@example.com", name: "B", isAdmin: false, createdAt: null },
      }),
    } as Response);

    expect(await m.deleteAskbibleWebAccount()).toEqual({ ok: true });
    expect(m.readStoredAskbibleWebSession()?.user.id).toBe("B");
  });

  it("a delayed logout for A cannot sign out current B", async () => {
    seedSession("B");
    const m = await import("./askbible-web-auth-client");
    await m.signOutAskbibleWeb("A");
    expect(m.readStoredAskbibleWebSession()?.user.id).toBe("B");
  });

  it("retains local session on transient 503 during session refresh", async () => {
    seedSession("A");
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 503 } as Response);
    const m = await import("./askbible-web-auth-client");
    const res = await m.fetchAskbibleWebSessionUser();
    expect(res.user?.id).toBe("A");
  });
});
