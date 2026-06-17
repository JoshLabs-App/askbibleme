import AsyncStorage from "@react-native-async-storage/async-storage";
import { toLocalDateString } from "./reading-plan/reading-plan-prefs";

export const READING_HABIT_STATS_STORAGE_KEY = "askbible-reading-habit-stats-v1";
export const READING_HABIT_STATS_STORAGE_KEY_LEGACY = "selah-reading-habit-stats-v1";

export type ReadingHabitStatsRecord = {
  version: 1;
  /** 日历日 YYYY-MM-DD：当日读经计划全部勾选完成 */
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

async function readReadingHabitStatsRecord(): Promise<ReadingHabitStatsRecord> {
  try {
    const raw =
      (await AsyncStorage.getItem(READING_HABIT_STATS_STORAGE_KEY)) ??
      (await AsyncStorage.getItem(READING_HABIT_STATS_STORAGE_KEY_LEGACY));
    if (raw != null) {
      await AsyncStorage.setItem(READING_HABIT_STATS_STORAGE_KEY, raw);
      await AsyncStorage.removeItem(READING_HABIT_STATS_STORAGE_KEY_LEGACY);
    }
    return parseRecord(raw) ?? { version: 1, completedDates: [] };
  } catch {
    return { version: 1, completedDates: [] };
  }
}

export async function readReadingHabitStats(): Promise<ReadingHabitStatsRecord> {
  const record = await readReadingHabitStatsRecord();
  snapshotFromRecord(record);
  return record;
}

async function writeReadingHabitStats(record: ReadingHabitStatsRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(READING_HABIT_STATS_STORAGE_KEY, JSON.stringify(record));
    await AsyncStorage.removeItem(READING_HABIT_STATS_STORAGE_KEY_LEGACY);
    emit();
    const { notifyMemberReadingLocalChanged } = await import("../member-sync/requestMemberReadingSync");
    notifyMemberReadingLocalChanged("habitStats");
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

/** 连读：从最近完成日往前数连续天数（今日未完成则从昨日算起） */
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

const EMPTY_SNAPSHOT: ReadingHabitStatsSnapshot = { readDays: 0, streakDays: 0 };

let cachedSnapshot: ReadingHabitStatsSnapshot | null = null;

export function getCachedReadingHabitStatsSnapshot(): ReadingHabitStatsSnapshot {
  return cachedSnapshot ?? EMPTY_SNAPSHOT;
}

export function readingHabitStatsSnapshotsEqual(
  a: ReadingHabitStatsSnapshot,
  b: ReadingHabitStatsSnapshot,
): boolean {
  return a.readDays === b.readDays && a.streakDays === b.streakDays;
}

export function snapshotFromRecord(
  record: ReadingHabitStatsRecord,
  today: string = toLocalDateString(new Date()),
): ReadingHabitStatsSnapshot {
  const dates = record.completedDates;
  const snapshot = {
    readDays: dates.length,
    streakDays: computeReadingStreak(dates, today),
  };
  cachedSnapshot = snapshot;
  return snapshot;
}

export async function replaceReadingHabitStatsRecord(record: ReadingHabitStatsRecord): Promise<void> {
  await writeReadingHabitStats(record);
  snapshotFromRecord(record);
}

/** 今日计划是否全部读完时同步日历完成记录 */
export async function syncReadingHabitDayCompletion(allDoneToday: boolean): Promise<ReadingHabitStatsRecord> {
  const today = toLocalDateString(new Date());
  const record = await readReadingHabitStats();
  const hadToday = record.completedDates.includes(today);
  if (allDoneToday === hadToday) return record;
  const set = new Set(record.completedDates);
  if (allDoneToday) set.add(today);
  else set.delete(today);
  const next: ReadingHabitStatsRecord = {
    version: 1,
    completedDates: [...set].sort(),
  };
  await writeReadingHabitStats(next);
  snapshotFromRecord(next);
  return next;
}
