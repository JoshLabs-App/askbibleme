/** Expo weekly trigger convention: 1 = Sunday … 7 = Saturday. */
export type ReadingReminderWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const READING_REMINDER_WEEKDAYS_ALL: readonly ReadingReminderWeekday[] = [
  1, 2, 3, 4, 5, 6, 7,
] as const;

/** music = 预备音乐闹钟；scripture = 直接开今日读经。旧值 notification 读入时归一成 music。 */
export type ReadingReminderMode = "music" | "scripture";

export type NotificationPrefsV1 = {
  version: 1;
  readingReminderEnabled: boolean;
  readingReminderHour: number;
  readingReminderMinute: number;
  /** Always all 7 days (product: daily only; field kept for native schedule JSON). */
  readingReminderWeekdays: ReadingReminderWeekday[];
  /** Prelude music alarm, or Scripture alarm. */
  readingReminderMode: ReadingReminderMode;
  dailyVerseEnabled: boolean;
  dailyVerseHour: number;
  dailyVerseMinute: number;
};

/** Fresh install: morning verse notification + 07:00 Scripture alarm. */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefsV1 = {
  version: 1,
  readingReminderEnabled: true,
  readingReminderHour: 7,
  readingReminderMinute: 0,
  readingReminderWeekdays: [...READING_REMINDER_WEEKDAYS_ALL],
  readingReminderMode: "scripture",
  dailyVerseEnabled: true,
  dailyVerseHour: 8,
  dailyVerseMinute: 0,
};

export function normalizeReadingReminderMode(raw: unknown): ReadingReminderMode {
  if (raw === "scripture") return "scripture";
  return "music";
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
    // 读经提醒只做「每天」；旧的按星期子集一律归一成全周。
    readingReminderWeekdays: [...READING_REMINDER_WEEKDAYS_ALL],
    readingReminderMode: normalizeReadingReminderMode(p.readingReminderMode),
    // 每日金句通知没有设置入口，始终开着，时间用默认或已存值。
    dailyVerseEnabled: true,
    dailyVerseHour: clampHour(p.dailyVerseHour, DEFAULT_NOTIFICATION_PREFS.dailyVerseHour),
    dailyVerseMinute: clampMinute(p.dailyVerseMinute, DEFAULT_NOTIFICATION_PREFS.dailyVerseMinute),
  };
}
