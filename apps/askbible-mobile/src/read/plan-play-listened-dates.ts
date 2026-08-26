import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "askbible-plan-play-listened-dates-v1";

type RecordV1 = {
  version: 1;
  /** 日历日 YYYY-MM-DD：该日计划曾在播放页点听 */
  dates: string[];
};

const listeners = new Set<() => void>();
let cachedDates = new Set<string>();
let hydrated = false;

/** useSyncExternalStore getServerSnapshot 必须稳定引用，禁止每次 new Set。 */
const EMPTY_LISTENED_DATES: ReadonlySet<string> = new Set();

function emit(): void {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* ignore */
    }
  }
}

function parseRecord(raw: string | null): RecordV1 | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as Partial<RecordV1>;
    if (j?.version !== 1) return null;
    const dates = Array.isArray(j.dates)
      ? [...new Set(j.dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort()
      : [];
    return { version: 1, dates };
  } catch {
    return null;
  }
}

async function hydrate(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const parsed = parseRecord(await AsyncStorage.getItem(STORAGE_KEY));
    if (parsed) {
      cachedDates = new Set(parsed.dates);
      emit();
      // 历史点听日并入全局习惯，换计划后连读/黄标仍在。
      if (parsed.dates.length > 0) {
        void import("./reading-habit-stats").then(async ({ readReadingHabitStats, replaceReadingHabitStatsRecord }) => {
          const habit = await readReadingHabitStats();
          const merged = {
            version: 1 as const,
            completedDates: [...new Set([...habit.completedDates, ...parsed.dates])].sort(),
          };
          if (merged.completedDates.length !== habit.completedDates.length) {
            await replaceReadingHabitStatsRecord(merged);
          }
        });
      }
    }
  } catch {
    /* ignore */
  }
}

export function subscribePlanPlayListenedDates(onStore: () => void): () => void {
  void hydrate();
  listeners.add(onStore);
  return () => listeners.delete(onStore);
}

export function getPlanPlayListenedDates(): ReadonlySet<string> {
  void hydrate();
  return cachedDates;
}

export function getEmptyPlanPlayListenedDates(): ReadonlySet<string> {
  return EMPTY_LISTENED_DATES;
}

/** 记录某日历日曾在计划播放页点听（只增不减）；并记入全局读经习惯日。 */
export async function markPlanPlayListenedDate(isoDate: string): Promise<void> {
  await hydrate();
  const date = isoDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  if (!cachedDates.has(date)) {
    const next = new Set(cachedDates);
    next.add(date);
    cachedDates = next;
    emit();
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 1, dates: [...next].sort() } satisfies RecordV1),
      );
    } catch {
      /* ignore */
    }
  }
  try {
    const { touchReadingHabitDay } = await import("./reading-habit-stats");
    await touchReadingHabitDay(date);
  } catch {
    /* ignore */
  }
}
