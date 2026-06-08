import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchWithTimeout } from "../api/fetchWithTimeout";
import { getAskBibleBaseUrl } from "../config/askbibleBaseUrl";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import {
  getBundledExploreFeaturedArticlesBundle,
  isExploreFeaturedArticlesBundle,
  type ExploreFeaturedArticlesBundle,
} from "./exploreFeaturedArticlesBundleCore";

const CACHE_KEY = "askbible-explore-featured-articles-bundle-v1";
const MANIFEST_CACHE_KEY = "askbible.mobile.content-manifest.v1";
/** 成功拉取后，此时间内不再请求线上（默认 24 小时） */
const REFRESH_TTL_MS = 24 * 60 * 60 * 1000;
/** 线上失败后，此时间内不再重试（避免每次打开都卡住） */
const FAILURE_BACKOFF_MS = 60 * 60 * 1000;
const REMOTE_TIMEOUT_MS = 2500;
const BACKGROUND_DEBOUNCE_MS = 30_000;

type CachedBundle = {
  fetchedAt: number;
  contentVersion: string;
  bundle: ExploreFeaturedArticlesBundle;
};

let activeBundle: ExploreFeaturedArticlesBundle = getBundledExploreFeaturedArticlesBundle();
let lastFetchedAt = 0;
let lastRemoteAttemptAt = 0;
let lastRemoteFailureAt = 0;
let hydratePromise: Promise<ExploreFeaturedArticlesBundle> | null = null;
let backgroundRefreshPromise: Promise<void> | null = null;

const listeners = new Set<(bundle: ExploreFeaturedArticlesBundle) => void>();

function notifyListeners(): void {
  for (const listener of listeners) {
    listener(activeBundle);
  }
}

export function getActiveExploreFeaturedArticlesBundle(): ExploreFeaturedArticlesBundle {
  return activeBundle;
}

export function subscribeExploreFeaturedArticlesBundle(
  listener: (bundle: ExploreFeaturedArticlesBundle) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function isLocalLikeHostFromBase(base: string): boolean {
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

async function readCachedPayload(): Promise<CachedBundle | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw?.trim()) return null;
    const parsed = JSON.parse(raw) as Partial<CachedBundle>;
    if (!parsed.bundle || !isExploreFeaturedArticlesBundle(parsed.bundle)) return null;
    return {
      fetchedAt: typeof parsed.fetchedAt === "number" ? parsed.fetchedAt : 0,
      contentVersion: typeof parsed.contentVersion === "string" ? parsed.contentVersion : "",
      bundle: parsed.bundle,
    };
  } catch {
    return null;
  }
}

async function writeCachedBundle(bundle: ExploreFeaturedArticlesBundle): Promise<void> {
  try {
    const payload: CachedBundle = {
      fetchedAt: Date.now(),
      contentVersion: bundle.contentVersion?.trim() || "",
      bundle,
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    lastFetchedAt = payload.fetchedAt;
  } catch {
    /* ignore */
  }
}

async function readExploreRemoteEnabledFromCachedManifest(): Promise<boolean> {
  if (isMobileBundledOnly()) return false;
  try {
    const raw = await AsyncStorage.getItem(MANIFEST_CACHE_KEY);
    if (!raw?.trim()) return true;
    const parsed = JSON.parse(raw) as { flags?: { exploreCategoriesRemoteEnabled?: boolean } };
    return parsed.flags?.exploreCategoriesRemoteEnabled !== false;
  } catch {
    return true;
  }
}

export async function fetchExploreFeaturedArticlesBundleFromRemote(): Promise<ExploreFeaturedArticlesBundle | null> {
  const primaryBase = getAskBibleBaseUrl().replace(/\/$/, "");
  const candidates = [primaryBase];
  if (isLocalLikeHostFromBase(primaryBase) && !candidates.includes("https://askbible.me")) {
    candidates.push("https://askbible.me");
  }

  for (const base of candidates) {
    try {
      const res = await fetchWithTimeout(`${base}/api/mobile/explore/featured-articles`, {
        headers: { Accept: "application/json" },
        timeoutMs: REMOTE_TIMEOUT_MS,
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok || !contentType.includes("application/json")) continue;
      const data = (await res.json()) as unknown;
      if (isExploreFeaturedArticlesBundle(data) && data.articles.length > 0) {
        return data;
      }
    } catch {
      /* offline or server unavailable */
    }
  }
  return null;
}

/** 从磁盘缓存恢复；不访问网络。 */
export async function hydrateExploreFeaturedArticlesFromDisk(): Promise<ExploreFeaturedArticlesBundle> {
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    const cached = await readCachedPayload();
    if (cached?.bundle.articles.length) {
      activeBundle = cached.bundle;
      lastFetchedAt = cached.fetchedAt;
      notifyListeners();
    }
    return activeBundle;
  })();

  try {
    return await hydratePromise;
  } finally {
    hydratePromise = null;
  }
}

function shouldAttemptRemoteRefresh(force: boolean): boolean {
  if (isMobileBundledOnly()) return false;
  const now = Date.now();
  if (!force) {
    if (now - lastRemoteAttemptAt < BACKGROUND_DEBOUNCE_MS) return false;
    if (lastFetchedAt > 0 && now - lastFetchedAt < REFRESH_TTL_MS) return false;
    if (lastRemoteFailureAt > 0 && now - lastRemoteFailureAt < FAILURE_BACKOFF_MS) return false;
  }
  return true;
}

async function refreshExploreFeaturedArticlesRemote(force: boolean): Promise<ExploreFeaturedArticlesBundle> {
  if (!shouldAttemptRemoteRefresh(force)) {
    return activeBundle;
  }

  lastRemoteAttemptAt = Date.now();
  const remoteEnabled = await readExploreRemoteEnabledFromCachedManifest();
  if (!remoteEnabled) {
    return activeBundle;
  }

  const remote = await fetchExploreFeaturedArticlesBundleFromRemote();
  if (remote) {
    activeBundle = remote;
    lastRemoteFailureAt = 0;
    await writeCachedBundle(remote);
    notifyListeners();
    return activeBundle;
  }

  lastRemoteFailureAt = Date.now();
  return activeBundle;
}

/** 后台静默检查更新；立即返回，不阻塞 UI。 */
export function refreshExploreFeaturedArticlesInBackground(): void {
  if (backgroundRefreshPromise) return;
  backgroundRefreshPromise = refreshExploreFeaturedArticlesRemote(false)
    .then(() => undefined)
    .finally(() => {
      backgroundRefreshPromise = null;
    });
}

/** 用户主动刷新（如日后下拉刷新） */
export async function forceRefreshExploreFeaturedArticles(): Promise<ExploreFeaturedArticlesBundle> {
  await hydrateExploreFeaturedArticlesFromDisk();
  return refreshExploreFeaturedArticlesRemote(true);
}
