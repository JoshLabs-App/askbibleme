export const NOTIFICATION_PREFS_STORAGE_KEY = "askbible-mobile-notification-prefs-v1";
export const NOTIFICATION_BOOTSTRAP_STORAGE_KEY = "askbible-mobile-notification-bootstrap-v1";

export const READING_REMINDER_NOTIFICATION_ID = "askbible-reading-reminder";

export function readingReminderWeekdayNotificationId(weekday: number): string {
  return `askbible-reading-reminder-wd-${weekday}`;
}

export const DAILY_VERSE_NOTIFICATION_ID = "askbible-daily-verse";

/**
 * 渠道 id 带 v2：Android 的渠道设置**只在首次创建时生效**，改了 importance 也不会作用到
 * 已存在的渠道上。v1 建成了 DEFAULT（进通知栏、有声音，但不弹横幅），用户反馈「早上起来
 * 没有真实提醒，只在后台」正是这个表现。换新 id 才能让 HIGH 对老用户也生效。
 * 旧渠道由 pruneLegacyAndroidChannels() 删除，否则会在系统设置里留下两条同名项。
 */
export const ANDROID_CHANNEL_READING_REMINDER = "reading-reminder-v2";
export const ANDROID_CHANNEL_DAILY_VERSE = "daily-verse-v2";

/** v1 渠道 id，仅用于卸载清理。 */
export const ANDROID_LEGACY_CHANNEL_IDS = ["reading-reminder", "daily-verse"] as const;

export type NotificationKind = "reading-reminder" | "reading-alarm-auto-continue" | "daily-verse";

export const APP_GROUP_ID = "group.me.askbible.shared";
export const WIDGET_SNAPSHOT_STORAGE_KEY = "askbible-daily-verse-widget-v1";
export const WIDGET_TEXT_SCALE_STORAGE_KEY = "askbible-daily-verse-widget-text-scale-v1";
