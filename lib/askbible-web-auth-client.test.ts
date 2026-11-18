import { beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ getSession: vi.fn(), signOut: vi.fn(), onAuthStateChange: vi.fn() }));
vi.mock("@/lib/supabase/browser", () => ({ createSupabaseBrowserClient: () => ({ auth }) }));
vi.mock("@/lib/supabase/config", () => ({
  isSupabaseAuthConfigured: () => true,
  getSupabaseUrl: () => "https://test.invalid",
  getSupabaseAnonKey: () => "public-test-key",
}));
import { deleteAskbibleWebAccount, signOutAskbibleWeb } from "./askbible-web-auth-client";
const session = (id: string) => ({ data: { session: { user: { id }, access_token: `test-${id}` } } });
beforeEach(() => {
  vi.clearAllMocks();
  auth.getSession.mockResolvedValue(session("A"));
  auth.signOut.mockResolvedValue({ error: null });
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }));
});
describe("account mutations", () => {
  it("reports a failed sign-out so callers retain local account data", async () => {
    auth.signOut.mockResolvedValue({ error: new Error("offline") });
    await expect(signOutAskbibleWeb()).rejects.toThrow("offline");
  });
  it("does not sign out B when A's deletion response arrives late", async () => {
    auth.getSession.mockResolvedValueOnce(session("A")).mockResolvedValueOnce(session("B"));
    expect(await deleteAskbibleWebAccount()).toEqual({ ok: true });
    expect(auth.signOut).not.toHaveBeenCalled();
  });
  it("signs out the deleted owner after confirmed success", async () => {
    expect(await deleteAskbibleWebAccount()).toEqual({ ok: true });
    expect(auth.signOut).toHaveBeenCalledOnce();
  });
  it("a rejected deletion keeps the account signed in", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({ error: "try_again" }) } as Response);
    expect(await deleteAskbibleWebAccount()).toEqual({ ok: false, error: "try_again", code: undefined });
    expect(auth.signOut).not.toHaveBeenCalled();
  });
  it("a delayed logout for A cannot sign out the current B", async () => {
    auth.getSession.mockResolvedValue(session("B"));
    await signOutAskbibleWeb("A");
    expect(auth.signOut).not.toHaveBeenCalled();
  });
  it("rechecks auth changes occurring during the final session read", async () => {
    auth.getSession.mockImplementation(async () => {
      auth.onAuthStateChange.mock.calls[0][0]("SIGNED_IN");
      return session("A");
    });
    await signOutAskbibleWeb("A");
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});
