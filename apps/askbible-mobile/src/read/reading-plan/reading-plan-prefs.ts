import AsyncStorage from "@react-native-async-storage/async-storage";
import { NT_DEEP_REPEAT_PLAN_DAY_COUNT, NT_DEEP_REPEAT_PLAN_ID } from "./nt-deep-repeat-plan";
import { READING_PLAN_EASTER_EPOCH_DATE } from "./reading-plan-epoch";

import type { NtDeepRepeatPace } from "./nt-deep-repeat-pace";
import { isNtDeepRepeatPace, NT_DEEP_REPEAT_DEFAULT_PACE } from "./nt-deep-repeat-pace";

export type ReadingPlanAnchor = "from-today" | "calendar-jan1" | "calendar-easter";

export type ReadingPlanPrefs = {
  version: 1;
  planId: string;
  anchor: ReadingPlanAnchor;
  startedOn?: string;
  dayCount?: number;
  /** Days read ahead of calendar today (0 = on calendar). Synced across devices. */
  aheadDays?: number;
  ntDeepRepeatPace?: NtDeepRepeatPace;
};

export const READING_PLAN_PREFS_STORAGE_KEY = "askbible-reading-plan-prefs-v1";
export const READING_PLAN_PREFS_STORAGE_KEY_LEGACY = "selah-reading-plan-prefs-v1";

export { READING_PLAN_EASTER_EPOCH_DATE } from "./reading-plan-epoch";
export { getReadingPlanDaySinceEpoch } from "./reading-plan-epoch";

export const DEFAULT_READING_PLAN_ID = NT_DEEP_REPEAT_PLAN_ID;
export const DEFAULT_READING_PLAN_ANCHOR: ReadingPlanAnchor = "from-today";
export const DEFAULT_READING_PLAN_DAY_COUNT = NT_DEEP_REPEAT_PLAN_DAY_COUNT;
export const DEFAULT_NT_DEEP_REPEAT_PACE: NtDeepRepeatPace = NT_DEEP_REPEAT_DEFAULT_PACE;

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

export function subscribeReadingPlanPrefs(onStore: () => void): () => void {
  listeners.add(onStore);
  return () => listeners.delete(onStore);
}

export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseLocalDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  if (!Number.isFinite(y) || mo < 1 || mo > 12 || da < 1 || da > 31) return null;
  return new Date(y, mo - 1, da);
}

export function localDaysBetween(from: string, to: string): number {
  const a = parseLocalDate(from);
  const b = parseLocalDate(to);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function jan1OfYear(year: number): string {
  return `${year}-01-01`;
}

export function parseReadingPlanPrefs(raw: string | null): ReadingPlanPrefs | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as ReadingPlanPrefs;
    if (j?.version !== 1 || typeof j.planId !== "string" || !j.planId.trim()) return null;
    if (j.anchor !== "from-today" && j.anchor !== "calendar-jan1" && j.anchor !== "calendar-easter") return null;
    const startedOn = typeof j.startedOn === "string" && j.startedOn.trim() ? j.startedOn.trim() : undefined;
    if (j.anchor === "from-today" && !startedOn) return null;
    const dayCount =
      typeof j.dayCount === "number" && Number.isInteger(j.dayCount) && j.dayCount > 0 ? j.dayCount : undefined;
    const aheadDays =
      typeof j.aheadDays === "number" && Number.isInteger(j.aheadDays) && j.aheadDays > 0
        ? j.aheadDays
        : undefined;
    const planId = j.planId.trim();
    const ntDeepRepeatPace = isNtDeepRepeatPace(j.ntDeepRepeatPace)
      ? j.ntDeepRepeatPace
      : planId === NT_DEEP_REPEAT_PLAN_ID
        ? NT_DEEP_REPEAT_DEFAULT_PACE
        : undefined;
    return {
      version: 1,
      planId,
      anchor: j.anchor,
      startedOn: j.anchor === "calendar-easter" ? READING_PLAN_EASTER_EPOCH_DATE : startedOn,
      dayCount,
      aheadDays,
      ntDeepRepeatPace,
    };
  } catch {
    return null;
  }
}

