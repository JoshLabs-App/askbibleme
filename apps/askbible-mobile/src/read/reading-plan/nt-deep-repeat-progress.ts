import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  NT_DEEP_REPEAT_DEFAULT_PACE,
  type NtDeepRepeatPace,
} from "@/lib/bible/reading-plans/nt-deep-repeat-pace";
import {
  advanceNtDeepRepeatNtDay,
  advanceNtDeepRepeatOneCalendarDay,
  advanceNtDeepRepeatOtTrack,
  createDefaultNtDeepRepeatReadingState,
  normalizeNtDeepRepeatReadingState,
  ntDeepRepeatStateForPlanDay,
  type NtDeepRepeatReadingState,
  type NtDeepRepeatTrack,
} from "./nt-deep-repeat-reading";
import { addNtDeepRepeatChapterReadToState } from "./nt-deep-repeat-chapters-read";
import {
  alignNtDeepRepeatProgressToCalendar,
  ntDeepRepeatPlanPointersEqual,
} from "@/lib/read/nt-deep-repeat-effective-plan-day";
import { resolveNtDeepRepeatPlanDay } from "@/lib/read/nt-deep-repeat-plan-day";
import {
  readEffectiveReadingPlanPrefs,
  toLocalDateString,
  writeReadingPlanPrefs,
} from "./reading-plan-prefs";
import { NT_DEEP_REPEAT_CURRICULUM } from "@/lib/bible/reading-plans/nt-deep-repeat-curriculum";

export const NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY = "askbible-nt-deep-repeat-progress-v5";
const NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY_V4 = "askbible-nt-deep-repeat-progress-v4";
const NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY_V3 = "askbible-nt-deep-repeat-progress-v3";

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
  listeners.add(onStore);
  return () => listeners.delete(onStore);
}

export function parseNtDeepRepeatProgress(raw: string | null): NtDeepRepeatReadingState | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Partial<NtDeepRepeatReadingState>;
    return normalizeNtDeepRepeatReadingState(j);
  } catch {
    return null;
  }
}

export function createFreshNtDeepRepeatProgress(
  now = new Date(),
  pace: NtDeepRepeatPace = NT_DEEP_REPEAT_DEFAULT_PACE,
): NtDeepRepeatReadingState {
  return createDefaultNtDeepRepeatReadingState(pace, now);
}

async function readProgressRawFromStorage(): Promise<string | null> {
  try {
    const v5 = await AsyncStorage.getItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY);
    if (v5 != null) return v5;
    const legacyRaw =
      (await AsyncStorage.getItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY_V4)) ??
      (await AsyncStorage.getItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY_V3));
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
    await AsyncStorage.setItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY, json);
    await AsyncStorage.removeItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY_V4);
    await AsyncStorage.removeItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY_V3);
    return json;
  } catch {
    return null;
  }
}

function resolveEffectiveNtDeepRepeatProgress(
  stored: NtDeepRepeatReadingState,
  hasSaved: boolean,
): NtDeepRepeatReadingState {
  if (hasSaved) return stored;
  return createFreshNtDeepRepeatProgress();
}

async function startedAtForProgress(now = new Date()): Promise<string> {
  const prefs = await readEffectiveReadingPlanPrefs();
  return prefs.startedOn?.trim() || toLocalDateString(now);
}

export async function readNtDeepRepeatProgress(): Promise<NtDeepRepeatReadingState> {
  try {
    const raw = await readProgressRawFromStorage();
    const hasSaved = raw != null;
    const stored = hasSaved
      ? normalizeNtDeepRepeatReadingState(parseNtDeepRepeatProgress(raw) ?? undefined)
      : createDefaultNtDeepRepeatReadingState();
    const base = resolveEffectiveNtDeepRepeatProgress(stored, hasSaved);
    const prefs = await readEffectiveReadingPlanPrefs();
    const aligned = alignNtDeepRepeatProgressToCalendar(base, prefs);
    if (hasSaved && !ntDeepRepeatPlanPointersEqual(base, aligned)) {
      await replaceNtDeepRepeatProgress(aligned);
    }
    return aligned;
  } catch {
    return createFreshNtDeepRepeatProgress();
  }
}

