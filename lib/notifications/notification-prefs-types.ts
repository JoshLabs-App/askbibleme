/** Expo weekly trigger convention: 1 = Sunday … 7 = Saturday. */
export type ReadingReminderWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const READING_REMINDER_WEEKDAYS_ALL: readonly ReadingReminderWeekday[] = [
  1, 2, 3, 4, 5, 6, 7,
] as const;

export type ReadingReminderMode = "music" | "scripture";

export type NotificationPrefsV1 = {
  version: 1;
  readingReminderEnabled: boolean;
  readingReminderHour: number;
  readingReminderMinute: number;
  /** Subset of weekdays (1=Sun … 7=Sat). Empty normalizes to all days. */
  readingReminderWeekdays: ReadingReminderWeekday[];
  /** Daily morning alarm: play prelude music only, or start Scripture reading only. */
  readingReminderMode: ReadingReminderMode;
  dailyVerseEnabled: boolean;
  dailyVerseHour: number;
  dailyVerseMinute: number;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefsV1 = {
  version: 1,
  readingReminderEnabled: false,
  readingReminderHour: 7,
  readingReminderMinute: 0,
  readingReminderWeekdays: [...READING_REMINDER_WEEKDAYS_ALL],
  readingReminderMode: "scripture",
  dailyVerseEnabled: false,
  dailyVerseHour: 12,
  dailyVerseMinute: 0,
};

export function normalizeReadingReminderMode(raw: unknown): ReadingReminderMode {
  return raw === "music" ? "music" : "scripture";
}

export function normalizeReadingReminderWeekdays(raw: unknown): ReadingReminderWeekday[] {
  if (!Array.isArray(raw)) return [...READING_REMINDER_WEEKDAYS_ALL];
  const uniq = new Set<ReadingReminderWeekday>();
  for (const item of raw) {
    const n = typeof item === "number" ? item : Number(item);
    if (Number.isFinite(n) && n >= 1 && n <= 7) {
      uniq.add(Math.floor(n) as ReadingReminderWeekday);
    }
  }
  if (uniq.size === 0) return [...READING_REMINDER_WEEKDAYS_ALL];
  return [...uniq].sort((a, b) => a - b);
}

export function isAllReadingReminderWeekdays(weekdays: readonly number[]): boolean {
  return weekdays.length === READING_REMINDER_WEEKDAYS_ALL.length;
}

export function clampHour(raw: unknown, fallback: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(23, Math.floor(n)));
}

export function clampMinute(raw: unknown, fallback: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(59, Math.floor(n)));
}

export function normalizeNotificationPrefs(raw: unknown): NotificationPrefsV1 {
  const p = raw && typeof raw === "object" ? (raw as Partial<NotificationPrefsV1>) : {};
  if (p.version !== 1) return DEFAULT_NOTIFICATION_PREFS;
  return {
    version: 1,
    readingReminderEnabled: p.readingReminderEnabled === true,
    readingReminderHour: clampHour(p.readingReminderHour, DEFAULT_NOTIFICATION_PREFS.readingReminderHour),
    readingReminderMinute: clampMinute(
      p.readingReminderMinute,
      DEFAULT_NOTIFICATION_PREFS.readingReminderMinute,
    ),
    readingReminderWeekdays: normalizeReadingReminderWeekdays(p.readingReminderWeekdays),
    readingReminderMode: normalizeReadingReminderMode(p.readingReminderMode),
    dailyVerseEnabled: p.dailyVerseEnabled === true,
    dailyVerseHour: clampHour(p.dailyVerseHour, DEFAULT_NOTIFICATION_PREFS.dailyVerseHour),
    dailyVerseMinute: clampMinute(p.dailyVerseMinute, DEFAULT_NOTIFICATION_PREFS.dailyVerseMinute),
  };
}
