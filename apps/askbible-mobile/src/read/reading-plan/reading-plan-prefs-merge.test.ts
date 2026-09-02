import { describe, expect, it } from "vitest";
import {
  mergeReadingPlanPrefsValue,
  shouldSyncReadingPlanPrefs,
  type ReadingPlanPrefsMergeValue,
} from "@/lib/read/reading-plan-prefs-merge";

const oldPlan: ReadingPlanPrefsMergeValue = {
  version: 1,
  planId: "triple-loop",
  anchor: "calendar-easter",
  startedOn: "2026-04-05",
  dayCount: 365,
  chosen: true,
  selectedAt: "2026-03-01T00:00:00.000Z",
};

const newPlan: ReadingPlanPrefsMergeValue = {
  version: 1,
  planId: "mcheyne",
  anchor: "from-today",
  startedOn: "2026-08-18",
  dayCount: 365,
  chosen: true,
  selectedAt: "2026-08-18T15:00:00.000Z",
};

describe("shouldSyncReadingPlanPrefs", () => {
  it("uploads an explicitly chosen plan", () => {
    expect(shouldSyncReadingPlanPrefs(newPlan)).toBe(true);
  });

  it("skips the unchosen product default", () => {
    expect(
      shouldSyncReadingPlanPrefs({
        version: 1,
        planId: "triple-loop",
        anchor: "calendar-easter",
        startedOn: "2026-04-05",
        dayCount: 365,
      }),
    ).toBe(false);
  });

  it("uploads a stored non-default plan even without chosen", () => {
    expect(
      shouldSyncReadingPlanPrefs({
        version: 1,
        planId: "mcheyne",
        anchor: "from-today",
        startedOn: "2026-08-18",
        dayCount: 365,
      }),
    ).toBe(true);
  });
});

describe("mergeReadingPlanPrefsValue", () => {
  it("keeps the later selected plan when an older plan is restamped newer", () => {
    const merged = mergeReadingPlanPrefsValue(newPlan, oldPlan) as ReadingPlanPrefsMergeValue;
    expect(merged.planId).toBe("mcheyne");
    expect(merged.selectedAt).toBe(newPlan.selectedAt);
  });

  it("keeps an explicit plan switch when another device restamps the old plan", () => {
    const switched: ReadingPlanPrefsMergeValue = {
      version: 1,
      planId: "triple-loop",
      anchor: "calendar-easter",
      startedOn: "2026-04-05",
      dayCount: 365,
      chosen: true,
      selectedAt: "2026-08-20T12:00:00.000Z",
    };
    const restampedOld: ReadingPlanPrefsMergeValue = {
      version: 1,
      planId: "nt-deep-repeat",
      anchor: "from-today",
      startedOn: "2026-01-01",
      dayCount: 365,
      ntDeepRepeatPace: 7,
      chosen: true,
      selectedAt: "2026-01-01T00:00:00.000Z",
    };
    // mergeBlobPair 顺序：older=switched, newer=restampedOld
    const merged = mergeReadingPlanPrefsValue(switched, restampedOld) as ReadingPlanPrefsMergeValue;
    expect(merged.planId).toBe("triple-loop");
    expect(merged.selectedAt).toBe(switched.selectedAt);
  });

  it("keeps a switch when the other device has no selectedAt but newer blob order", () => {
    const switched: ReadingPlanPrefsMergeValue = {
      version: 1,
      planId: "triple-loop",
      anchor: "calendar-easter",
      startedOn: "2026-04-05",
      dayCount: 365,
      chosen: true,
      selectedAt: "2026-08-20T12:00:00.000Z",
    };
    const restampedOld: ReadingPlanPrefsMergeValue = {
      version: 1,
      planId: "nt-deep-repeat",
      anchor: "from-today",
      startedOn: "2026-01-01",
      dayCount: 365,
      ntDeepRepeatPace: 7,
      chosen: true,
    };
    expect((mergeReadingPlanPrefsValue(switched, restampedOld) as ReadingPlanPrefsMergeValue).planId).toBe(
      "triple-loop",
    );
    expect((mergeReadingPlanPrefsValue(restampedOld, switched) as ReadingPlanPrefsMergeValue).planId).toBe(
      "triple-loop",
    );
  });

  it("keeps the chosen plan when the other side is not chosen", () => {
    const merged = mergeReadingPlanPrefsValue(
      {
        version: 1,
        planId: "nt-deep-repeat",
        anchor: "from-today",
        startedOn: "2026-01-01",
        dayCount: 365,
        ntDeepRepeatPace: 14,
      },
      newPlan,
    ) as ReadingPlanPrefsMergeValue;
    expect(merged.planId).toBe("mcheyne");
  });

  it("keeps the larger aheadDays when the same plan has the same selectedAt", () => {
    const merged = mergeReadingPlanPrefsValue(
      { ...oldPlan, aheadDays: 12 },
      { ...oldPlan, aheadDays: 3 },
    ) as ReadingPlanPrefsMergeValue;
    expect(merged.aheadDays).toBe(12);
  });

  it("keeps aheadDays when only one side has selectedAt", () => {
    const merged = mergeReadingPlanPrefsValue(
      { ...oldPlan, aheadDays: 12, selectedAt: undefined },
      { ...oldPlan, selectedAt: "2026-08-19T12:00:00.000Z" },
    ) as ReadingPlanPrefsMergeValue;
    expect(merged.aheadDays).toBe(12);
  });

  it("keeps the larger aheadDays even when selectedAt is newer without aheadDays", () => {
    const merged = mergeReadingPlanPrefsValue(
      { ...oldPlan, aheadDays: 12, selectedAt: "2026-08-19T10:00:00.000Z" },
      { ...oldPlan, selectedAt: "2026-08-19T12:00:00.000Z" },
    ) as ReadingPlanPrefsMergeValue;
    expect(merged.aheadDays).toBe(12);
  });

  it("does not let an unchosen default replace a chosen plan", () => {
    const merged = mergeReadingPlanPrefsValue(newPlan, {
      version: 1,
      planId: "triple-loop",
      anchor: "calendar-easter",
      startedOn: "2026-04-05",
      dayCount: 365,
    }) as ReadingPlanPrefsMergeValue;
    expect(merged.planId).toBe("mcheyne");
  });
});
