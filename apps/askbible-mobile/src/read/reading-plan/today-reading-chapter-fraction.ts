import AsyncStorage from "@react-native-async-storage/async-storage";
import { isNtDeepRepeatPlanId } from "./nt-deep-repeat-plan";
import { markNtDeepRepeatChapterRead } from "./nt-deep-repeat-progress";
import { trackForNtDeepRepeatBookId } from "./nt-deep-repeat-reading";
import { isPointerReadingPlanId } from "@/lib/bible/reading-plans/pointer-reading-plan";
import { isTripleLoopPlanId } from "./triple-loop-plan";
import {
  buildTodayReadingScopeKey,
  isSameTodayReadingPlanScope,
  markTodayReadingItemDone,
  readTodayReadingDoneKeys,
  readingIncludesChapter,
  resolveLocalTodayReadingScopeKey,
  todayReadingItemKey,
} from "./today-reading-done";
import {
  resolveEffectiveEpochDay,
  resolveEffectiveReadingPlanDayIndex,
} from "./reading-plan-ahead";
import { loadTodayReadingPlanPayload } from "./today-reading-plan-payload";
import { readEffectiveReadingPlanPrefs } from "./reading-plan-prefs";
import { markTripleLoopChapterRead } from "./triple-loop-progress";
import { trackForBookId } from "./triple-loop-reading";
import { READING_HABIT_MIN_FRACTION } from "../reading-habit-stats";
import type { ReadingPlanRange } from "./types";

/** 读到该比例即视为今日计划该行已完成（与滚动/音频进度共用）。 */
export const TODAY_READING_AUTO_DONE_FRACTION = 0.88;

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

async function persistTodayReadingChapterFractionRecord(
  record: TodayReadingChapterFractionRecord,
): Promise<void> {
  await AsyncStorage.setItem(TODAY_READING_CHAPTER_FRACTION_KEY, JSON.stringify(record));
  await AsyncStorage.removeItem(TODAY_READING_CHAPTER_FRACTION_KEY_LEGACY);
  emit();
}

async function writeRecord(record: TodayReadingChapterFractionRecord): Promise<void> {
  try {
    await persistTodayReadingChapterFractionRecord(record);
    const { notifyMemberReadingLocalChanged } = await import("../../member-sync/requestMemberReadingSync");
    notifyMemberReadingLocalChanged("todayReadingFraction");
  } catch {
    /* ignore */
  }
}

export async function readTodayReadingChapterFractionRecord(): Promise<TodayReadingChapterFractionRecord | null> {
  return readRecord();
}

export async function replaceTodayReadingChapterFractionRecord(
  record: TodayReadingChapterFractionRecord,
): Promise<void> {
  try {
    await persistTodayReadingChapterFractionRecord(record);
  } catch {
    /* ignore */
  }
}

export async function readTodayReadingChapterFractions(
  scopeKey: string,
): Promise<Record<string, number>> {
  const record = await readRecord();
  if (!record) return {};
  if (record.scopeKey === scopeKey || isSameTodayReadingPlanScope(record.scopeKey, scopeKey)) {
    return { ...record.fractions };
  }
  return {};
}

export async function normalizeTodayReadingFractionForLocalPrefs(
  record: TodayReadingChapterFractionRecord,
): Promise<TodayReadingChapterFractionRecord> {
  const scopeKey = await resolveLocalTodayReadingScopeKey();
  return { version: 1, scopeKey, fractions: { ...record.fractions } };
}

export async function setTodayReadingChapterFraction(
  scopeKey: string,
  itemKey: string,
  fraction: number,
): Promise<Record<string, number>> {
  const record = await readRecord();
  const base =
    record && (record.scopeKey === scopeKey || isSameTodayReadingPlanScope(record.scopeKey, scopeKey))
      ? { ...record.fractions }
      : ({} as Record<string, number>);
  const next = clampFraction(Math.max(base[itemKey] ?? 0, fraction));
  base[itemKey] = next;
  await writeRecord({ version: 1, scopeKey, fractions: base });
  return base;
}

