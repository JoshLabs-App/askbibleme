import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchWithTimeout } from "../api/fetchWithTimeout";
import { isNetworkAvailable } from "../network/isNetworkAvailable";
import {
  buildExploreContentFetchCandidates,
  readExploreRemoteEnabledFromCachedManifest,
  shouldAttemptExploreContentRemoteRefresh,
} from "./exploreContentRemoteShared";
import {
  getBundledExploreFeaturedArticlesBundle,
  isExploreFeaturedArticlesBundle,
  shouldPreferBundledExploreFeaturedContent,
  type ExploreFeaturedArticlesBundle,
} from "./exploreFeaturedArticlesBundleCore";

const CACHE_KEY = "askbible-explore-featured-articles-bundle-v1";
const REMOTE_TIMEOUT_MS = 2500;

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

export async function fetchExploreFeaturedArticlesBundleFromRemote(): Promise<ExploreFeaturedArticlesBundle | null> {
  if (!(await isNetworkAvailable())) return null;

  for (const base of buildExploreContentFetchCandidates()) {
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
    const bundled = getBundledExploreFeaturedArticlesBundle();
    const cached = await readCachedPayload();
    if (cached?.bundle.articles.length) {
      const cachedVersion = cached.contentVersion || cached.bundle.contentVersion;
      if (shouldPreferBundledExploreFeaturedContent(bundled.contentVersion, cachedVersion)) {
        activeBundle = bundled;
      } else {
        activeBundle = cached.bundle;
        lastFetchedAt = cached.fetchedAt;
      }
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

async function refreshExploreFeaturedArticlesRemote(force: boolean): Promise<ExploreFeaturedArticlesBundle> {
  if (
    !shouldAttemptExploreContentRemoteRefresh({
      force,
      lastRemoteAttemptAt,
      lastFetchedAt,
      lastRemoteFailureAt,
    })
  ) {
    return activeBundle;
  }

  lastRemoteAttemptAt = Date.now();
  const remoteEnabled = await readExploreRemoteEnabledFromCachedManifest();
  if (!remoteEnabled) {
    return activeBundle;
  }

  const remote = await fetchExploreFeaturedArticlesBundleFromRemote();
  if (remote) {
    const bundled = getBundledExploreFeaturedArticlesBundle();
    if (shouldPreferBundledExploreFeaturedContent(bundled.contentVersion, remote.contentVersion)) {
      activeBundle = bundled;
      lastRemoteFailureAt = 0;
      await writeCachedBundle(bundled);
    } else {
      activeBundle = remote;
      lastRemoteFailureAt = 0;
      await writeCachedBundle(remote);
    }
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
