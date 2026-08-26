import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "askbible-app-usage-time-v1";

export type AppUsageTimeRecord = {
  version: 1;
  /** 累计使用秒数（App 在前台的时间） */
  totalSec: number;
};

const listeners = new Set<() => void>();
let cachedTotalSec = 0;
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
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

export function subscribeAppUsageTime(onStore: () => void): () => void {
  void hydrateAppUsageTime();
  listeners.add(onStore);
  return () => {
    listeners.delete(onStore);
  };
}

export function getAppUsageTotalSec(): number {
  void hydrateAppUsageTime();
  return Math.floor(cachedTotalSec + liveSessionSec());
}

function liveSessionSec(): number {
  if (sessionStartedAtMs == null) return 0;
  return Math.max(0, (Date.now() - sessionStartedAtMs) / 1000);
}

function parseRecord(raw: unknown): AppUsageTimeRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as Partial<AppUsageTimeRecord>;
  if (parsed.version !== 1) return null;
  const n = Number(parsed.totalSec);
  if (!Number.isFinite(n) || n < 0) return null;
  return { version: 1, totalSec: Math.floor(n) };
}

export async function hydrateAppUsageTime(): Promise<void> {
  if (hydrated) return;
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const record = parseRecord(JSON.parse(raw) as unknown);
      if (!record) return;
      const next = Math.max(cachedTotalSec, record.totalSec);
      if (next === cachedTotalSec) return;
      cachedTotalSec = next;
      emit();
    } catch {
      /* ignore */
    } finally {
      hydrated = true;
    }
  })();
  return hydratePromise;
}

async function persistNow(): Promise<void> {
  dirty = false;
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        totalSec: Math.floor(cachedTotalSec),
      } satisfies AppUsageTimeRecord),
    );
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
    void persistNow();
  }, 2500);
}

/** App 进入前台：开始本段计时。 */
export function noteAppUsageForeground(): void {
  void hydrateAppUsageTime();
  if (sessionStartedAtMs != null) return;
  sessionStartedAtMs = Date.now();
  emit();
}

/** App 离开前台：把本段时长并入累计。 */
export function noteAppUsageBackground(): void {
  if (sessionStartedAtMs == null) return;
  cachedTotalSec += liveSessionSec();
  sessionStartedAtMs = null;
  emit();
  schedulePersist();
}

/** 前台期间周期性落盘，避免闪退后丢失过久。 */
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

void hydrateAppUsageTime();
