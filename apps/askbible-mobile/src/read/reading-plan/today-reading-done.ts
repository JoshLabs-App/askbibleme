import AsyncStorage from "@react-native-async-storage/async-storage";
import { isNtDeepRepeatPlanId } from "./nt-deep-repeat-plan";
import { markNtDeepRepeatChapterRead } from "./nt-deep-repeat-progress";
import { trackForNtDeepRepeatBookId } from "./nt-deep-repeat-reading";
import { isPointerReadingPlanId } from "./pointer-reading-plan";
import { isTripleLoopPlanId } from "./triple-loop-plan";
import { trackForBookId } from "./triple-loop-reading";
import type { ReadingPlanRange } from "./types";
import {
  resolveEffectiveEpochDay,
  resolveEffectiveReadingPlanDayIndex,
} from "./reading-plan-ahead";
import { readEffectiveReadingPlanPrefs, type ReadingPlanPrefs } from "./reading-plan-prefs";
import { loadTodayReadingPlanPayload } from "./today-reading-plan-payload";
import { markTripleLoopChapterRead } from "./triple-loop-progress";
import type { TripleLoopTrack } from "./triple-loop-reading";

export const TODAY_READING_DONE_STORAGE_KEY = "askbible-today-reading-done-v1";
export const TODAY_READING_DONE_STORAGE_KEY_LEGACY = "selah-today-reading-done-v1";

export type TodayReadingDoneRecord = {
  version: 1;
  scopeKey: string;
  doneKeys: string[];
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

export function subscribeTodayReadingDone(onStore: () => void): () => void {
  listeners.add(onStore);
  return () => listeners.delete(onStore);
}

export function buildTodayReadingScopeKey(opts: {
  planId: string;
  isTripleLoop: boolean;
  epochDay: number;
  dayIndex: number | null;
}): string {
  if (opts.isTripleLoop || isNtDeepRepeatPlanId(opts.planId)) {
    return `${opts.planId}:epoch:${opts.epochDay}`;
  }
  if (opts.dayIndex != null) return `${opts.planId}:day:${opts.dayIndex}`;
  return opts.planId;
}

export function planIdFromTodayReadingScopeKey(scopeKey: string | null | undefined): string | null {
  if (!scopeKey?.trim()) return null;
  return scopeKey.split(":")[0]?.trim() || null;
}

/** 同一读经计划（planId 相同）视为可合并的今日进度 scope。 */
export function isSameTodayReadingPlanScope(
  scopeA: string | null | undefined,
  scopeB: string | null | undefined,
): boolean {
  if (!scopeA || !scopeB) return false;
  if (scopeA === scopeB) return true;
  const planA = planIdFromTodayReadingScopeKey(scopeA);
  const planB = planIdFromTodayReadingScopeKey(scopeB);
  return Boolean(planA && planB && planA === planB);
}

export function resolveLocalTodayReadingScopeKeyFromPrefs(prefs: ReadingPlanPrefs): string {
  const isPointerPlan = isPointerReadingPlanId(prefs.planId);
  const dayCount = prefs.dayCount ?? 365;
  const dayIndex =
    !isPointerPlan && dayCount ? resolveEffectiveReadingPlanDayIndex(prefs, dayCount) : null;
  return buildTodayReadingScopeKey({
    planId: prefs.planId,
    isTripleLoop: isTripleLoopPlanId(prefs.planId),
    epochDay: resolveEffectiveEpochDay(prefs),
    dayIndex,
  });
}

export async function resolveLocalTodayReadingScopeKey(): Promise<string> {
  return resolveLocalTodayReadingScopeKeyFromPrefs(await readEffectiveReadingPlanPrefs());
}

export async function normalizeTodayReadingDoneForLocalPrefs(
  record: TodayReadingDoneRecord,
): Promise<TodayReadingDoneRecord> {
  const scopeKey = await resolveLocalTodayReadingScopeKey();
  return { version: 1, scopeKey, doneKeys: [...record.doneKeys] };
}

export function todayReadingItemKey(r: ReadingPlanRange, planId?: string | null): string {
  if (planId && isNtDeepRepeatPlanId(planId)) {
    const track = trackForNtDeepRepeatBookId(r.bookId);
    if (track === "ot") return `ndr:ot:${r.bookId}:${r.startChapter}`;
    if (track === "nt") return `ndr:nt:${r.bookId}:${r.startChapter}:${r.endChapter}`;
  }
  const track = trackForBookId(r.bookId);
  if (track) return `${track}:${r.bookId}:${r.startChapter}`;
  return `${r.bookId}:${r.startChapter}-${r.endChapter}`;
}

export function readingIncludesChapter(
  r: ReadingPlanRange,
  bookId: string,
  chapter: number,
): boolean {
  const id = bookId.trim().toUpperCase();
  if (r.bookId !== id) return false;
  return chapter >= r.startChapter && chapter <= r.endChapter;
}

function parseRecord(raw: string | null): TodayReadingDoneRecord | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as Partial<TodayReadingDoneRecord>;
    if (j?.version !== 1 || typeof j.scopeKey !== "string") return null;
    const doneKeys = Array.isArray(j.doneKeys)
      ? j.doneKeys.filter((k): k is string => typeof k === "string" && k.length > 0)
      : [];
    return { version: 1, scopeKey: j.scopeKey, doneKeys };
  } catch {
    return null;
  }
}

async function readRecord(): Promise<TodayReadingDoneRecord | null> {
  try {
    const raw =
      (await AsyncStorage.getItem(TODAY_READING_DONE_STORAGE_KEY)) ??
      (await AsyncStorage.getItem(TODAY_READING_DONE_STORAGE_KEY_LEGACY));
    if (raw != null) {
      await AsyncStorage.setItem(TODAY_READING_DONE_STORAGE_KEY, raw);
      await AsyncStorage.removeItem(TODAY_READING_DONE_STORAGE_KEY_LEGACY);
    }
    return parseRecord(raw);
  } catch {
    return null;
  }
}

