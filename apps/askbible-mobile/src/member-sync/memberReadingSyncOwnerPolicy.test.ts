import { describe, expect, it } from "vitest";
import {
  blobsHaveMemberReadingProgress,
  decideMemberReadingSyncPath,
  shouldForcePushMemberReadingSync,
} from "./memberReadingSyncOwnerPolicy";
import type { MemberReadingSyncBlob } from "./schema";

function blob(value: unknown): MemberReadingSyncBlob {
  return { updatedAt: "2026-01-01T00:00:00.000Z", value };
}

describe("decideMemberReadingSyncPath", () => {
  it("pulls only after sign-out even if local looks like progress", () => {
    expect(
      decideMemberReadingSyncPath({
        boundUserId: null,
        requirePullOnly: true,
        userId: "u1",
        remoteHasProgress: false,
        localHasProgress: true,
      }),
    ).toBe("replace");
  });

  it("replaces when switching accounts", () => {
    expect(
      decideMemberReadingSyncPath({
        boundUserId: "u-old",
        requirePullOnly: false,
        userId: "u-new",
        remoteHasProgress: true,
        localHasProgress: true,
      }),
    ).toBe("replace");
  });

  it("pulls cloud first after reinstall when remote has progress", () => {
    expect(
      decideMemberReadingSyncPath({
        boundUserId: null,
        requirePullOnly: false,
        userId: "u1",
        remoteHasProgress: true,
        localHasProgress: false,
      }),
    ).toBe("pull-only-reinstall");
  });

  it("does not treat factory-empty local as a guest upgrade", () => {
    expect(
      decideMemberReadingSyncPath({
        boundUserId: null,
        requirePullOnly: false,
        userId: "u1",
        remoteHasProgress: false,
        localHasProgress: false,
      }),
    ).toBe("pull-only-empty");
  });

  it("allows guest upgrade only when cloud is empty and local has real progress", () => {
    expect(
      decideMemberReadingSyncPath({
        boundUserId: null,
        requirePullOnly: false,
        userId: "u1",
        remoteHasProgress: false,
        localHasProgress: true,
      }),
    ).toBe("guest-push");
  });

  it("continues for the bound account when local has progress", () => {
    expect(
      decideMemberReadingSyncPath({
        boundUserId: "u1",
        requirePullOnly: false,
        userId: "u1",
        remoteHasProgress: true,
        localHasProgress: true,
      }),
    ).toBe("continue");
  });

  it("pushes local progress on sign-out even if pull-only is marked", () => {
    expect(
      decideMemberReadingSyncPath({
        boundUserId: null,
        requirePullOnly: true,
        userId: "u1",
        remoteHasProgress: true,
        localHasProgress: true,
        forcePush: true,
      }),
    ).toBe("continue");
  });

  it("still pulls after a completed sign-out when local is empty", () => {
    expect(
      decideMemberReadingSyncPath({
        boundUserId: null,
        requirePullOnly: true,
        userId: "u1",
        remoteHasProgress: true,
        localHasProgress: false,
        forcePush: true,
      }),
    ).toBe("replace");
  });

  it("pulls when the bound account has empty local storage", () => {
    expect(
      decideMemberReadingSyncPath({
        boundUserId: "u1",
        requirePullOnly: false,
        userId: "u1",
        remoteHasProgress: true,
        localHasProgress: false,
      }),
    ).toBe("pull-only-empty");
  });
});

describe("shouldForcePushMemberReadingSync", () => {
  it("forces a push for sign-out and explicit local plan changes", () => {
    expect(shouldForcePushMemberReadingSync("sign-out")).toBe(true);
    expect(shouldForcePushMemberReadingSync("readingPlanPrefs")).toBe(true);
    expect(shouldForcePushMemberReadingSync("login")).toBe(false);
  });
});

describe("blobsHaveMemberReadingProgress", () => {
  it("ignores last-wins settings and unchosen plan defaults", () => {
    expect(
      blobsHaveMemberReadingProgress({
        appLocale: blob({ version: 1, locale: "zh-CN" }),
        readTypography: blob({ size: "m" }),
        readingPlanPrefs: blob({ version: 1, planId: "triple-loop" }),
      }),
    ).toBe(false);
  });

  it("treats listen minutes, today marks, and chosen plans as progress", () => {
    expect(blobsHaveMemberReadingProgress({ scriptureListenTotals: blob({ totalSec: 90 }) })).toBe(true);
    expect(blobsHaveMemberReadingProgress({ todayReadingDone: blob({ doneKeys: ["GEN.1"] }) })).toBe(true);
    expect(
      blobsHaveMemberReadingProgress({
        readingPlanPrefs: blob({ version: 1, planId: "triple-loop", chosen: true }),
      }),
    ).toBe(true);
  });
});
