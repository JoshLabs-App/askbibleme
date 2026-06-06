import type { ReadingPlanRange } from "@/lib/bible/reading-plans/types";
import { isTripleLoopPlanId } from "@/lib/bible/reading-plans/triple-loop-plan";
import { markTripleLoopChapterRead } from "@/lib/read/triple-loop-progress";
import {
  buildTodayReadingScopeKey,
  readingIncludesChapter,
  todayReadingItemKey,
} from "@/lib/read/today-reading-done";
import { getReadingPlanDaySinceEpoch } from "@/lib/read/reading-plan-epoch";
import {
  readEffectiveReadingPlanPrefs,
  resolveReadingPlanDayIndex,
} from "@/lib/read/reading-plan-prefs";
import { loadTodayReadingPlanPayload } from "@/lib/read/today-reading-plan-payload";
import { trackForBookId } from "@/lib/bible/reading-plans/triple-loop-reading";

export const TODAY_READING_CHAPTER_FRACTION_KEY = "askbible-today-reading-chapter-fraction-v1";
export const TODAY_READING_CHAPTER_FRACTION_KEY_LEGACY = "selah-today-reading-chapter-fraction-v1";

export type TodayReadingChapterFractionRecord = {
  version: 1;
  scopeKey: string;
  fractions: Record<string, number>;
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

export function subscribeTodayReadingChapterFraction(onStore: () => void): () => void {
  listeners.add(onStore);
  return () => listeners.delete(onStore);
}

function clampFraction(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function parseRecord(raw: string | null): TodayReadingChapterFractionRecord | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as Partial<TodayReadingChapterFractionRecord>;
    if (j?.version !== 1 || typeof j.scopeKey !== "string") return null;
    const fractions: Record<string, number> = {};
    if (j.fractions && typeof j.fractions === "object") {
      for (const [k, v] of Object.entries(j.fractions)) {
        if (typeof k === "string" && typeof v === "number") {
          fractions[k] = clampFraction(v);
        }
      }
    }
    return { version: 1, scopeKey: j.scopeKey, fractions };
  } catch {
    return null;
  }
}

function readRecord(): TodayReadingChapterFractionRecord | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw =
      localStorage.getItem(TODAY_READING_CHAPTER_FRACTION_KEY) ??
      localStorage.getItem(TODAY_READING_CHAPTER_FRACTION_KEY_LEGACY);
    if (raw != null) {
      localStorage.setItem(TODAY_READING_CHAPTER_FRACTION_KEY, raw);
      localStorage.removeItem(TODAY_READING_CHAPTER_FRACTION_KEY_LEGACY);
    }
    return parseRecord(raw);
  } catch {
    return null;
  }
}

function writeRecord(record: TodayReadingChapterFractionRecord): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(TODAY_READING_CHAPTER_FRACTION_KEY, JSON.stringify(record));
    localStorage.removeItem(TODAY_READING_CHAPTER_FRACTION_KEY_LEGACY);
    emit();
  } catch {
    /* ignore */
  }
}

export function readTodayReadingChapterFractions(scopeKey: string): Record<string, number> {
  const record = readRecord();
  if (!record || record.scopeKey !== scopeKey) return {};
  return { ...record.fractions };
}

export function setTodayReadingChapterFraction(
  scopeKey: string,
  itemKey: string,
  fraction: number,
): Record<string, number> {
  const record = readRecord();
  const base =
    record?.scopeKey === scopeKey ? { ...record.fractions } : ({} as Record<string, number>);
  const next = clampFraction(Math.max(base[itemKey] ?? 0, fraction));
  base[itemKey] = next;
  writeRecord({ version: 1, scopeKey, fractions: base });
  return base;
}

export function readingPlanRangeUnitCount(r: ReadingPlanRange): number {
  return Math.max(1, r.endChapter - r.startChapter + 1);
}

export async function recordTodayReadingChapterFraction(
  bookId: string,
  chapter: number,
  fraction: number,
  opts?: { dayCount?: number },
): Promise<void> {
  const prefs = readEffectiveReadingPlanPrefs();
  const isTripleLoop = isTripleLoopPlanId(prefs.planId);
  const dayCount = opts?.dayCount ?? prefs.dayCount ?? 365;
  const dayIndex = !isTripleLoop && dayCount ? resolveReadingPlanDayIndex(prefs, dayCount) : null;
  if (!isTripleLoop && dayIndex == null) return;

  const perChapter = clampFraction(fraction);
  if (isTripleLoop && trackForBookId(bookId) && perChapter >= 0.92) {
    markTripleLoopChapterRead(bookId, chapter);
  }

  const payload = await loadTodayReadingPlanPayload(prefs, { dayCount: opts?.dayCount });
  const reading = payload?.day?.readings.find((r) => readingIncludesChapter(r, bookId, chapter));
  if (!reading) return;

  const scopeKey = buildTodayReadingScopeKey({
    planId: prefs.planId,
    isTripleLoop,
    epochDay: getReadingPlanDaySinceEpoch(),
    dayIndex,
  });
  const itemKey = todayReadingItemKey(reading);
  const units = readingPlanRangeUnitCount(reading);
  const total = units <= 1 ? perChapter : perChapter / units;
  setTodayReadingChapterFraction(scopeKey, itemKey, total);
}
