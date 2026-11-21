import { describe, expect, it, vi } from "vitest";
import {
  checkWebBuildUpdate,
  formatShortBuildId,
  shouldSkipBuildId,
} from "@/lib/pwa/check-app-update";

describe("check-app-update", () => {
  it("skips empty or development build ids", () => {
    expect(shouldSkipBuildId("")).toBe(true);
    expect(shouldSkipBuildId("development")).toBe(true);
    expect(shouldSkipBuildId("unknown")).toBe(true);
    expect(shouldSkipBuildId("4a249f1bc91274dd")).toBe(false);
  });

  it("formats short build labels cleanly", () => {
    expect(formatShortBuildId("development")).toBe("Web · dev");
    expect(formatShortBuildId("4a249f1bc91274dde6b6cbef84642dcec95fda38")).toBe("Web · 4a249f1b");
  });

  it("detects when a newer production build is live", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "9999888877776666" }),
    }) as unknown as typeof fetch;

    const outcome = await checkWebBuildUpdate({
      loadedId: "1111222233334444",
      fetchImpl: fakeFetch,
    });

    expect(outcome).toEqual({
      status: "update-available",
      remoteId: "9999888877776666",
      loadedId: "1111222233334444",
    });
  });

  it("reports up-to-date when build matches", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "4a249f1bc91274dd" }),
    }) as unknown as typeof fetch;

    const outcome = await checkWebBuildUpdate({
      loadedId: "4a249f1bc91274dd",
      fetchImpl: fakeFetch,
    });

    expect(outcome).toEqual({
      status: "up-to-date",
      buildId: "4a249f1bc91274dd",
    });
  });

  it("falls back to /api/app-build and reports failed when offline", async () => {
    const fakeFetch = vi.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;

    const outcome = await checkWebBuildUpdate({
      loadedId: "4a249f1bc91274dd",
      fetchImpl: fakeFetch,
    });

    expect(outcome).toEqual({ status: "failed" });
    expect(fakeFetch).toHaveBeenCalledTimes(2);
  });
});
