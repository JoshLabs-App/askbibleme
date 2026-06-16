import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAskBibleBaseUrl } from "../config/askbibleBaseUrl";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";

export const EXPLORE_MANIFEST_CACHE_KEY = "askbible.mobile.content-manifest.v1";

/** 成功拉取后，此时间内不再请求线上（默认 24 小时） */
export const EXPLORE_CONTENT_REFRESH_TTL_MS = 24 * 60 * 60 * 1000;
/** 线上失败后，此时间内不再重试 */
export const EXPLORE_CONTENT_FAILURE_BACKOFF_MS = 60 * 60 * 1000;
export const EXPLORE_CONTENT_BACKGROUND_DEBOUNCE_MS = 30_000;

export function isLocalLikeHostFromBase(base: string): boolean {
  try {
    const u = new URL(base);
    const h = u.hostname.trim().toLowerCase();
    if (!h) return true;
    if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) return true;
    if (h.startsWith("10.") || h.startsWith("192.168.")) return true;
    const m = h.match(/^172\.(\d+)\./);
    if (m) {
      const octet = Number(m[1]);
      if (Number.isFinite(octet) && octet >= 16 && octet <= 31) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function buildExploreContentFetchCandidates(): string[] {
  const primaryBase = getAskBibleBaseUrl().replace(/\/$/, "");
  const candidates = [primaryBase];
  if (isLocalLikeHostFromBase(primaryBase) && !candidates.includes("https://askbible.me")) {
    candidates.push("https://askbible.me");
  }
  return candidates;
}

export async function readExploreRemoteEnabledFromCachedManifest(): Promise<boolean> {
  if (isMobileBundledOnly()) return false;
  try {
    const raw = await AsyncStorage.getItem(EXPLORE_MANIFEST_CACHE_KEY);
    if (!raw?.trim()) return true;
    const parsed = JSON.parse(raw) as { flags?: { exploreCategoriesRemoteEnabled?: boolean } };
    return parsed.flags?.exploreCategoriesRemoteEnabled !== false;
  } catch {
    return true;
  }
}

export function shouldAttemptExploreContentRemoteRefresh(input: {
  force: boolean;
  lastRemoteAttemptAt: number;
  lastFetchedAt: number;
  lastRemoteFailureAt: number;
}): boolean {
  if (isMobileBundledOnly()) return false;
  const now = Date.now();
  if (!input.force) {
    if (now - input.lastRemoteAttemptAt < EXPLORE_CONTENT_BACKGROUND_DEBOUNCE_MS) return false;
    if (input.lastFetchedAt > 0 && now - input.lastFetchedAt < EXPLORE_CONTENT_REFRESH_TTL_MS) return false;
    if (input.lastRemoteFailureAt > 0 && now - input.lastRemoteFailureAt < EXPLORE_CONTENT_FAILURE_BACKOFF_MS) {
      return false;
    }
  }
  return true;
}
