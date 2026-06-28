import {
  advanceNtDeepRepeatOneCalendarDay,
  createDefaultNtDeepRepeatReadingState,
  normalizeNtDeepRepeatReadingState,
  ntDeepRepeatStateForPlanDay,
  parseNtDeepRepeatProgress,
  type NtDeepRepeatReadingState,
} from "@/lib/bible/reading-plans/nt-deep-repeat-reading";
import {
  NT_DEEP_REPEAT_DEFAULT_PACE,
  type NtDeepRepeatPace,
} from "@/lib/bible/reading-plans/nt-deep-repeat-pace";
import { resolveNtDeepRepeatPlanDay } from "@/lib/read/nt-deep-repeat-plan-day";
import {
  alignNtDeepRepeatProgressToCalendar,
  ntDeepRepeatPlanPointersEqual,
} from "@/lib/read/nt-deep-repeat-effective-plan-day";
import {
  readEffectiveReadingPlanPrefs,
  toLocalDateString,
} from "@/lib/read/reading-plan-prefs";

export const NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY = "askbible-nt-deep-repeat-progress-v5";
const NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY_V4 = "askbible-nt-deep-repeat-progress-v4";
const NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY_V3 = "askbible-nt-deep-repeat-progress-v3";

const SERVER_SNAPSHOT = createDefaultNtDeepRepeatReadingState();

let snapshotRaw: string | undefined;
let snapshotStored: NtDeepRepeatReadingState | null = null;
let snapshotHasSaved = false;
let snapshotEffective: NtDeepRepeatReadingState | null = null;

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

export function subscribeNtDeepRepeatProgress(onStore: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  listeners.add(onStore);
  const onStorage = (e: StorageEvent) => {
    if (e.key === NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY || e.key === null) onStore();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStore);
    window.removeEventListener("storage", onStorage);
  };
}

export function hasUserNtDeepRepeatProgress(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      localStorage.getItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY) != null ||
      localStorage.getItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY_V4) != null ||
      localStorage.getItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY_V3) != null
    );
  } catch {
    return false;
  }
}

export function createFreshNtDeepRepeatProgress(
  now = new Date(),
  pace: NtDeepRepeatPace = NT_DEEP_REPEAT_DEFAULT_PACE,
): NtDeepRepeatReadingState {
  return createDefaultNtDeepRepeatReadingState(pace, now);
}

function readProgressRawFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v5 = localStorage.getItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY);
    if (v5 != null) return v5;
    const legacyRaw =
      localStorage.getItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY_V4) ??
      localStorage.getItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY_V3);
    if (legacyRaw == null) return null;
    let legacyPace: NtDeepRepeatPace = NT_DEEP_REPEAT_DEFAULT_PACE;
    try {
      const parsed = JSON.parse(legacyRaw) as Partial<NtDeepRepeatReadingState>;
      if (parsed.pace === 7 || parsed.pace === 14 || parsed.pace === 28) legacyPace = parsed.pace;
    } catch {
      /* ignore */
    }
    const fresh = createFreshNtDeepRepeatProgress(new Date(), legacyPace);
    const json = JSON.stringify(fresh);
    localStorage.setItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY, json);
    localStorage.removeItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY_V4);
    localStorage.removeItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY_V3);
    return json;
  } catch {
    return null;
  }
}

function refreshStoredSnapshot(): { stored: NtDeepRepeatReadingState; hasSaved: boolean } {
  if (typeof window === "undefined") {
    return { stored: createDefaultNtDeepRepeatReadingState(), hasSaved: false };
  }
  try {
    const raw = readProgressRawFromStorage();
    const key = raw ?? "";
    const hasSaved = raw != null;
    if (key === snapshotRaw && snapshotStored) {
      return { stored: snapshotStored, hasSaved: snapshotHasSaved };
    }
    snapshotRaw = key;
    snapshotHasSaved = hasSaved;
    snapshotStored = hasSaved
      ? normalizeNtDeepRepeatReadingState(parseNtDeepRepeatProgress(key) ?? undefined)
      : createDefaultNtDeepRepeatReadingState();
    snapshotEffective = null;
    return { stored: snapshotStored, hasSaved };
  } catch {
    return { stored: createDefaultNtDeepRepeatReadingState(), hasSaved: false };
  }
}

function refreshEffectiveSnapshot(): NtDeepRepeatReadingState {
  const { stored, hasSaved } = refreshStoredSnapshot();
  const base = hasSaved ? stored : snapshotEffective ?? createFreshNtDeepRepeatProgress();
  const aligned = alignNtDeepRepeatProgressToCalendar(base, readEffectiveReadingPlanPrefs());
  if (!ntDeepRepeatPlanPointersEqual(base, aligned)) {
    writeNtDeepRepeatProgress(aligned);
    return aligned;
  }
  snapshotEffective = aligned;
  return aligned;
}

export function getNtDeepRepeatProgressSnapshot(): NtDeepRepeatReadingState {
  return refreshEffectiveSnapshot();
}

export function getNtDeepRepeatProgressServerSnapshot(): NtDeepRepeatReadingState {
  return SERVER_SNAPSHOT;
}

export function readNtDeepRepeatProgress(): NtDeepRepeatReadingState {
  return getNtDeepRepeatProgressSnapshot();
}

export function writeNtDeepRepeatProgress(state: NtDeepRepeatReadingState): void {
  if (typeof window === "undefined") return;
  try {
    const json = JSON.stringify(state);
    localStorage.setItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY, json);
    snapshotRaw = json;
    snapshotStored = state;
    snapshotHasSaved = true;
    snapshotEffective = state;
    emit();
  } catch {
    /* ignore */
  }
}

export function resetNtDeepRepeatProgressToFresh(
  now = new Date(),
  pace: NtDeepRepeatPace = NT_DEEP_REPEAT_DEFAULT_PACE,
): NtDeepRepeatReadingState {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY);
      localStorage.removeItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY_V4);
      localStorage.removeItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY_V3);
    } catch {
      /* ignore */
    }
  }
  snapshotRaw = "";
  snapshotStored = createDefaultNtDeepRepeatReadingState(pace, now);
  snapshotHasSaved = false;
  snapshotEffective = null;
  const state = createFreshNtDeepRepeatProgress(now, pace);
  writeNtDeepRepeatProgress(state);
  return state;
}

export function resetNtDeepRepeatProgress(): void {
  resetNtDeepRepeatProgressToFresh();
}

export function advanceNtDeepRepeatOnePlanDay(now = new Date()): NtDeepRepeatReadingState {
  const base = readNtDeepRepeatProgress();
  let next = advanceNtDeepRepeatOneCalendarDay(base);
  if (!next.startedAt) {
    const prefs = readEffectiveReadingPlanPrefs();
    next = { ...next, startedAt: prefs.startedOn?.trim() || toLocalDateString(now) };
  }
  writeNtDeepRepeatProgress(next);
  return next;
}

export function resetNtDeepRepeatToCalendarToday(now = new Date()): NtDeepRepeatReadingState {
  const prefs = readEffectiveReadingPlanPrefs();
  const planDay = resolveNtDeepRepeatPlanDay(prefs, now);
  const pace = prefs.ntDeepRepeatPace ?? NT_DEEP_REPEAT_DEFAULT_PACE;
  const startedAt = prefs.startedOn?.trim() || toLocalDateString(now);
  let state = ntDeepRepeatStateForPlanDay(planDay, { pace, startedAt });
  state.startedAt = startedAt;
  writeNtDeepRepeatProgress(state);
  return state;
}
