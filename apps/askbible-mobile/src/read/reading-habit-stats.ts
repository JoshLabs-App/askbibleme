import AsyncStorage from "@react-native-async-storage/async-storage";
import { toLocalDateString } from "./reading-plan/reading-plan-prefs";

export const READING_HABIT_STATS_STORAGE_KEY = "askbible-reading-habit-stats-v1";
export const READING_HABIT_STATS_STORAGE_KEY_LEGACY = "selah-reading-habit-stats-v1";

export type ReadingHabitStatsRecord = {
  version: 1;
  /** 日历日 YYYY-MM-DD：当日打开过 App 或有读经操作（与计划是否读完无关） */
  completedDates: string[];
};

/** 滚动/音频进度达到该比例，即计为当日有读经。 */
export const READING_HABIT_MIN_FRACTION = 0.2;

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
const EMPTY_COMPLETED_DATES: readonly string[] = [];

let cachedSnapshot: ReadingHabitStatsSnapshot | null = null;
let cachedCompletedDates: readonly string[] = EMPTY_COMPLETED_DATES;

export function getCachedReadingHabitStatsSnapshot(): ReadingHabitStatsSnapshot {
  return cachedSnapshot ?? EMPTY_SNAPSHOT;
}

export function getCachedReadingHabitCompletedDates(): readonly string[] {
  return cachedCompletedDates;
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
  cachedCompletedDates = dates.length ? dates : EMPTY_COMPLETED_DATES;
  const snapshot = {
    readDays: dates.length,
    streakDays: computeReadingStreak(dates, today),
  };
  cachedSnapshot = snapshot;
  return snapshot;
}

export async function replaceReadingHabitStatsRecord(record: ReadingHabitStatsRecord): Promise<void> {
  const local = await readReadingHabitStatsRecord();
  const merged = mergeReadingHabitStatsRecords(local, record);
  await writeReadingHabitStats(merged);
  snapshotFromRecord(merged);
}

/** 帐号切换：清空本机习惯统计（不触发再上传）。 */
export async function clearReadingHabitStatsLocal(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      READING_HABIT_STATS_STORAGE_KEY,
      READING_HABIT_STATS_STORAGE_KEY_LEGACY,
    ]);
  } catch {
    /* ignore */
  }
  snapshotFromRecord({ version: 1, completedDates: [] });
  emit();
}

export function mergeReadingHabitStatsRecords(
  a: ReadingHabitStatsRecord,
  b: ReadingHabitStatsRecord,
): ReadingHabitStatsRecord {
  return {
    version: 1,
    completedDates: [...new Set([...a.completedDates, ...b.completedDates])].sort(),
  };
}

/** 换计划前：若今日在任意计划下已有进度，先记入累计读经天（只增不减）。 */
export async function preserveReadingHabitBeforePlanSwitch(): Promise<void> {
  const today = toLocalDateString(new Date());
  const record = await readReadingHabitStats();
  if (record.completedDates.includes(today)) return;

  const [fractionMod, doneMod] = await Promise.all([
    import("./reading-plan/today-reading-chapter-fraction"),
    import("./reading-plan/today-reading-done"),
  ]);
  const [fraction, done] = await Promise.all([
    fractionMod.readTodayReadingChapterFractionRecord(),
    doneMod.readTodayReadingDoneRecord(),
  ]);
  const hasFraction =
    fraction != null &&
    Object.values(fraction.fractions).some((value) => value >= READING_HABIT_MIN_FRACTION);
  const hasDone = (done?.doneKeys.length ?? 0) > 0;
  if (hasFraction || hasDone) {
    await touchReadingHabitDay(today);
  }
}

/** 记录某日已有读经（只增不减，用于读完章节等）。 */
export async function touchReadingHabitDay(
  date: string = toLocalDateString(new Date()),
): Promise<ReadingHabitStatsRecord> {
  if (cachedCompletedDates.includes(date)) {
    return { version: 1, completedDates: [...cachedCompletedDates] };
  }
  const record = await readReadingHabitStats();
  if (record.completedDates.includes(date)) return record;
  const next: ReadingHabitStatsRecord = {
    version: 1,
    completedDates: [...record.completedDates, date].sort(),
  };
  await writeReadingHabitStats(next);
  snapshotFromRecord(next, date);
  return next;
}

/**
 * 任意读经活动记入当日（与当前读经计划无关，只增不减）：
 * 打开经文章、播章音频、首页金句点播等。同步日历黄标 + 连读日。
 */
export async function recordAnyReadingActivityDay(
  date: string = toLocalDateString(new Date()),
): Promise<void> {
  await touchReadingHabitDay(date);
  try {
    const { markPlanPlayListenedDate } = await import("./plan-play-listened-dates");
    await markPlanPlayListenedDate(date);
  } catch {
    /* ignore */
  }
}

/** 根据今日是否有读经活动更新当日记录；`undefined` 表示状态未知，不写入。只增不减——换计划不会冲掉历史读经天。 */
export async function syncReadingHabitDayCompletion(
  hasReadingToday: boolean | undefined,
): Promise<ReadingHabitStatsRecord> {
  if (hasReadingToday !== true) {
    return readReadingHabitStats();
  }
  return touchReadingHabitDay();
}

void readReadingHabitStats();
