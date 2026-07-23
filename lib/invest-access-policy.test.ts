import { describe, expect, it } from "vitest";
import {
  hasGoogleAuthProvider,
  isAllowedInvestGoogleUser,
  parseInvestAllowedGoogleEmails,
} from "./invest-access-policy";

describe("invest access policy", () => {
  it("normalizes and deduplicates the configured allowlist", () => {
    expect(
      [...parseInvestAllowedGoogleEmails(" Owner@Example.com,owner@example.com, second@example.com ")],
    ).toEqual(["owner@example.com", "second@example.com"]);
  });

  it("recognizes Google only from trusted app metadata", () => {
    expect(hasGoogleAuthProvider({ provider: "google" })).toBe(true);
    expect(hasGoogleAuthProvider({ providers: ["email", "google"] })).toBe(true);
    expect(hasGoogleAuthProvider({ provider: "email" })).toBe(false);
  });

  it("allows only an allowlisted Google identity", () => {
    const allowed = new Set(["owner@example.com"]);

    expect(
      isAllowedInvestGoogleUser(
        { email: "OWNER@example.com", app_metadata: { provider: "google" } },
        allowed,
      ),
    ).toBe(true);
    expect(
      isAllowedInvestGoogleUser(
        { email: "other@example.com", app_metadata: { provider: "google" } },
        allowed,
      ),
    ).toBe(false);
    expect(
      isAllowedInvestGoogleUser(
        { email: "owner@example.com", app_metadata: { provider: "email" } },
        allowed,
      ),
    ).toBe(false);
  });
});
