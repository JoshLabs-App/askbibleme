/** Front music before Scripture audio (seconds). */
export const READING_ALARM_PRELUDE_SEC_OPTIONS = [60, 120, 300, 900, 1800] as const;

export type ReadingAlarmPreludeSec = (typeof READING_ALARM_PRELUDE_SEC_OPTIONS)[number];

export function normalizeReadingAlarmPreludeSec(raw: unknown): ReadingAlarmPreludeSec {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (READING_ALARM_PRELUDE_SEC_OPTIONS.includes(n as ReadingAlarmPreludeSec)) {
    return n as ReadingAlarmPreludeSec;
  }
  if (n === 120) return 120;
  return 60;
}

export function nextReadingAlarmPreludeSec(current: number): ReadingAlarmPreludeSec {
  const normalized = normalizeReadingAlarmPreludeSec(current);
  const idx = READING_ALARM_PRELUDE_SEC_OPTIONS.indexOf(normalized);
  return READING_ALARM_PRELUDE_SEC_OPTIONS[(idx + 1) % READING_ALARM_PRELUDE_SEC_OPTIONS.length]!;
}

export function formatReadingAlarmPreludeDuration(
  locale: "en" | "zh-CN" | "zh-TW",
  sec: number,
): string {
  const normalized = normalizeReadingAlarmPreludeSec(sec);
  const minutes = normalized / 60;
  if (locale === "en") {
    return minutes === 1 ? "1 min" : `${minutes} min`;
  }
  return `${minutes} 分钟`;
}

export function formatReadingAlarmPreludeRemaining(
  locale: "en" | "zh-CN" | "zh-TW",
  secondsLeft: number,
): string {
  const left = Math.max(0, Math.ceil(secondsLeft));
  if (left >= 60) {
    const minutes = Math.ceil(left / 60);
    if (locale === "en") {
      return minutes === 1
        ? "Starting in ~1 min — continuous through today's plan"
        : `Starting in ~${minutes} min — continuous through today's plan`;
    }
    return `约 ${minutes} 分钟后开始朗读今日读经（逐章连续，直至今日读完）`;
  }
  if (locale === "en") {
    return `Starting today's reading in ~${left}s — continuous through today's plan`;
  }
  return `约 ${left} 秒后开始朗读今日读经（逐章连续，直至今日读完）`;
}

export function readingAlarmPreludeNotificationHint(
  locale: "en" | "zh-CN" | "zh-TW",
  sec: number,
): string {
  const duration = formatReadingAlarmPreludeDuration(locale, sec);
  if (locale === "en") {
    return `About ${duration} of front music, then continuous reading for today.`;
  }
  return `约 ${duration}前置音乐后，将连续朗读今日读经。`;
}

/** 0 = Sunday … 6 = Saturday (matches JS `Date#getDay()`). */
export const ALL_READING_ALARM_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export function normalizeReadingAlarmWeekdays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [...ALL_READING_ALARM_WEEKDAYS];
  const picked = [
    ...new Set(
      raw.filter((day): day is number => typeof day === "number" && day >= 0 && day <= 6),
    ),
  ].sort((a, b) => a - b);
  return picked.length > 0 ? picked : [...ALL_READING_ALARM_WEEKDAYS];
}

export function isEveryReadingAlarmWeekday(days: number[]): boolean {
  return days.length === 7;
}

export function readingAlarmWeekdaysToMask(days: number[]): number {
  return days.reduce((mask, day) => mask | (1 << day), 0);
}

export function readingAlarmWeekdaysFromMask(mask: number): number[] {
  const days: number[] = [];
  for (let day = 0; day <= 6; day += 1) {
    if ((mask & (1 << day)) !== 0) days.push(day);
  }
  return days.length > 0 ? days : [...ALL_READING_ALARM_WEEKDAYS];
}

export function toggleReadingAlarmWeekday(days: number[], day: number): number[] {
  const set = new Set(normalizeReadingAlarmWeekdays(days));
  if (set.has(day)) {
    if (set.size <= 1) return days;
    set.delete(day);
  } else {
    set.add(day);
  }
  return [...set].sort((a, b) => a - b);
}
