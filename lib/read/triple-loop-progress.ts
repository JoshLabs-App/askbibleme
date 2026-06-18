import {
  advanceTripleLoopOneCalendarDay,
  advanceTripleLoopTrack,
  createDefaultTripleLoopReadingState,
  normalizeTripleLoopReadingState,
  tripleLoopStateForPlanDay,
  type TripleLoopReadingState,
  type TripleLoopTrack,
} from "@/lib/bible/reading-plans/triple-loop-reading";
import { addUserChapterReadToState } from "@/lib/bible/reading-plans/triple-loop-chapters-read";
import { getReadingPlanDaySinceEpoch, READING_PLAN_EASTER_EPOCH_DATE } from "@/lib/read/reading-plan-epoch";

export const TRIPLE_LOOP_PROGRESS_STORAGE_KEY = "askbible-triple-loop-progress-v1";
export const TRIPLE_LOOP_PROGRESS_STORAGE_KEY_LEGACY = "selah-triple-loop-progress-v1";

let snapshotRaw: string | undefined;
let snapshotStored: TripleLoopReadingState | null = null;
let snapshotHasSaved = false;
/** Cached client effective snapshot (stable reference until storage or epoch day changes). */
let snapshotEffective: TripleLoopReadingState | null = null;
let snapshotEffectivePlanDay: number | null = null;

/** Stable reference for `useSyncExternalStore` SSR / hydration — must not allocate per call. */
const SERVER_TRIPLE_LOOP_PROGRESS_SNAPSHOT = createDefaultTripleLoopReadingState();

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
  if (typeof window === "undefined") return () => {};
  listeners.add(onStore);
  const onStorage = (e: StorageEvent) => {
    if (
      e.key === TRIPLE_LOOP_PROGRESS_STORAGE_KEY ||
      e.key === TRIPLE_LOOP_PROGRESS_STORAGE_KEY_LEGACY ||
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

export function parseTripleLoopProgress(raw: string | null): TripleLoopReadingState | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Partial<TripleLoopReadingState>;
    return normalizeTripleLoopReadingState(j);
  } catch {
    return null;
  }
}

export function hasUserTripleLoopProgress(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      localStorage.getItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY) != null ||
      localStorage.getItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY_LEGACY) != null
    );
  } catch {
    return false;
  }
}

function readRawTripleLoopProgressFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let raw = localStorage.getItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY);
    if (raw == null) {
      const legacy = localStorage.getItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY_LEGACY);
      if (legacy != null) {
        localStorage.setItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY, legacy);
        localStorage.removeItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY_LEGACY);
        raw = legacy;
      }
    }
    return raw;
  } catch {
    return null;
  }
}

function defaultProgressForEpoch(now = new Date()): TripleLoopReadingState {
  const state = tripleLoopStateForPlanDay(getReadingPlanDaySinceEpoch(now));
  state.startedAt = READING_PLAN_EASTER_EPOCH_DATE;
  return state;
}

/** 无本机记录时用复活节历元推算；有记录时以用户保存的指针为准（可超前也可落后默认）。 */
export function resolveEffectiveTripleLoopProgress(
  stored: TripleLoopReadingState,
  hasSaved: boolean,
  now = new Date(),
): TripleLoopReadingState {
  if (hasSaved) return stored;
  return defaultProgressForEpoch(now);
}

function refreshStoredSnapshot(): { stored: TripleLoopReadingState; hasSaved: boolean } {
  if (typeof window === "undefined") {
    return { stored: createDefaultTripleLoopReadingState(), hasSaved: false };
  }
  try {
    const raw = readRawTripleLoopProgressFromStorage();
    const key = raw ?? "";
    const hasSaved = raw != null;
    if (key === snapshotRaw && snapshotStored) {
      return { stored: snapshotStored, hasSaved: snapshotHasSaved };
    }
    snapshotRaw = key;
    snapshotHasSaved = hasSaved;
    snapshotStored = hasSaved
      ? normalizeTripleLoopReadingState(parseTripleLoopProgress(key) ?? undefined)
      : createDefaultTripleLoopReadingState();
    snapshotEffective = null;
    snapshotEffectivePlanDay = null;
    return { stored: snapshotStored, hasSaved };
  } catch {
    snapshotRaw = "";
    snapshotStored = createDefaultTripleLoopReadingState();
    snapshotHasSaved = false;
    snapshotEffective = null;
    snapshotEffectivePlanDay = null;
    return { stored: snapshotStored, hasSaved: false };
  }
}

