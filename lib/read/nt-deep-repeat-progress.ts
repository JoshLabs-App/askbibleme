import {
  NT_DEEP_REPEAT_CURRICULUM,
} from "@/lib/bible/reading-plans/nt-deep-repeat-curriculum";
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
  writeReadingPlanPrefs,
} from "@/lib/read/reading-plan-prefs";
import { flushMemberReadingSyncWebNow } from "@/lib/member-reading-sync/client/run-member-reading-sync-web";

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

/** 重置进度到指定计划日（1 = 起始当天），用于用户手动选择「从第几天开始读」。 */
export function resetNtDeepRepeatProgressToPlanDay(
  planDay: number,
  now = new Date(),
  pace: NtDeepRepeatPace = NT_DEEP_REPEAT_DEFAULT_PACE,
): NtDeepRepeatReadingState {
  const safeDay = Math.max(1, Math.floor(planDay));
  if (safeDay <= 1) return resetNtDeepRepeatProgressToFresh(now, pace);
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
  snapshotStored = null;
  snapshotHasSaved = false;
  snapshotEffective = null;
  const startedAt = toLocalDateString(now);
  const state = ntDeepRepeatStateForPlanDay(safeDay, { pace, startedAt });
  state.startedAt = startedAt;
  writeNtDeepRepeatProgress(state);
  return state;
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
  return jumpNtDeepRepeatProgressToPlanDay(planDay, now);
}

/** 一次跳到指定计划日（保留已读章）。 */
export function jumpNtDeepRepeatProgressToPlanDay(
  planDay: number,
  now = new Date(),
): NtDeepRepeatReadingState {
  const prefs = readEffectiveReadingPlanPrefs();
  const pace = prefs.ntDeepRepeatPace ?? NT_DEEP_REPEAT_DEFAULT_PACE;
  const startedAt = prefs.startedOn?.trim() || toLocalDateString(now);
  const safeDay = Math.max(1, Math.floor(planDay));
  const { stored } = refreshStoredSnapshot();
  const state = normalizeNtDeepRepeatReadingState({
    ...ntDeepRepeatStateForPlanDay(safeDay, { pace, startedAt }),
    pace,
    startedAt,
    chaptersReadKeys: stored.chaptersReadKeys,
  });
  writeNtDeepRepeatProgress(state);
  return state;
}

function addLocalDays(d: Date, days: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + days);
  return out;
}

/** 将某一新约版块（0-based 阶）设为今日读经：该阶第 1 天。 */
export function setNtDeepRepeatCurriculumStageAsToday(
  curriculumIndex: number,
  now = new Date(),
): NtDeepRepeatReadingState {
  const prefs = readEffectiveReadingPlanPrefs();
  const pace = prefs.ntDeepRepeatPace ?? NT_DEEP_REPEAT_DEFAULT_PACE;
  const stageCount = Math.max(1, NT_DEEP_REPEAT_CURRICULUM.length);
  const safeIndex = Math.min(stageCount - 1, Math.max(0, Math.floor(curriculumIndex)));
  const planDay = safeIndex * pace + 1;

  let startedAt = prefs.startedOn?.trim() || toLocalDateString(now);
  const calendarDay = resolveNtDeepRepeatPlanDay({ ...prefs, startedOn: startedAt }, now);
  let nextPrefs = { ...prefs, chosen: true as const };

  if (planDay < calendarDay) {
    startedAt = toLocalDateString(addLocalDays(now, -(planDay - 1)));
    const { aheadDays: _omit, ...rest } = nextPrefs;
    nextPrefs = { ...rest, startedOn: startedAt, chosen: true };
  } else {
    const ahead = planDay - calendarDay;
    if (ahead > 0) {
      nextPrefs = { ...nextPrefs, startedOn: startedAt, aheadDays: ahead };
    } else {
      const { aheadDays: _omit, ...rest } = nextPrefs;
      nextPrefs = { ...rest, startedOn: startedAt, chosen: true };
    }
  }

  const { stored } = refreshStoredSnapshot();
  const state = normalizeNtDeepRepeatReadingState({
    ...ntDeepRepeatStateForPlanDay(planDay, { pace, startedAt }),
    pace,
    startedAt,
    chaptersReadKeys: stored.chaptersReadKeys,
  });
  writeNtDeepRepeatProgress(state);
  writeReadingPlanPrefs(nextPrefs);
  flushMemberReadingSyncWebNow("readingPlanPrefs");
  return state;
}
