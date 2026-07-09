import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizeMusicResumeSec } from "../music/music-playback-prefs";
import type { PlanChapterRef } from "./read-plan-flow-nav";
import { resolveLocalTodayReadingScopeKey } from "./reading-plan/today-reading-done";

const STORAGE_KEY = "askbible-today-plan-scripture-resume-v1";

export type TodayPlanScriptureResume = {
  version: 1;
  scopeKey: string;
  bookId: string;
  chapter: number;
  positionSec: number;
  updatedAt: number;
};

export type TodayPlanScriptureStartTarget = {
  target: PlanChapterRef;
  startAtSec: number;
};

export function resolveTodayPlanScriptureStartTargetFromSaved(
  queue: readonly PlanChapterRef[],
  scopeKey: string,
  saved: TodayPlanScriptureResume | null,
  opts?: { durationSec?: number },
): TodayPlanScriptureStartTarget | null {
  const first = queue[0];
  if (!first) return null;
  if (!saved || saved.scopeKey !== scopeKey) {
    return { target: first, startAtSec: 0 };
  }

  const match = queue.find((ref) => ref.bookId === saved.bookId && ref.chapter === saved.chapter);
  if (!match) {
    return { target: first, startAtSec: 0 };
  }

  const startAtSec = normalizeMusicResumeSec(saved.positionSec, opts?.durationSec);
  return { target: match, startAtSec };
}

export async function readTodayPlanScriptureResume(): Promise<TodayPlanScriptureResume | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TodayPlanScriptureResume>;
    const scopeKey = typeof parsed.scopeKey === "string" ? parsed.scopeKey.trim() : "";
    const bookId = typeof parsed.bookId === "string" ? parsed.bookId.trim().toUpperCase() : "";
    const chapter = typeof parsed.chapter === "number" ? parsed.chapter : 0;
    const positionSec =
      typeof parsed.positionSec === "number" && Number.isFinite(parsed.positionSec)
        ? Math.max(0, parsed.positionSec)
        : 0;
    if (!scopeKey || !bookId || chapter < 1) return null;
    return {
      version: 1,
      scopeKey,
      bookId,
      chapter,
      positionSec,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

export async function writeTodayPlanScriptureResume(
  record: Omit<TodayPlanScriptureResume, "version" | "updatedAt"> & { updatedAt?: number },
): Promise<void> {
  const scopeKey = record.scopeKey.trim();
  const bookId = record.bookId.trim().toUpperCase();
  if (!scopeKey || !bookId || record.chapter < 1) return;
  const payload: TodayPlanScriptureResume = {
    version: 1,
    scopeKey,
    bookId,
    chapter: record.chapter,
    positionSec: Math.max(0, record.positionSec),
    updatedAt: record.updatedAt ?? Date.now(),
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export async function clearTodayPlanScriptureResume(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/** 同一读经日 scope 内，从上次章与秒数续播；否则从队列首章开始。 */
export async function resolveTodayPlanScriptureStartTarget(
  queue: readonly PlanChapterRef[],
  opts?: { durationSec?: number },
): Promise<TodayPlanScriptureStartTarget | null> {
  const scopeKey = await resolveLocalTodayReadingScopeKey();
  const saved = await readTodayPlanScriptureResume();
  return resolveTodayPlanScriptureStartTargetFromSaved(queue, scopeKey, saved, opts);
}