async function maybeAutoMarkTodayReadingItemDone(
  scopeKey: string,
  itemKey: string,
  fraction: number,
): Promise<void> {
  if (fraction < TODAY_READING_AUTO_DONE_FRACTION) return;
  const done = await readTodayReadingDoneKeys(scopeKey);
  if (done.has(itemKey)) return;
  await markTodayReadingItemDone(scopeKey, itemKey);
}

export function readingPlanRangeUnitCount(r: ReadingPlanRange): number {
  return Math.max(1, r.endChapter - r.startChapter + 1);
}

/** 多章范围：按当前读到第几章 + 本章进度折算整段完成度（1/5…5/5）。 */
export function readingPlanRangeAggregateFraction(
  reading: ReadingPlanRange,
  chapter: number,
  perChapterFraction: number,
): number {
  const units = readingPlanRangeUnitCount(reading);
  const per = clampFraction(perChapterFraction);
  if (units <= 1) return per;
  const index = Math.min(units, Math.max(1, Math.trunc(chapter) - reading.startChapter + 1));
  return clampFraction((index - 1 + per) / units);
}

export function isTodayReadingPlanItemComplete(
  reading: ReadingPlanRange,
  opts: {
    itemKey: string;
    doneKeys: Set<string>;
    completedChapterKeys: Set<string>;
  },
): boolean {
  const start = Math.max(1, Math.trunc(reading.startChapter));
  const end = Math.max(start, Math.trunc(reading.endChapter));
  const multi = end > start;
  for (let ch = start; ch <= end; ch += 1) {
    if (!opts.completedChapterKeys.has(`${reading.bookId}:${ch}`)) {
      return multi ? false : opts.doneKeys.has(opts.itemKey);
    }
  }
  return true;
}

/** 进入今日计划对应章节时更新段落进度（不自动勾选完成） */
export async function recordTodayReadingChapterFraction(
  bookId: string,
  chapter: number,
  fraction: number,
  opts?: { dayCount?: number },
): Promise<void> {
  const prefs = await readEffectiveReadingPlanPrefs();
  const isPointerPlan = isPointerReadingPlanId(prefs.planId);
  const dayCount = opts?.dayCount ?? prefs.dayCount ?? 365;
  const dayIndex =
    !isPointerPlan && dayCount ? resolveEffectiveReadingPlanDayIndex(prefs, dayCount) : null;
  if (!isPointerPlan && dayIndex == null) return;

  const perChapter = clampFraction(fraction);
  if (isTripleLoopPlanId(prefs.planId) && trackForBookId(bookId) && perChapter >= 0.92) {
    await markTripleLoopChapterRead(bookId, chapter);
  }
  if (isNtDeepRepeatPlanId(prefs.planId) && trackForNtDeepRepeatBookId(bookId) && perChapter >= 0.92) {
    await markNtDeepRepeatChapterRead(bookId, chapter);
  }

  const payload = await loadTodayReadingPlanPayload(prefs, { dayCount: opts?.dayCount });
  const reading = payload?.day?.readings.find((r) => readingIncludesChapter(r, bookId, chapter));
  if (!reading) return;

  const scopeKey = buildTodayReadingScopeKey({
    planId: prefs.planId,
    isTripleLoop: isTripleLoopPlanId(prefs.planId),
    epochDay: resolveEffectiveEpochDay(prefs),
    dayIndex,
  });
  const itemKey = todayReadingItemKey(reading, prefs.planId);
  const total = readingPlanRangeAggregateFraction(reading, chapter, perChapter);
  await setTodayReadingChapterFraction(scopeKey, itemKey, total);
  await maybeAutoMarkTodayReadingItemDone(scopeKey, itemKey, total);
  if (total >= READING_HABIT_MIN_FRACTION) {
    const { touchReadingHabitDay } = await import("../reading-habit-stats");
    void touchReadingHabitDay();
  }
}
