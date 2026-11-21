import { describe, expect, it } from "vitest";
import { isBackupEntryHost, resolvePublicAuthOrigin } from "./public-auth-origin";

describe("resolvePublicAuthOrigin", () => {
  it("uses the trusted public host forwarded by Render", () => {
    const request = new Request("https://0.0.0.0:10000/auth/callback", {
      headers: { "x-forwarded-host": "askbible.me" },
    });

    expect(resolvePublicAuthOrigin(request)).toBe("https://askbible.me");
  });

  it("preserves supported public aliases", () => {
    const request = new Request("https://0.0.0.0:10000/auth/callback", {
      headers: { "x-forwarded-host": "legacy.askbible.me" },
    });

    expect(resolvePublicAuthOrigin(request)).toBe("https://legacy.askbible.me");
  });

  it("已停用的旧备用域不再放行回跳，统一回到 askbible.me", () => {
    const request = new Request("https://0.0.0.0:10000/auth/callback", {
      headers: { "x-forwarded-host": "bible.joshlabs.app" },
    });

    expect(resolvePublicAuthOrigin(request)).toBe("https://askbible.me");
    expect(isBackupEntryHost("bible.joshlabs.app:443")).toBe(false);
    expect(isBackupEntryHost("askbible.me")).toBe(false);
  });

  it("rejects an untrusted forwarded host", () => {
    const request = new Request("https://0.0.0.0:10000/auth/callback", {
      headers: { "x-forwarded-host": "attacker.example" },
    });

    expect(resolvePublicAuthOrigin(request)).toBe("https://askbible.me");
  });

  it("keeps local development on its current origin", () => {
    const request = new Request("http://localhost:3450/auth/callback");

    expect(resolvePublicAuthOrigin(request)).toBe("http://localhost:3450");
  });
});
