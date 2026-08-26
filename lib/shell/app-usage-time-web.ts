/** Web：累计前台使用秒数（localStorage），与 App `app-usage-time.ts` 同键。 */

const STORAGE_KEY = "askbible-app-usage-time-v1";

const listeners = new Set<() => void>();
let cachedTotalSec = 0;
let hydrated = false;
let sessionStartedAtMs: number | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let dirty = false;

function emit(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      /* ignore */
    }
  }
}

function liveSessionSec(): number {
  if (sessionStartedAtMs == null) return 0;
  return Math.max(0, (Date.now() - sessionStartedAtMs) / 1000);
}

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { version?: number; totalSec?: number };
    if (parsed.version !== 1) return;
    const n = Number(parsed.totalSec);
    if (Number.isFinite(n) && n >= 0) cachedTotalSec = Math.floor(n);
  } catch {
    /* ignore */
  }
}

function persistNow(): void {
  dirty = false;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, totalSec: Math.floor(cachedTotalSec) }));
  } catch {
    /* ignore */
  }
}

function schedulePersist(): void {
  dirty = true;
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (!dirty) return;
    persistNow();
  }, 2500);
}

export function subscribeAppUsageTime(onStore: () => void): () => void {
  hydrate();
  listeners.add(onStore);
  return () => {
    listeners.delete(onStore);
  };
}

export function getAppUsageTotalSec(): number {
  hydrate();
  return Math.floor(cachedTotalSec + liveSessionSec());
}

export function noteAppUsageForeground(): void {
  hydrate();
  if (sessionStartedAtMs != null) return;
  sessionStartedAtMs = Date.now();
  emit();
}

export function noteAppUsageBackground(): void {
  if (sessionStartedAtMs == null) return;
  cachedTotalSec += liveSessionSec();
  sessionStartedAtMs = null;
  emit();
  schedulePersist();
}

export function flushAppUsageTick(): void {
  if (sessionStartedAtMs == null) return;
  const now = Date.now();
  cachedTotalSec += Math.max(0, (now - sessionStartedAtMs) / 1000);
  sessionStartedAtMs = now;
  emit();
  schedulePersist();
}

export function formatAppUsageDuration(totalSec: number, locale: string): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  if (locale === "en") {
    if (hours <= 0 && minutes <= 0) return `${seconds} sec`;
    if (hours <= 0) return minutes > 0 && seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} sec`;
    if (minutes <= 0) return `${hours} hr`;
    return `${hours} hr ${minutes} min`;
  }
  if (hours <= 0 && minutes <= 0) return `${seconds} 秒`;
  if (hours <= 0) return seconds === 0 ? `${minutes} 分钟` : `${minutes} 分 ${seconds} 秒`;
  if (minutes <= 0) return `${hours} 小时`;
  return `${hours} 小时 ${minutes} 分钟`;
}

if (typeof window !== "undefined") {
  hydrate();
  noteAppUsageForeground();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") noteAppUsageForeground();
    else noteAppUsageBackground();
  });
  window.addEventListener("pagehide", noteAppUsageBackground);
  window.setInterval(flushAppUsageTick, 30_000);
}