export async function hasUserNtDeepRepeatProgress(): Promise<boolean> {
  try {
    const v4 = await AsyncStorage.getItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY);
    if (v4 != null) return true;
    return (
      (await AsyncStorage.getItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY_V4)) != null ||
      (await AsyncStorage.getItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY_V3)) != null
    );
  } catch {
    return false;
  }
}

async function persistNtDeepRepeatProgress(state: NtDeepRepeatReadingState): Promise<void> {
  await AsyncStorage.setItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY, JSON.stringify(state));
  emit();
}

export async function writeNtDeepRepeatProgress(state: NtDeepRepeatReadingState): Promise<void> {
  try {
    await persistNtDeepRepeatProgress(state);
    const { notifyMemberReadingLocalChanged } = await import("../../member-sync/requestMemberReadingSync");
    notifyMemberReadingLocalChanged("ntDeepRepeatProgress");
  } catch {
    /* ignore */
  }
}

export async function replaceNtDeepRepeatProgress(state: NtDeepRepeatReadingState): Promise<void> {
  try {
    await persistNtDeepRepeatProgress(state);
  } catch {
    /* ignore */
  }
}

export async function resetNtDeepRepeatProgressToFresh(
  now = new Date(),
  pace: NtDeepRepeatPace = NT_DEEP_REPEAT_DEFAULT_PACE,
): Promise<NtDeepRepeatReadingState> {
  try {
    await AsyncStorage.removeItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY);
    await AsyncStorage.removeItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY_V4);
    await AsyncStorage.removeItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY_V3);
    emit();
  } catch {
    /* ignore */
  }
  const state = createFreshNtDeepRepeatProgress(now, pace);
  await writeNtDeepRepeatProgress(state);
  return state;
}

/** 重置进度到指定计划日（1 = 起始当天），用于用户手动选择「从第几天开始读」。 */
export async function resetNtDeepRepeatProgressToPlanDay(
  planDay: number,
  now = new Date(),
  pace: NtDeepRepeatPace = NT_DEEP_REPEAT_DEFAULT_PACE,
): Promise<NtDeepRepeatReadingState> {
  const safeDay = Math.max(1, Math.floor(planDay));
  if (safeDay <= 1) return resetNtDeepRepeatProgressToFresh(now, pace);
  try {
    await AsyncStorage.removeItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY);
    await AsyncStorage.removeItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY_V4);
    await AsyncStorage.removeItem(NT_DEEP_REPEAT_PROGRESS_STORAGE_KEY_V3);
    emit();
  } catch {
    /* ignore */
  }
  const startedAt = toLocalDateString(now);
  const state = ntDeepRepeatStateForPlanDay(safeDay, { pace, startedAt });
  state.startedAt = startedAt;
  await writeNtDeepRepeatProgress(state);
  return state;
}

export async function advanceNtDeepRepeatProgressTrack(
  track: NtDeepRepeatTrack,
  now = new Date(),
): Promise<NtDeepRepeatReadingState> {
  const stored = await readNtDeepRepeatProgress();
  let next =
    track === "ot" ? advanceNtDeepRepeatOtTrack(stored) : advanceNtDeepRepeatNtDay(stored);
  if (!next.startedAt) {
    next = { ...next, startedAt: await startedAtForProgress(now) };
  }
  await writeNtDeepRepeatProgress(next);
  return next;
}

export async function markNtDeepRepeatChapterRead(
  bookId: string,
  chapter: number,
): Promise<NtDeepRepeatReadingState> {
  const stored = await readNtDeepRepeatProgress();
  const next = addNtDeepRepeatChapterReadToState(stored, bookId, chapter);
  await writeNtDeepRepeatProgress(next);
  return next;
}

export async function resetNtDeepRepeatProgress(): Promise<NtDeepRepeatReadingState> {
  return resetNtDeepRepeatProgressToFresh();
}

