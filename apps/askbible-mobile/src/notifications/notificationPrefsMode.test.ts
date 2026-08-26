import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTIFICATION_PREFS,
  normalizeNotificationPrefs,
  normalizeReadingReminderMode,
} from "../../../../lib/notifications/notification-prefs-types";

describe("normalizeReadingReminderMode", () => {
  it("keeps music and scripture", () => {
    expect(normalizeReadingReminderMode("music")).toBe("music");
    expect(normalizeReadingReminderMode("scripture")).toBe("scripture");
  });

  it("migrates the removed notification-only mode to music", () => {
    expect(normalizeReadingReminderMode("notification")).toBe("music");
  });

  it("defaults new installs to 07:00 Scripture", () => {
    expect(DEFAULT_NOTIFICATION_PREFS.readingReminderMode).toBe("scripture");
    expect(DEFAULT_NOTIFICATION_PREFS.readingReminderHour).toBe(7);
    expect(DEFAULT_NOTIFICATION_PREFS.readingReminderMinute).toBe(0);
  });

  it("keeps daily verse notification on even if stored off", () => {
    expect(DEFAULT_NOTIFICATION_PREFS.dailyVerseEnabled).toBe(true);
    expect(
      normalizeNotificationPrefs({
        ...DEFAULT_NOTIFICATION_PREFS,
        dailyVerseEnabled: false,
      }).dailyVerseEnabled,
    ).toBe(true);
  });

  it("forces reading reminder to every day", () => {
    expect(
      normalizeNotificationPrefs({
        ...DEFAULT_NOTIFICATION_PREFS,
        readingReminderWeekdays: [2, 4, 6],
      }).readingReminderWeekdays,
    ).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});
