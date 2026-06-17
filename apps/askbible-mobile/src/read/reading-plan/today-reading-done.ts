import AsyncStorage from "@react-native-async-storage/async-storage";
import { isTripleLoopPlanId } from "./triple-loop-plan";
import { trackForBookId } from "./triple-loop-reading";
import type { ReadingPlanRange } from "./types";
import {
  readEffectiveReadingPlanPrefs,
  resolveReadingPlanDayIndex,
} from "./reading-plan-prefs";
import { getReadingPlanDaySinceEpoch } from "./reading-plan-epoch";
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
  if (opts.isTripleLoop) return `${opts.planId}:epoch:${opts.epochDay}`;
  if (opts.dayIndex != null) return `${opts.planId}:day:${opts.dayIndex}`;
  return opts.planId;
}

export function todayReadingItemKey(r: ReadingPlanRange): string {
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
  if (!record || record.scopeKey !== scopeKey) return new Set();
  return new Set(record.doneKeys);
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
  const base =
    record?.scopeKey === scopeKey
      ? new Set(record.doneKeys)
      : new Set<string>();
  if (done) base.add(itemKey);
  else base.delete(itemKey);
  const doneKeys = [...base];
  await writeRecord({ version: 1, scopeKey, doneKeys });
  if (done) {
    const triple = parseTripleLoopItemKey(itemKey);
    if (triple) {
      await markTripleLoopChapterRead(triple.bookId, triple.chapter);
    }
  }
  return base;
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

/** 进入今日读经对应章节时标记为已读 */
export async function markTodayReadingChapterVisit(
  bookId: string,
  chapter: number,
  opts?: { dayCount?: number },
): Promise<void> {
  const prefs = await readEffectiveReadingPlanPrefs();
  const isTripleLoop = isTripleLoopPlanId(prefs.planId);
  const dayCount = opts?.dayCount ?? prefs.dayCount ?? 365;
  const dayIndex = !isTripleLoop && dayCount ? resolveReadingPlanDayIndex(prefs, dayCount) : null;
  if (!isTripleLoop && dayIndex == null) return;

  const payload = await loadTodayReadingPlanPayload(prefs, { dayCount: opts?.dayCount });
  const reading = payload?.day?.readings.find((r) => readingIncludesChapter(r, bookId, chapter));
  if (!reading) return;

  const scopeKey = buildTodayReadingScopeKey({
    planId: prefs.planId,
    isTripleLoop,
    epochDay: getReadingPlanDaySinceEpoch(),
    dayIndex,
  });
  await markTodayReadingItemDone(scopeKey, todayReadingItemKey(reading));
}