export async function advanceNtDeepRepeatOnePlanDay(now = new Date()): Promise<NtDeepRepeatReadingState> {
  const raw = await readProgressRawFromStorage();
  const hasSaved = raw != null;
  const stored = hasSaved
    ? normalizeNtDeepRepeatReadingState(parseNtDeepRepeatProgress(raw) ?? undefined)
    : createDefaultNtDeepRepeatReadingState();
  const base = resolveEffectiveNtDeepRepeatProgress(stored, hasSaved);
  let next = advanceNtDeepRepeatOneCalendarDay(base);
  if (!next.startedAt) {
    next = { ...next, startedAt: await startedAtForProgress(now) };
  }
  await writeNtDeepRepeatProgress(next);
  return next;
}

export async function resetNtDeepRepeatToCalendarToday(now = new Date()): Promise<NtDeepRepeatReadingState> {
  const prefs = await readEffectiveReadingPlanPrefs();
  const planDay = resolveNtDeepRepeatPlanDay(prefs, now);
  return jumpNtDeepRepeatProgressToPlanDay(planDay, now);
}

/** 一次跳到指定计划日（保留已读章），供「进度设置为今日」原子写入。 */
export async function jumpNtDeepRepeatProgressToPlanDay(
  planDay: number,
  now = new Date(),
): Promise<NtDeepRepeatReadingState> {
  const prefs = await readEffectiveReadingPlanPrefs();
  const pace = prefs.ntDeepRepeatPace ?? NT_DEEP_REPEAT_DEFAULT_PACE;
  const startedAt = prefs.startedOn?.trim() || toLocalDateString(now);
  const safeDay = Math.max(1, Math.floor(planDay));
  let prevKeys: NtDeepRepeatReadingState["chaptersReadKeys"] | undefined;
  try {
    const raw = await readProgressRawFromStorage();
    if (raw) {
      prevKeys = normalizeNtDeepRepeatReadingState(parseNtDeepRepeatProgress(raw) ?? undefined).chaptersReadKeys;
    }
  } catch {
    /* ignore */
  }
  const state = normalizeNtDeepRepeatReadingState({
    ...ntDeepRepeatStateForPlanDay(safeDay, { pace, startedAt }),
    pace,
    startedAt,
    chaptersReadKeys: prevKeys,
  });
  await writeNtDeepRepeatProgress(state);
  return state;
}

function addLocalDays(d: Date, days: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + days);
  return out;
}

/**
 * 将某一新约版块（0-based 阶）设为今日读经：该阶第 1 天。
 * 必要时调整 startedOn / aheadDays，避免日历对齐把进度拉回。
 */
export async function setNtDeepRepeatCurriculumStageAsToday(
  curriculumIndex: number,
  now = new Date(),
): Promise<NtDeepRepeatReadingState> {
  const prefs = await readEffectiveReadingPlanPrefs();
  const pace = prefs.ntDeepRepeatPace ?? NT_DEEP_REPEAT_DEFAULT_PACE;
  const stageCount = Math.max(1, NT_DEEP_REPEAT_CURRICULUM.length);
  const safeIndex = Math.min(stageCount - 1, Math.max(0, Math.floor(curriculumIndex)));
  const planDay = safeIndex * pace + 1;

  let startedAt = prefs.startedOn?.trim() || toLocalDateString(now);
  let calendarDay = resolveNtDeepRepeatPlanDay({ ...prefs, startedOn: startedAt }, now);
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

  let prevKeys: NtDeepRepeatReadingState["chaptersReadKeys"] | undefined;
  try {
    const raw = await readProgressRawFromStorage();
    if (raw) {
      prevKeys = normalizeNtDeepRepeatReadingState(parseNtDeepRepeatProgress(raw) ?? undefined)
        .chaptersReadKeys;
    }
  } catch {
    /* ignore */
  }

  const state = normalizeNtDeepRepeatReadingState({
    ...ntDeepRepeatStateForPlanDay(planDay, { pace, startedAt }),
    pace,
    startedAt,
    chaptersReadKeys: prevKeys,
  });
  await writeNtDeepRepeatProgress(state);
  await writeReadingPlanPrefs(nextPrefs);
  try {
    const { notifyMemberReadingLocalChanged } = await import("../../member-sync/requestMemberReadingSync");
    notifyMemberReadingLocalChanged("readingPlanPrefs");
  } catch {
    /* ignore */
  }
  return state;
}
