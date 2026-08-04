import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "askbible-scripture-listen-totals-v1";

export type ScriptureListenTotalsRecord = {
  version: 1;
  /** 累计听读秒数（经文朗读） */
  totalSec: number;
};

const listeners = new Set<() => void>();
let cachedTotalSec = 0;
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
let lastPosSec = -1;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let dirty = false;

function emit(): void {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* ignore */
    }
  }
}

export function subscribeScriptureListenTotals(onStore: () => void): () => void {
  void hydrate();
  listeners.add(onStore);
  return () => {
    listeners.delete(onStore);
  };
}

export function getScriptureListenTotalSec(): number {
  void hydrate();
  return cachedTotalSec;
}

export function parseScriptureListenTotalsRecord(raw: unknown): ScriptureListenTotalsRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as Partial<ScriptureListenTotalsRecord>;
  if (parsed.version !== 1) return null;
  const n = Number(parsed.totalSec);
  if (!Number.isFinite(n) || n < 0) return null;
  return { version: 1, totalSec: Math.floor(n) };
}

async function hydrate(): Promise<void> {
  if (hydrated) return;
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const record = parseScriptureListenTotalsRecord(JSON.parse(raw) as unknown);
      if (!record) return;
      // 与 hydrate 期间已累加的秒数取较大值，避免异步读盘覆盖实时进度。
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

export async function readScriptureListenTotalsRecord(): Promise<ScriptureListenTotalsRecord> {
  await hydrate();
  return { version: 1, totalSec: Math.floor(cachedTotalSec) };
}

async function persistNow(notifySync: boolean): Promise<void> {
  dirty = false;
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        totalSec: Math.floor(cachedTotalSec),
      } satisfies ScriptureListenTotalsRecord),
    );
  } catch {
    return;
  }
  if (!notifySync) return;
  try {
    const { notifyMemberReadingLocalChanged } = await import("../member-sync/requestMemberReadingSync");
    notifyMemberReadingLocalChanged("scriptureListenTotals");
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
    void persistNow(true);
  }, 2000);
}

/** 合并远端累计听时长：取较大值，避免回退。 */
export function mergeScriptureListenTotalsRecords(
  a: ScriptureListenTotalsRecord,
  b: ScriptureListenTotalsRecord,
): ScriptureListenTotalsRecord {
  return { version: 1, totalSec: Math.max(a.totalSec, b.totalSec) };
}

/** 同步写入（会员资料合并/拉取后）；不触发再上传。 */
export async function replaceScriptureListenTotalsRecord(
  remote: ScriptureListenTotalsRecord,
): Promise<void> {
  await hydrate();
  const next = Math.max(cachedTotalSec, Math.floor(remote.totalSec));
  if (next === cachedTotalSec) return;
  cachedTotalSec = next;
  emit();
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  await persistNow(false);
}

/** 经文播放进度回调：仅在正向小幅推进时累加，避免 seek 跳秒虚增。 */
export function noteScriptureListenProgress(positionSec: number, isPlaying: boolean): void {
  void hydrate();
  if (!isPlaying || !Number.isFinite(positionSec) || positionSec < 0) {
    lastPosSec = -1;
    return;
  }
  if (lastPosSec >= 0 && positionSec > lastPosSec) {
    const delta = Math.min(positionSec - lastPosSec, 1.5);
    if (delta > 0) {
      cachedTotalSec += delta;
      emit();
      schedulePersist();
    }
  }
  lastPosSec = positionSec;
}

export function formatScriptureListenDuration(totalSec: number, locale: string): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  if (locale === "en") {
    if (hours <= 0) return `${minutes} min`;
    if (minutes <= 0) return `${hours} hr`;
    return `${hours} hr ${minutes} min`;
  }
  if (hours <= 0) return `${minutes} 分钟`;
  if (minutes <= 0) return `${hours} 小时`;
  return `${hours} 小时 ${minutes} 分钟`;
}

void hydrate();
