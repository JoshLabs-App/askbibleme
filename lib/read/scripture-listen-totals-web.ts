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
