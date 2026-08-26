import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAskBibleBaseUrl } from "../config/askbibleBaseUrl";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";

export const EXPLORE_MANIFEST_CACHE_KEY = "askbible.mobile.content-manifest.v1";

/** 成功拉取后，此时间内不再请求线上（默认 1 小时） */
export const EXPLORE_CONTENT_REFRESH_TTL_MS = 60 * 60 * 1000;
/** 线上失败后，此时间内不再重试 */
export const EXPLORE_CONTENT_FAILURE_BACKOFF_MS = 60 * 60 * 1000;
export const EXPLORE_CONTENT_BACKGROUND_DEBOUNCE_MS = 30_000;

export function buildExploreContentFetchCandidates(): string[] {
  if (isMobileBundledOnly()) return [];
  const primaryBase = getAskBibleBaseUrl().replace(/\/$/, "");
  // 探索内容不经 askbible.me；仅本机/局域网等非主站基址。
  if (!primaryBase || /askbible\.me/i.test(primaryBase)) return [];
  return [primaryBase];
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
