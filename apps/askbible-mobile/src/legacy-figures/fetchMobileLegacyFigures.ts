import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchWithTimeout } from "../api/fetchWithTimeout";
import { isNetworkAvailable } from "../network/isNetworkAvailable";
import {
  buildExploreContentFetchCandidates,
  readExploreRemoteEnabledFromCachedManifest,
  shouldAttemptExploreContentRemoteRefresh,
} from "../explore/exploreContentRemoteShared";
import {
  getBundledMobileLegacyFiguresBundle,
  isMobileLegacyFiguresBundle,
  type MobileLegacyFiguresBundle,
} from "./mobileLegacyFiguresBundleCore";

const CACHE_KEY = "askbible-mobile-legacy-figures-bundle-v1";
const REMOTE_TIMEOUT_MS = 12_000;

type CachedBundle = {
  fetchedAt: number;
  contentVersion: string;
  bundle: MobileLegacyFiguresBundle;
};

let activeBundle: MobileLegacyFiguresBundle = getBundledMobileLegacyFiguresBundle();
let lastFetchedAt = 0;
let lastRemoteAttemptAt = 0;
let lastRemoteFailureAt = 0;
let hydratePromise: Promise<MobileLegacyFiguresBundle> | null = null;
let backgroundRefreshPromise: Promise<void> | null = null;

const listeners = new Set<(bundle: MobileLegacyFiguresBundle) => void>();

function notifyListeners(): void {
  for (const listener of listeners) {
    listener(activeBundle);
  }
}

export function getActiveMobileLegacyFiguresBundle(): MobileLegacyFiguresBundle {
  return activeBundle;
}

export function subscribeMobileLegacyFiguresBundle(
  listener: (bundle: MobileLegacyFiguresBundle) => void,
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
    if (!parsed.bundle || !isMobileLegacyFiguresBundle(parsed.bundle)) return null;
    return {
      fetchedAt: typeof parsed.fetchedAt === "number" ? parsed.fetchedAt : 0,
      contentVersion: typeof parsed.contentVersion === "string" ? parsed.contentVersion : "",
      bundle: parsed.bundle,
    };
  } catch {
    return null;
  }
}

async function writeCachedBundle(bundle: MobileLegacyFiguresBundle): Promise<void> {
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

export async function fetchMobileLegacyFiguresBundleFromRemote(): Promise<MobileLegacyFiguresBundle | null> {
  if (!(await isNetworkAvailable())) return null;

  for (const base of buildExploreContentFetchCandidates()) {
    try {
      const res = await fetchWithTimeout(`${base}/api/mobile/explore/legacy-figures`, {
        headers: { Accept: "application/json" },
        timeoutMs: REMOTE_TIMEOUT_MS,
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok || !contentType.includes("application/json")) continue;
      const data = (await res.json()) as unknown;
      if (isMobileLegacyFiguresBundle(data)) {
        return data;
      }
    } catch {
      /* offline or server unavailable */
    }
  }
  return null;
}

export async function hydrateMobileLegacyFiguresFromDisk(): Promise<MobileLegacyFiguresBundle> {
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    const cached = await readCachedPayload();
    if (cached?.bundle.profiles.length) {
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

async function refreshMobileLegacyFiguresRemote(force: boolean): Promise<MobileLegacyFiguresBundle> {
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

  const remote = await fetchMobileLegacyFiguresBundleFromRemote();
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

export function refreshMobileLegacyFiguresInBackground(): void {
  if (backgroundRefreshPromise) return;
  backgroundRefreshPromise = refreshMobileLegacyFiguresRemote(false)
    .then(() => undefined)
    .finally(() => {
      backgroundRefreshPromise = null;
    });
}

export async function forceRefreshMobileLegacyFigures(): Promise<MobileLegacyFiguresBundle> {
  await hydrateMobileLegacyFiguresFromDisk();
  return refreshMobileLegacyFiguresRemote(true);
}
