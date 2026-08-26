const STORAGE_KEY = "askbible-plan-play-listened-dates-v1";

type RecordV1 = {
  version: 1;
  dates: string[];
};

const listeners = new Set<() => void>();
let cachedDates = new Set<string>();
let hydrated = false;

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

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const parsed = parseRecord(window.localStorage.getItem(STORAGE_KEY));
    if (parsed) {
      cachedDates = new Set(parsed.dates);
      emit();
    }
  } catch {
    /* ignore */
  }
}

export function subscribePlanPlayListenedDates(onStore: () => void): () => void {
  hydrate();
  listeners.add(onStore);
  return () => listeners.delete(onStore);
}

export function getPlanPlayListenedDates(): ReadonlySet<string> {
  hydrate();
  return cachedDates;
}

export function getEmptyPlanPlayListenedDates(): ReadonlySet<string> {
  return EMPTY_LISTENED_DATES;
}

export function markPlanPlayListenedDate(isoDate: string): void {
  if (typeof window === "undefined") return;
  hydrate();
  const date = isoDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  if (!cachedDates.has(date)) {
    const next = new Set(cachedDates);
    next.add(date);
    cachedDates = next;
    emit();
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 1, dates: [...next].sort() } satisfies RecordV1),
      );
    } catch {
      /* ignore */
    }
  }
  void import("@/lib/read/reading-habit-stats").then(({ touchReadingHabitDay }) => {
    touchReadingHabitDay(date);
  });
}
