import { toLocalDateString } from "@/lib/read/reading-plan-prefs";

export const READING_HABIT_STATS_STORAGE_KEY = "askbible-reading-habit-stats-v1";
export const READING_HABIT_STATS_STORAGE_KEY_LEGACY = "selah-reading-habit-stats-v1";

export type ReadingHabitStatsRecord = {
  version: 1;
  completedDates: string[];
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

export function subscribeReadingHabitStats(onStore: () => void): () => void {
  listeners.add(onStore);
  return () => listeners.delete(onStore);
}

function parseRecord(raw: string | null): ReadingHabitStatsRecord | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as Partial<ReadingHabitStatsRecord>;
    if (j?.version !== 1) return null;
    const completedDates = Array.isArray(j.completedDates)
      ? [...new Set(j.completedDates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort()
      : [];
    return { version: 1, completedDates };
  } catch {
    return null;
  }
}

export function readReadingHabitStats(): ReadingHabitStatsRecord {
  if (typeof localStorage === "undefined") return { version: 1, completedDates: [] };
  try {
    const raw =
      localStorage.getItem(READING_HABIT_STATS_STORAGE_KEY) ??
      localStorage.getItem(READING_HABIT_STATS_STORAGE_KEY_LEGACY);
    if (raw != null) {
      localStorage.setItem(READING_HABIT_STATS_STORAGE_KEY, raw);
      localStorage.removeItem(READING_HABIT_STATS_STORAGE_KEY_LEGACY);
    }
    return parseRecord(raw) ?? { version: 1, completedDates: [] };
  } catch {
    return { version: 1, completedDates: [] };
  }
}

function writeReadingHabitStats(record: ReadingHabitStatsRecord): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(READING_HABIT_STATS_STORAGE_KEY, JSON.stringify(record));
    localStorage.removeItem(READING_HABIT_STATS_STORAGE_KEY_LEGACY);
    emit();
  } catch {
    /* ignore */
  }
}

function shiftLocalDate(iso: string, deltaDays: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + deltaDays);
  return toLocalDateString(d);
}

export function computeReadingStreak(completedDates: string[], today: string): number {
  const set = new Set(completedDates);
  if (set.size === 0) return 0;
  let cursor = set.has(today) ? today : shiftLocalDate(today, -1);
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = shiftLocalDate(cursor, -1);
  }
  return streak;
}

export type ReadingHabitStatsSnapshot = {
  readDays: number;
  streakDays: number;
};

export function snapshotFromRecord(
  record: ReadingHabitStatsRecord,
  today: string = toLocalDateString(new Date()),
): ReadingHabitStatsSnapshot {
  const dates = record.completedDates;
  return {
    readDays: dates.length,
    streakDays: computeReadingStreak(dates, today),
  };
}

export function replaceReadingHabitStatsRecord(record: ReadingHabitStatsRecord): void {
  writeReadingHabitStats(record);
}

export function syncReadingHabitDayCompletion(allDoneToday: boolean): ReadingHabitStatsRecord {
  const today = toLocalDateString(new Date());
  const record = readReadingHabitStats();
  const set = new Set(record.completedDates);
  if (allDoneToday) set.add(today);
  else set.delete(today);
  const next: ReadingHabitStatsRecord = {
    version: 1,
    completedDates: [...set].sort(),
  };
  writeReadingHabitStats(next);
  return next;
}
