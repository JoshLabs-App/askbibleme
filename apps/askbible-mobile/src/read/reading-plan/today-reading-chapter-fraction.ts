import AsyncStorage from "@react-native-async-storage/async-storage";
import { isTripleLoopPlanId } from "./triple-loop-plan";
import {
  buildTodayReadingScopeKey,
  readingIncludesChapter,
  todayReadingItemKey,
} from "./today-reading-done";
import { loadTodayReadingPlanPayload } from "./today-reading-plan-payload";
import {
  readEffectiveReadingPlanPrefs,
  resolveReadingPlanDayIndex,
} from "./reading-plan-prefs";
import { getReadingPlanDaySinceEpoch } from "./reading-plan-epoch";
import { markTripleLoopChapterRead } from "./triple-loop-progress";
import { trackForBookId } from "./triple-loop-reading";
import type { ReadingPlanRange } from "./types";

export const TODAY_READING_CHAPTER_FRACTION_KEY = "askbible-today-reading-chapter-fraction-v1";
export const TODAY_READING_CHAPTER_FRACTION_KEY_LEGACY = "selah-today-reading-chapter-fraction-v1";

export type TodayReadingChapterFractionRecord = {
  version: 1;
  scopeKey: string;
  /** itemKey → 0..1 */
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

async function readRecord(): Promise<TodayReadingChapterFractionRecord | null> {
  try {
    const raw =
      (await AsyncStorage.getItem(TODAY_READING_CHAPTER_FRACTION_KEY)) ??
      (await AsyncStorage.getItem(TODAY_READING_CHAPTER_FRACTION_KEY_LEGACY));
    if (raw != null) {
      await AsyncStorage.setItem(TODAY_READING_CHAPTER_FRACTION_KEY, raw);
      await AsyncStorage.removeItem(TODAY_READING_CHAPTER_FRACTION_KEY_LEGACY);
    }
    return parseRecord(raw);
  } catch {
    return null;
  }
}

async function writeRecord(record: TodayReadingChapterFractionRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(TODAY_READING_CHAPTER_FRACTION_KEY, JSON.stringify(record));
    await AsyncStorage.removeItem(TODAY_READING_CHAPTER_FRACTION_KEY_LEGACY);
    emit();
  } catch {
    /* ignore */
  }
}

export async function readTodayReadingChapterFractions(
  scopeKey: string,
): Promise<Record<string, number>> {
  const record = await readRecord();
  if (!record || record.scopeKey !== scopeKey) return {};
  return { ...record.fractions };
}

export async function setTodayReadingChapterFraction(
  scopeKey: string,
  itemKey: string,
  fraction: number,
): Promise<Record<string, number>> {
  const record = await readRecord();
  const base =
    record?.scopeKey === scopeKey ? { ...record.fractions } : ({} as Record<string, number>);
  const next = clampFraction(Math.max(base[itemKey] ?? 0, fraction));
  base[itemKey] = next;
  await writeRecord({ version: 1, scopeKey, fractions: base });
  return base;
}

export function readingPlanRangeUnitCount(r: ReadingPlanRange): number {
  return Math.max(1, r.endChapter - r.startChapter + 1);
}

/** 进入今日计划对应章节时更新段落进度（不自动勾选完成） */
export async function recordTodayReadingChapterFraction(
  bookId: string,
  chapter: number,
  fraction: number,
  opts?: { dayCount?: number },
): Promise<void> {
  const prefs = await readEffectiveReadingPlanPrefs();
  const isTripleLoop = isTripleLoopPlanId(prefs.planId);
  const dayCount = opts?.dayCount ?? prefs.dayCount ?? 365;
  const dayIndex = !isTripleLoop && dayCount ? resolveReadingPlanDayIndex(prefs, dayCount) : null;
  if (!isTripleLoop && dayIndex == null) return;

  const perChapter = clampFraction(fraction);
  if (isTripleLoop && trackForBookId(bookId) && perChapter >= 0.92) {
    await markTripleLoopChapterRead(bookId, chapter);
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
  await setTodayReadingChapterFraction(scopeKey, itemKey, total);
}
