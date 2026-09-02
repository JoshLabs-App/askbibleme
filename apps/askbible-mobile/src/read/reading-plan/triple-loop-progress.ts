import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  advanceTripleLoopOneCalendarDay,
  advanceTripleLoopTrack,
  createDefaultTripleLoopReadingState,
  normalizeTripleLoopReadingState,
  clipCoordinatedTripleLoopAheadToPlanDay,
  snapTripleLoopStateToPlanDay,
  tripleLoopPointersEqual,
  tripleLoopStateForPlanDay,
  type TripleLoopReadingState,
  type TripleLoopTrack,
} from "./triple-loop-reading";
import { addUserChapterReadToState } from "@/lib/bible/reading-plans/triple-loop-chapters-read";
import { getReadingPlanDaySinceEpoch, READING_PLAN_EASTER_EPOCH_DATE } from "@/lib/read/reading-plan-epoch";
import { readEffectiveReadingPlanPrefs } from "./reading-plan-prefs";

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

function normalizeAheadDays(aheadDays: number | undefined): number {
  if (typeof aheadDays !== "number" || !Number.isFinite(aheadDays)) return 0;
  return Math.max(0, Math.floor(aheadDays));
}

async function readTripleLoopAheadDays(): Promise<number> {
  try {
    return normalizeAheadDays((await readEffectiveReadingPlanPrefs()).aheadDays);
  } catch {
    return 0;
  }
}

/** 无记录用复活节历元；落后的轨对齐今天；三轨一起超前则拉回（aheadDays 为准）。 */
export function resolveEffectiveTripleLoopProgress(
  stored: TripleLoopReadingState,
  hasSaved: boolean,
  now = new Date(),
  aheadDays = 0,
): TripleLoopReadingState {
  const planDay = Math.max(1, getReadingPlanDaySinceEpoch(now) + normalizeAheadDays(aheadDays));
  const base = hasSaved ? stored : defaultProgressForEpoch(now);
  return clipCoordinatedTripleLoopAheadToPlanDay(
    snapTripleLoopStateToPlanDay(base, planDay),
    planDay,
  );
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
    const aheadDays = await readTripleLoopAheadDays();
    const effective = resolveEffectiveTripleLoopProgress(stored, hasSaved, new Date(), aheadDays);
    if (hasSaved && !tripleLoopPointersEqual(stored, effective)) {
      await writeTripleLoopProgress(effective);
    }
    return effective;
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
  const aheadDays = await readTripleLoopAheadDays();
  const base = resolveEffectiveTripleLoopProgress(stored, hasSaved, now, aheadDays);
  let next = advanceTripleLoopOneCalendarDay(base);
  if (!next.startedAt) {
    next = { ...next, startedAt: READING_PLAN_EASTER_EPOCH_DATE };
  }
  await writeTripleLoopProgress(next);
  return next;
}

export async function resetTripleLoopToCalendarToday(now = new Date()): Promise<TripleLoopReadingState> {
  return jumpTripleLoopProgressToPlanDay(getReadingPlanDaySinceEpoch(now));
}

/** 一次跳到指定计划日（保留已读章），供「进度设置为今日」原子写入。 */
export async function jumpTripleLoopProgressToPlanDay(
  planDay: number,
): Promise<TripleLoopReadingState> {
  let prevKeys: TripleLoopReadingState["chaptersReadKeys"] | undefined;
  try {
    const raw =
      (await AsyncStorage.getItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY)) ??
      (await AsyncStorage.getItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY_LEGACY));
    if (raw) {
      prevKeys = normalizeTripleLoopReadingState(parseTripleLoopProgress(raw) ?? undefined).chaptersReadKeys;
    }
  } catch {
    /* ignore */
  }
  const state = normalizeTripleLoopReadingState({
    ...tripleLoopStateForPlanDay(Math.max(1, Math.floor(planDay))),
    startedAt: READING_PLAN_EASTER_EPOCH_DATE,
    chaptersReadKeys: prevKeys,
  });
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
  const aheadDays = await readTripleLoopAheadDays();
  const base = resolveEffectiveTripleLoopProgress(stored, hasSaved, now, aheadDays);
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
  const aheadDays = await readTripleLoopAheadDays();
  const base = resolveEffectiveTripleLoopProgress(stored, hasSaved, now, aheadDays);
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
