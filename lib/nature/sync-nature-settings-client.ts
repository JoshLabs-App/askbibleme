import type { NatureSettingsV2 } from "@/lib/nature/types";
import { natureSettingsRevision } from "@/lib/nature/nature-settings-revision";

const STORAGE_KEY = "selah-nature-settings-rev-v1";
const STALE_MS = 30 * 60 * 1000;

let lastFetchAt = 0;

function storedRevision(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredRevision(rev: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, rev);
  } catch {
    /* ignore */
  }
}

export function shouldSkipNatureSettingsClientFetch(initialRevision: string): boolean {
  return storedRevision() === initialRevision;
}

/** 构建期 revision 已对齐时跳过；否则拉 API，成功则写入 session revision。 */
export async function fetchNatureSettingsIfStale(
  initialRevision: string,
  opts?: { force?: boolean },
): Promise<NatureSettingsV2 | null> {
  if (!opts?.force && shouldSkipNatureSettingsClientFetch(initialRevision)) {
    return null;
  }
  const now = Date.now();
  if (!opts?.force && lastFetchAt > 0 && now - lastFetchAt < 8000) {
    return null;
  }
  lastFetchAt = now;
  try {
    const res = await fetch("/api/nature/settings", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as NatureSettingsV2 | null;
    if (!data || data.version !== 2 || !Array.isArray(data.videos) || !Array.isArray(data.ambientClips)) {
      return null;
    }
    writeStoredRevision(natureSettingsRevision(data));
    return data;
  } catch {
    return null;
  }
}

export function markNatureSettingsRevisionSynced(revision: string) {
  writeStoredRevision(revision);
}

export function natureSettingsStaleOnVisible(): boolean {
  if (lastFetchAt === 0) return false;
  return Date.now() - lastFetchAt > STALE_MS;
}
