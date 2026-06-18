import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  advanceTripleLoopOneCalendarDay,
  advanceTripleLoopTrack,
  createDefaultTripleLoopReadingState,
  normalizeTripleLoopReadingState,
  tripleLoopStateForPlanDay,
  type TripleLoopReadingState,
  type TripleLoopTrack,
} from "./triple-loop-reading";
import { addUserChapterReadToState } from "./triple-loop-chapters-read";
import { getReadingPlanDaySinceEpoch, READING_PLAN_EASTER_EPOCH_DATE } from "./reading-plan-epoch";

export const TRIPLE_LOOP_PROGRESS_STORAGE_KEY = "askbible-triple-loop-progress-v1";
export const TRIPLE_LOOP_PROGRESS_STORAGE_KEY_LEGACY = "selah-triple-loop-progress-v1";

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

export function subscribeTripleLoopProgress(onStore: () => void): () => void {
  listeners.add(onStore);
  return () => listeners.delete(onStore);
}

export function parseTripleLoopProgress(raw: string | null): TripleLoopReadingState | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Partial<TripleLoopReadingState>;
    return normalizeTripleLoopReadingState(j);
  } catch {
    return null;
  }
}

function defaultProgressForEpoch(now = new Date()): TripleLoopReadingState {
  const state = tripleLoopStateForPlanDay(getReadingPlanDaySinceEpoch(now));
  state.startedAt = READING_PLAN_EASTER_EPOCH_DATE;
  return state;
}

export function resolveEffectiveTripleLoopProgress(
  stored: TripleLoopReadingState,
  hasSaved: boolean,
  now = new Date(),
): TripleLoopReadingState {
  if (hasSaved) return stored;
  return defaultProgressForEpoch(now);
}

export async function readTripleLoopProgress(): Promise<TripleLoopReadingState> {
  try {
    const raw =
      (await AsyncStorage.getItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY)) ??
      (await AsyncStorage.getItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY_LEGACY));
    if (raw != null) {
      await AsyncStorage.setItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY, raw);
      await AsyncStorage.removeItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY_LEGACY);
    }
    const hasSaved = raw != null;
    const stored = hasSaved
      ? normalizeTripleLoopReadingState(parseTripleLoopProgress(raw) ?? undefined)
      : createDefaultTripleLoopReadingState();
    return resolveEffectiveTripleLoopProgress(stored, hasSaved);
  } catch {
    return defaultProgressForEpoch();
  }
}

export async function hasUserTripleLoopProgress(): Promise<boolean> {
  try {
    const raw =
      (await AsyncStorage.getItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY)) ??
      (await AsyncStorage.getItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY_LEGACY));
    if (raw != null) {
      await AsyncStorage.setItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY, raw);
      await AsyncStorage.removeItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY_LEGACY);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function writeTripleLoopProgress(state: TripleLoopReadingState): Promise<void> {
  try {
    await persistTripleLoopProgress(state);
    const { notifyMemberReadingLocalChanged } = await import("../../member-sync/requestMemberReadingSync");
    notifyMemberReadingLocalChanged("tripleLoopProgress");
  } catch {
    /* ignore */
  }
}

export async function replaceTripleLoopProgress(state: TripleLoopReadingState): Promise<void> {
  try {
    await persistTripleLoopProgress(state);
  } catch {
    /* ignore */
  }
}

async function persistTripleLoopProgress(state: TripleLoopReadingState): Promise<void> {
  await AsyncStorage.setItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY, JSON.stringify(state));
  await AsyncStorage.removeItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY_LEGACY);
  emit();
}

export async function advanceTripleLoopOnePlanDay(now = new Date()): Promise<TripleLoopReadingState> {
  const raw =
    (await AsyncStorage.getItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY)) ??
    (await AsyncStorage.getItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY_LEGACY));
  if (raw != null) {
    await AsyncStorage.setItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY, raw);
    await AsyncStorage.removeItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY_LEGACY);
  }
  const hasSaved = raw != null;
  const stored = hasSaved
    ? normalizeTripleLoopReadingState(parseTripleLoopProgress(raw) ?? undefined)
    : createDefaultTripleLoopReadingState();
  const base = resolveEffectiveTripleLoopProgress(stored, hasSaved, now);
  let next = advanceTripleLoopOneCalendarDay(base);
  if (!next.startedAt) {
    next = { ...next, startedAt: READING_PLAN_EASTER_EPOCH_DATE };
  }
  await writeTripleLoopProgress(next);
  return next;
}

export async function resetTripleLoopToCalendarToday(now = new Date()): Promise<TripleLoopReadingState> {
  const state = defaultProgressForEpoch(now);
  await writeTripleLoopProgress(state);
  return state;
}

export async function advanceTripleLoopProgressTrack(
  track: TripleLoopTrack,
  now = new Date(),
): Promise<TripleLoopReadingState> {
  const raw =
    (await AsyncStorage.getItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY)) ??
    (await AsyncStorage.getItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY_LEGACY));
  if (raw != null) {
    await AsyncStorage.setItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY, raw);
    await AsyncStorage.removeItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY_LEGACY);
  }
  const hasSaved = raw != null;
  const stored = hasSaved
    ? normalizeTripleLoopReadingState(parseTripleLoopProgress(raw) ?? undefined)
    : createDefaultTripleLoopReadingState();
  const base = resolveEffectiveTripleLoopProgress(stored, hasSaved, now);
  let next = advanceTripleLoopTrack(base, track);
  if (!next.startedAt) {
    next = { ...next, startedAt: READING_PLAN_EASTER_EPOCH_DATE };
  }
  await writeTripleLoopProgress(next);
  return next;
}

/** 用户实际读完某一章时写入（与计划排程指针无关） */
export async function markTripleLoopChapterRead(
  bookId: string,
  chapter: number,
  now = new Date(),
): Promise<TripleLoopReadingState> {
  const raw =
    (await AsyncStorage.getItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY)) ??
    (await AsyncStorage.getItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY_LEGACY));
  if (raw != null) {
    await AsyncStorage.setItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY, raw);
    await AsyncStorage.removeItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY_LEGACY);
  }
  const hasSaved = raw != null;
  const stored = hasSaved
    ? normalizeTripleLoopReadingState(parseTripleLoopProgress(raw) ?? undefined)
    : createDefaultTripleLoopReadingState();
  const base = resolveEffectiveTripleLoopProgress(stored, hasSaved, now);
  const next = addUserChapterReadToState(base, bookId, chapter);
  await writeTripleLoopProgress(next);
  return next;
}

export async function resetTripleLoopProgressToEpochDefault(): Promise<TripleLoopReadingState> {
  try {
    await AsyncStorage.removeItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY);
    await AsyncStorage.removeItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY_LEGACY);
    emit();
  } catch {
    /* ignore */
  }
  return defaultProgressForEpoch();
}
