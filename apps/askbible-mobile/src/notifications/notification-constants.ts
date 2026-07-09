export const NOTIFICATION_PREFS_STORAGE_KEY = "askbible-mobile-notification-prefs-v1";
export const NOTIFICATION_BOOTSTRAP_STORAGE_KEY = "askbible-mobile-notification-bootstrap-v1";

export const READING_REMINDER_NOTIFICATION_ID = "askbible-reading-reminder";

export function readingReminderWeekdayNotificationId(weekday: number): string {
  return `askbible-reading-reminder-wd-${weekday}`;
}

export const DAILY_VERSE_NOTIFICATION_ID = "askbible-daily-verse";

export const ANDROID_CHANNEL_READING_REMINDER = "reading-reminder";
export const ANDROID_CHANNEL_DAILY_VERSE = "daily-verse";

export type NotificationKind = "reading-reminder" | "reading-alarm-auto-continue" | "daily-verse";

export const APP_GROUP_ID = "group.me.askbible.shared";
export const WIDGET_SNAPSHOT_STORAGE_KEY = "askbible-daily-verse-widget-v1";
export const WIDGET_TEXT_SCALE_STORAGE_KEY = "askbible-daily-verse-widget-text-scale-v1";
