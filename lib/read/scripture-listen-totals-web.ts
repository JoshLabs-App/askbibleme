/** Web：累计听经秒数（localStorage），供会员读经同步。 */

const STORAGE_KEY = "askbible-scripture-listen-totals-v1";

export type ScriptureListenTotalsRecord = {
  version: 1;
  totalSec: number;
};

function parse(raw: unknown): ScriptureListenTotalsRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as Partial<ScriptureListenTotalsRecord>;
  if (parsed.version !== 1) return null;
  const n = Number(parsed.totalSec);
  if (!Number.isFinite(n) || n < 0) return null;
  return { version: 1, totalSec: Math.floor(n) };
}

export function readScriptureListenTotalsWeb(): ScriptureListenTotalsRecord {
  if (typeof window === "undefined") return { version: 1, totalSec: 0 };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, totalSec: 0 };
    return parse(JSON.parse(raw) as unknown) ?? { version: 1, totalSec: 0 };
  } catch {
    return { version: 1, totalSec: 0 };
  }
}

export function writeScriptureListenTotalsWeb(record: ScriptureListenTotalsRecord): void {
  if (typeof window === "undefined") return;
  const next = { version: 1 as const, totalSec: Math.max(0, Math.floor(record.totalSec)) };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  emitListenTotals();
}

/**
 * 累加听经秒数。网页端此前**没有任何地方往上加**——总数只靠会员同步从原生端拉下来，
 * 所以纯网页用户的「累计听读时长」永远是 0（2026-09-19 修）。
 */
export function addScriptureListenSecondsWeb(sec: number): void {
  if (typeof window === "undefined") return;
  const add = Math.floor(sec);
  if (!Number.isFinite(add) || add <= 0) return;
  writeScriptureListenTotalsWeb({ version: 1, totalSec: readScriptureListenTotalsWeb().totalSec + add });
}

export function mergeScriptureListenTotalsWeb(
  a: ScriptureListenTotalsRecord,
  b: ScriptureListenTotalsRecord,
): ScriptureListenTotalsRecord {
  return { version: 1, totalSec: Math.max(a.totalSec, b.totalSec) };
}

export function replaceScriptureListenTotalsWeb(remote: ScriptureListenTotalsRecord): void {
  const local = readScriptureListenTotalsWeb();
  writeScriptureListenTotalsWeb(mergeScriptureListenTotalsWeb(local, remote));
}

const listenListeners = new Set<() => void>();

function emitListenTotals(): void {
  listenListeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

export function subscribeScriptureListenTotals(onStore: () => void): () => void {
  listenListeners.add(onStore);
  return () => listenListeners.delete(onStore);
}

export function getScriptureListenTotalSec(): number {
  return readScriptureListenTotalsWeb().totalSec;
}

export function formatScriptureListenDuration(totalSec: number, locale: string): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  if (locale === "en") {
    if (hours <= 0 && minutes <= 0) return `${sec} sec`;
    if (hours <= 0) return `${minutes} min`;
    if (minutes <= 0) return `${hours} hr`;
    return `${hours} hr ${minutes} min`;
  }
  if (hours <= 0 && minutes <= 0) return `${sec} 秒`;
  if (hours <= 0) return `${minutes} 分钟`;
  if (minutes <= 0) return `${hours} 小时`;
  return `${hours} 小时 ${minutes} 分钟`;
}
