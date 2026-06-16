import { trackForBookId } from "@/lib/bible/reading-plans/triple-loop-reading";
import type { ReadingPlanRange } from "@/lib/bible/reading-plans/types";
import { isTripleLoopPlanId } from "@/lib/bible/reading-plans/triple-loop-plan";
import {
  getReadingPlanDaySinceEpoch,
  resolveReadingPlanDayIndex,
  readEffectiveReadingPlanPrefs,
} from "@/lib/read/reading-plan-prefs";
import { loadTodayReadingPlanPayload } from "@/lib/read/today-reading-plan-payload";
import { advanceTripleLoopProgressTrack } from "@/lib/read/triple-loop-progress";
import type { TripleLoopTrack } from "@/lib/bible/reading-plans/triple-loop-reading";

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
  if (typeof window === "undefined") return () => listeners.delete(onStore);
  const onStorage = (e: StorageEvent) => {
    if (
      e.key === TODAY_READING_DONE_STORAGE_KEY ||
      e.key === TODAY_READING_DONE_STORAGE_KEY_LEGACY ||
      e.key === null
    ) {
      onStore();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStore);
    window.removeEventListener("storage", onStorage);
  };
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

export function readingIncludesChapter(r: ReadingPlanRange, bookId: string, chapter: number): boolean {
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

function readRecord(): TodayReadingDoneRecord | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw =
      localStorage.getItem(TODAY_READING_DONE_STORAGE_KEY) ??
      localStorage.getItem(TODAY_READING_DONE_STORAGE_KEY_LEGACY);
    if (raw != null) {
      localStorage.setItem(TODAY_READING_DONE_STORAGE_KEY, raw);
      localStorage.removeItem(TODAY_READING_DONE_STORAGE_KEY_LEGACY);
    }
    return parseRecord(raw);
  } catch {
    return null;
  }
}

function writeRecord(record: TodayReadingDoneRecord): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(TODAY_READING_DONE_STORAGE_KEY, JSON.stringify(record));
    localStorage.removeItem(TODAY_READING_DONE_STORAGE_KEY_LEGACY);
    emit();
  } catch {
    /* ignore */
  }
}

export function readTodayReadingDoneRecord(): TodayReadingDoneRecord | null {
  return readRecord();
}

export function replaceTodayReadingDoneRecord(record: TodayReadingDoneRecord): void {
  writeRecord(record);
}

export function readTodayReadingDoneKeys(scopeKey: string): Set<string> {
  const record = readRecord();
  if (!record || record.scopeKey !== scopeKey) return new Set();
  return new Set(record.doneKeys);
}

export function clearTodayReadingDoneForScope(scopeKey: string): void {
  const record = readRecord();
  if (!record || record.scopeKey !== scopeKey) return;
  writeRecord({ version: 1, scopeKey, doneKeys: [] });
}

function parseTripleLoopItemKey(itemKey: string): { bookId: string; chapter: number; track: TripleLoopTrack } | null {
  const parts = itemKey.split(":");
  if (parts.length !== 3) return null;
  const track = parts[0] as TripleLoopTrack;
  if (track !== "ot" && track !== "nt" && track !== "wisdom") return null;
  const chapter = Number(parts[2]);
  if (!parts[1] || !Number.isInteger(chapter) || chapter < 1) return null;
  return { bookId: parts[1], chapter, track };
}

export function setTodayReadingItemDone(
  scopeKey: string,
  itemKey: string,
  done: boolean,
): Set<string> {
  const record = readRecord();
  const base = record?.scopeKey === scopeKey ? new Set(record.doneKeys) : new Set<string>();
  if (done) base.add(itemKey);
  else base.delete(itemKey);
  const doneKeys = [...base];
  writeRecord({ version: 1, scopeKey, doneKeys });
  if (done) {
    const triple = parseTripleLoopItemKey(itemKey);
    if (triple) {
      advanceTripleLoopProgressTrack(triple.track);
    }
  }
  return base;
}

export function markTodayReadingItemDone(scopeKey: string, itemKey: string): Set<string> {
  return setTodayReadingItemDone(scopeKey, itemKey, true);
}

/** 进入今日读经对应章节时标记为已读 */
export async function markTodayReadingChapterVisit(
  bookId: string,
  chapter: number,
  opts?: { dayCount?: number },
): Promise<void> {
  const prefs = readEffectiveReadingPlanPrefs();
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
  markTodayReadingItemDone(scopeKey, todayReadingItemKey(reading));
}