async function persistTodayReadingDoneRecord(record: TodayReadingDoneRecord): Promise<void> {
  await AsyncStorage.setItem(TODAY_READING_DONE_STORAGE_KEY, JSON.stringify(record));
  await AsyncStorage.removeItem(TODAY_READING_DONE_STORAGE_KEY_LEGACY);
  emit();
}

async function writeRecord(record: TodayReadingDoneRecord): Promise<void> {
  try {
    await persistTodayReadingDoneRecord(record);
    const { notifyMemberReadingLocalChanged } = await import("../../member-sync/requestMemberReadingSync");
    notifyMemberReadingLocalChanged("todayReadingDone");
  } catch {
    /* ignore */
  }
}

export async function readTodayReadingDoneRecord(): Promise<TodayReadingDoneRecord | null> {
  return readRecord();
}

export async function replaceTodayReadingDoneRecord(record: TodayReadingDoneRecord): Promise<void> {
  try {
    await persistTodayReadingDoneRecord(record);
  } catch {
    /* ignore */
  }
}

export async function readTodayReadingDoneKeys(scopeKey: string): Promise<Set<string>> {
  const record = await readRecord();
  if (!record) return new Set();
  if (record.scopeKey === scopeKey || isSameTodayReadingPlanScope(record.scopeKey, scopeKey)) {
    return new Set(record.doneKeys);
  }
  return new Set();
}

export async function clearTodayReadingDoneForScope(scopeKey: string): Promise<void> {
  const record = await readRecord();
  if (!record || record.scopeKey !== scopeKey) return;
  await writeRecord({ version: 1, scopeKey, doneKeys: [] });
}

export async function setTodayReadingItemDone(
  scopeKey: string,
  itemKey: string,
  done: boolean,
): Promise<Set<string>> {
  const record = await readRecord();
  const base = new Set<string>();
  if (record && (record.scopeKey === scopeKey || isSameTodayReadingPlanScope(record.scopeKey, scopeKey))) {
    record.doneKeys.forEach((k) => base.add(k));
  }
  if (done) base.add(itemKey);
  else base.delete(itemKey);
  const doneKeys = [...base];
  await writeRecord({ version: 1, scopeKey, doneKeys });
  if (done) {
    const triple = parseTripleLoopItemKey(itemKey);
    if (triple) {
      await markTripleLoopChapterRead(triple.bookId, triple.chapter);
    }
    const ndr = parseNtDeepRepeatItemKey(itemKey);
    if (ndr) {
      await markNtDeepRepeatChapterRead(ndr.bookId, ndr.chapter);
    }
  }
  return base;
}

function parseNtDeepRepeatItemKey(itemKey: string): { bookId: string; chapter: number } | null {
  const parts = itemKey.split(":");
  if (parts[0] !== "ndr") return null;
  if (parts[1] === "ot" && parts.length === 4) {
    const chapter = Number(parts[3]);
    if (!parts[2] || !Number.isInteger(chapter) || chapter < 1) return null;
    return { bookId: parts[2], chapter };
  }
  if (parts[1] === "nt" && parts.length === 5) {
    const chapter = Number(parts[3]);
    if (!parts[2] || !Number.isInteger(chapter) || chapter < 1) return null;
    return { bookId: parts[2], chapter };
  }
  return null;
}

function parseTripleLoopItemKey(itemKey: string): { bookId: string; chapter: number } | null {
  const parts = itemKey.split(":");
  if (parts.length !== 3) return null;
  const track = parts[0] as TripleLoopTrack;
  if (track !== "ot" && track !== "nt" && track !== "wisdom") return null;
  const chapter = Number(parts[2]);
  if (!parts[1] || !Number.isInteger(chapter) || chapter < 1) return null;
  return { bookId: parts[1], chapter };
}

export async function markTodayReadingItemDone(
  scopeKey: string,
  itemKey: string,
): Promise<Set<string>> {
  return setTodayReadingItemDone(scopeKey, itemKey, true);
}

/** 章音频自然播完：勾选今日计划对应行 + 章完成记录（与滚动读到末尾一致）。 */
export async function markTodayReadingAudioChapterComplete(
  bookId: string,
  chapter: number,
  opts?: { dayCount?: number },
): Promise<void> {
  const { markReadChapterCompleted } = await import("../read-chapter-completion");
  await markReadChapterCompleted(bookId, chapter);
  await markTodayReadingChapterVisit(bookId, chapter, opts);
}

/** 进入今日读经对应章节时标记为已读 */
export async function markTodayReadingChapterVisit(
  bookId: string,
  chapter: number,
  opts?: { dayCount?: number },
): Promise<void> {
  const prefs = await readEffectiveReadingPlanPrefs();
  const isPointerPlan = isPointerReadingPlanId(prefs.planId);
  const dayCount = opts?.dayCount ?? prefs.dayCount ?? 365;
  const dayIndex =
    !isPointerPlan && dayCount ? resolveEffectiveReadingPlanDayIndex(prefs, dayCount) : null;
  if (!isPointerPlan && dayIndex == null) return;

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

  const { readingPlanRangeUnitCount, recordTodayReadingChapterFraction, TODAY_READING_AUTO_DONE_FRACTION } =
    await import("./today-reading-chapter-fraction");
  if (readingPlanRangeUnitCount(reading) > 1) {
    await recordTodayReadingChapterFraction(bookId, chapter, TODAY_READING_AUTO_DONE_FRACTION, opts);
    return;
  }

  await markTodayReadingItemDone(scopeKey, itemKey);
}
