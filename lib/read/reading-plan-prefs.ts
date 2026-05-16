/** Device-local active reading plan (not synced to cloud). */
export type ReadingPlanAnchor = "from-today" | "calendar-jan1";

export type ReadingPlanPrefs = {
  version: 1;
  planId: string;
  anchor: ReadingPlanAnchor;
  /** Local calendar date YYYY-MM-DD when anchor is `from-today`. */
  startedOn?: string;
  /** Cached at activation so client can resolve today's day index without extra fetch. */
  dayCount?: number;
};

export const READING_PLAN_PREFS_STORAGE_KEY = "selah-reading-plan-prefs-v1";

/** Implicit plan when the user has not chosen one in local storage. */
export const DEFAULT_READING_PLAN_ID = "esvthroughthebible";
export const DEFAULT_READING_PLAN_ANCHOR: ReadingPlanAnchor = "calendar-jan1";
export const DEFAULT_READING_PLAN_DAY_COUNT = 365;

/**
 * `useSyncExternalStore` requires a stable snapshot reference when storage is unchanged.
 */
let snapshotRaw: string | undefined;
let snapshotPrefs: ReadingPlanPrefs | null = null;
let snapshotEffectivePrefs: ReadingPlanPrefs | null = null;

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
  if (typeof window === "undefined") return () => {};
  listeners.add(onStore);
  const onStorage = (e: StorageEvent) => {
    if (e.key === READING_PLAN_PREFS_STORAGE_KEY || e.key === null) onStore();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStore);
    window.removeEventListener("storage", onStorage);
  };
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

/** Whole local-calendar days from `from` to `to` (inclusive of direction). */
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
    if (j.anchor !== "from-today" && j.anchor !== "calendar-jan1") return null;
    const startedOn = typeof j.startedOn === "string" && j.startedOn.trim() ? j.startedOn.trim() : undefined;
    if (j.anchor === "from-today" && !startedOn) return null;
    const dayCount =
      typeof j.dayCount === "number" && Number.isInteger(j.dayCount) && j.dayCount > 0 ? j.dayCount : undefined;
    return { version: 1, planId: j.planId.trim(), anchor: j.anchor, startedOn, dayCount };
  } catch {
    return null;
  }
}

function refreshPrefsSnapshotFromStorage(): ReadingPlanPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(READING_PLAN_PREFS_STORAGE_KEY);
    const key = raw ?? "";
    if (key === snapshotRaw) return snapshotPrefs;
    snapshotRaw = key;
    snapshotPrefs = key ? parseReadingPlanPrefs(key) : null;
    snapshotEffectivePrefs = null;
    return snapshotPrefs;
  } catch {
    snapshotRaw = "";
    snapshotPrefs = null;
    snapshotEffectivePrefs = null;
    return null;
  }
}

export function buildDefaultReadingPlanPrefs(dayCount = DEFAULT_READING_PLAN_DAY_COUNT): ReadingPlanPrefs {
  return {
    version: 1,
    planId: DEFAULT_READING_PLAN_ID,
    anchor: DEFAULT_READING_PLAN_ANCHOR,
    dayCount,
  };
}

/** Stable reference for `useSyncExternalStore` SSR / hydration. */
const SERVER_EFFECTIVE_READING_PLAN_PREFS = buildDefaultReadingPlanPrefs();

/** Stored prefs, or the product default when nothing is saved. */
export function resolveEffectiveReadingPlanPrefs(
  stored: ReadingPlanPrefs | null,
  opts?: { dayCount?: number },
): ReadingPlanPrefs {
  if (stored) return stored;
  return buildDefaultReadingPlanPrefs(opts?.dayCount);
}

export function isImplicitDefaultReadingPlan(stored: ReadingPlanPrefs | null): boolean {
  return stored === null;
}

function refreshEffectivePrefsSnapshot(): ReadingPlanPrefs {
  const stored = refreshPrefsSnapshotFromStorage();
  const next = resolveEffectiveReadingPlanPrefs(stored);
  if (
    snapshotEffectivePrefs &&
    snapshotEffectivePrefs.planId === next.planId &&
    snapshotEffectivePrefs.anchor === next.anchor &&
    snapshotEffectivePrefs.startedOn === next.startedOn &&
    snapshotEffectivePrefs.dayCount === next.dayCount
  ) {
    return snapshotEffectivePrefs;
  }
  snapshotEffectivePrefs = next;
  return next;
}

/** Cached snapshot for `useSyncExternalStore` (client) — includes implicit default. */
export function getEffectiveReadingPlanPrefsSnapshot(): ReadingPlanPrefs {
  return refreshEffectivePrefsSnapshot();
}

/** SSR / hydration — product default until client reads storage. */
export function getEffectiveReadingPlanPrefsServerSnapshot(): ReadingPlanPrefs {
  return SERVER_EFFECTIVE_READING_PLAN_PREFS;
}

/** Cached snapshot for `useSyncExternalStore` (client) — stored only. */
export function getReadingPlanPrefsSnapshot(): ReadingPlanPrefs | null {
  return refreshPrefsSnapshotFromStorage();
}

/** SSR / hydration — always null until client reads storage. */
export function getReadingPlanPrefsServerSnapshot(): ReadingPlanPrefs | null {
  return null;
}

export function readReadingPlanPrefs(): ReadingPlanPrefs | null {
  return refreshPrefsSnapshotFromStorage();
}

export function readEffectiveReadingPlanPrefs(): ReadingPlanPrefs {
  return refreshEffectivePrefsSnapshot();
}

export function writeReadingPlanPrefs(prefs: ReadingPlanPrefs | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!prefs) {
      localStorage.removeItem(READING_PLAN_PREFS_STORAGE_KEY);
      snapshotRaw = "";
      snapshotPrefs = null;
      snapshotEffectivePrefs = null;
    } else {
      const json = JSON.stringify(prefs);
      localStorage.setItem(READING_PLAN_PREFS_STORAGE_KEY, json);
      snapshotRaw = json;
      snapshotPrefs = prefs;
      snapshotEffectivePrefs = null;
    }
    emit();
  } catch {
    /* ignore */
  }
}

export function setActiveReadingPlan(
  planId: string,
  anchor: ReadingPlanAnchor,
  opts?: { now?: Date; dayCount?: number },
): ReadingPlanPrefs {
  const now = opts?.now ?? new Date();
  const prefs: ReadingPlanPrefs = {
    version: 1,
    planId,
    anchor,
    startedOn: anchor === "from-today" ? toLocalDateString(now) : undefined,
    dayCount: opts?.dayCount,
  };
  writeReadingPlanPrefs(prefs);
  return prefs;
}

/** 0-based day index for today's local calendar. Clamps to [0, dayCount - 1]. */
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
  } else {
    const start = prefs.startedOn ?? today;
    offset = localDaysBetween(start, today);
  }
  if (offset < 0) offset = 0;
  if (offset >= dayCount) return dayCount - 1;
  return offset;
}