function refreshEffectiveSnapshot(now = new Date()): TripleLoopReadingState {
  const { stored, hasSaved } = refreshStoredSnapshot();
  if (hasSaved) {
    snapshotEffective = stored;
    snapshotEffectivePlanDay = null;
    return stored;
  }
  const planDay = getReadingPlanDaySinceEpoch(now);
  if (snapshotEffective && snapshotEffectivePlanDay === planDay) {
    return snapshotEffective;
  }
  snapshotEffectivePlanDay = planDay;
  snapshotEffective = defaultProgressForEpoch(now);
  return snapshotEffective;
}

export function getTripleLoopProgressSnapshot(): TripleLoopReadingState {
  return refreshEffectiveSnapshot();
}

export function getTripleLoopProgressServerSnapshot(): TripleLoopReadingState {
  return SERVER_TRIPLE_LOOP_PROGRESS_SNAPSHOT;
}

export function readTripleLoopProgress(): TripleLoopReadingState {
  return getTripleLoopProgressSnapshot();
}

export function writeTripleLoopProgress(state: TripleLoopReadingState): void {
  if (typeof window === "undefined") return;
  try {
    const json = JSON.stringify(state);
    localStorage.setItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY, json);
    localStorage.removeItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY_LEGACY);
    snapshotRaw = json;
    snapshotStored = state;
    snapshotHasSaved = true;
    snapshotEffective = state;
    snapshotEffectivePlanDay = null;
    emit();
  } catch {
    /* ignore */
  }
}

export function advanceTripleLoopOnePlanDay(now = new Date()): TripleLoopReadingState {
  const { stored, hasSaved } = refreshStoredSnapshot();
  const base = resolveEffectiveTripleLoopProgress(stored, hasSaved, now);
  let next = advanceTripleLoopOneCalendarDay(base);
  if (!next.startedAt) {
    next = { ...next, startedAt: READING_PLAN_EASTER_EPOCH_DATE };
  }
  writeTripleLoopProgress(next);
  return next;
}

export function resetTripleLoopToCalendarToday(now = new Date()): TripleLoopReadingState {
  const state = defaultProgressForEpoch(now);
  writeTripleLoopProgress(state);
  return state;
}

export function advanceTripleLoopProgressTrack(track: TripleLoopTrack, now = new Date()): TripleLoopReadingState {
  const { stored, hasSaved } = refreshStoredSnapshot();
  const base = resolveEffectiveTripleLoopProgress(stored, hasSaved, now);
  let next = advanceTripleLoopTrack(base, track);
  if (!next.startedAt) {
    next = { ...next, startedAt: READING_PLAN_EASTER_EPOCH_DATE };
  }
  writeTripleLoopProgress(next);
  return next;
}

/** 清除本机三循环指针，回到「按复活节历元 + 默认顺序」的推算位置。 */
export function resetTripleLoopProgressToEpochDefault(now = new Date()): TripleLoopReadingState {
  if (typeof window === "undefined") return defaultProgressForEpoch(now);
  try {
    localStorage.removeItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY);
    localStorage.removeItem(TRIPLE_LOOP_PROGRESS_STORAGE_KEY_LEGACY);
    snapshotRaw = "";
    snapshotStored = createDefaultTripleLoopReadingState();
    snapshotHasSaved = false;
    snapshotEffective = null;
    snapshotEffectivePlanDay = null;
    emit();
  } catch {
    /* ignore */
  }
  return defaultProgressForEpoch(now);
}

/** 用户实际读完某一章时写入（与计划排程指针无关） */
export function markTripleLoopChapterRead(
  bookId: string,
  chapter: number,
  now = new Date(),
): TripleLoopReadingState {
  const { stored, hasSaved } = refreshStoredSnapshot();
  const base = resolveEffectiveTripleLoopProgress(stored, hasSaved, now);
  const next = addUserChapterReadToState(base, bookId, chapter);
  writeTripleLoopProgress(next);
  return next;
}