export function buildDefaultReadingPlanPrefs(
  dayCount = DEFAULT_READING_PLAN_DAY_COUNT,
  now = new Date(),
): ReadingPlanPrefs {
  const startedOn = toLocalDateString(now);
  return {
    version: 1,
    planId: DEFAULT_READING_PLAN_ID,
    anchor: DEFAULT_READING_PLAN_ANCHOR,
    startedOn,
    dayCount,
    ntDeepRepeatPace: DEFAULT_NT_DEEP_REPEAT_PACE,
  };
}

export function resolveEffectiveReadingPlanPrefs(
  stored: ReadingPlanPrefs | null,
  opts?: { dayCount?: number },
): ReadingPlanPrefs {
  if (stored) return stored;
  return buildDefaultReadingPlanPrefs(opts?.dayCount);
}

export async function readReadingPlanPrefs(): Promise<ReadingPlanPrefs | null> {
  try {
    const raw =
      (await AsyncStorage.getItem(READING_PLAN_PREFS_STORAGE_KEY)) ??
      (await AsyncStorage.getItem(READING_PLAN_PREFS_STORAGE_KEY_LEGACY));
    if (raw != null) {
      await AsyncStorage.setItem(READING_PLAN_PREFS_STORAGE_KEY, raw);
      await AsyncStorage.removeItem(READING_PLAN_PREFS_STORAGE_KEY_LEGACY);
    }
    return parseReadingPlanPrefs(raw);
  } catch {
    return null;
  }
}

export async function readEffectiveReadingPlanPrefs(): Promise<ReadingPlanPrefs> {
  const stored = await readReadingPlanPrefs();
  return resolveEffectiveReadingPlanPrefs(stored);
}

export async function writeReadingPlanPrefs(prefs: ReadingPlanPrefs | null): Promise<void> {
  try {
    if (!prefs) {
      await AsyncStorage.removeItem(READING_PLAN_PREFS_STORAGE_KEY);
      await AsyncStorage.removeItem(READING_PLAN_PREFS_STORAGE_KEY_LEGACY);
    } else {
      await AsyncStorage.setItem(READING_PLAN_PREFS_STORAGE_KEY, JSON.stringify(prefs));
      await AsyncStorage.removeItem(READING_PLAN_PREFS_STORAGE_KEY_LEGACY);
    }
    emit();
    const { notifyMemberReadingLocalChanged } = await import("../../member-sync/requestMemberReadingSync");
    notifyMemberReadingLocalChanged("readingPlanPrefs");
  } catch {
    /* ignore */
  }
}

export async function setActiveReadingPlan(
  planId: string,
  anchor: ReadingPlanAnchor,
  opts?: { now?: Date; dayCount?: number; ntDeepRepeatPace?: NtDeepRepeatPace },
): Promise<ReadingPlanPrefs> {
  const now = opts?.now ?? new Date();
  const prefs: ReadingPlanPrefs = {
    version: 1,
    planId,
    anchor,
    startedOn:
      anchor === "from-today"
        ? toLocalDateString(now)
        : anchor === "calendar-easter"
          ? READING_PLAN_EASTER_EPOCH_DATE
          : undefined,
    dayCount: opts?.dayCount,
    ntDeepRepeatPace: opts?.ntDeepRepeatPace,
  };
  await writeReadingPlanPrefs(prefs);
  return prefs;
}

export function resolveReadingPlanDayIndex(
  prefs: ReadingPlanPrefs,
  dayCount: number,
  now = new Date(),
): number {
  if (!Number.isFinite(dayCount) || dayCount < 1) return 0;
  const today = toLocalDateString(now);
  let offset = 0;
  if (prefs.anchor === "calendar-jan1") {
    offset = localDaysBetween(jan1OfYear(now.getFullYear()), today);
  } else if (prefs.anchor === "calendar-easter") {
    offset = localDaysBetween(READING_PLAN_EASTER_EPOCH_DATE, today);
  } else {
    const start = prefs.startedOn ?? today;
    offset = localDaysBetween(start, today);
  }
  if (offset < 0) offset = 0;
  if (offset >= dayCount) return dayCount - 1;
  return offset;
}
