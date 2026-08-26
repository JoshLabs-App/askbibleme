import { isExploreFeaturedArticlesBundle } from "@/lib/explore/explore-featured-articles-bundle-types";
import { isExploreModulesBundle } from "@/lib/explore/explore-modules-bundle-types";
import { isMobileLegacyFiguresBundle } from "@/lib/explore/legacy-figures-mobile-bundle-types";
import {
  getCachedLegacyFiguresBundle,
  getLegacyFiguresBundleFetchedAt,
  setCachedLegacyFiguresBundle,
} from "@/lib/explore/explore-legacy-figures-cache-web";

const REFRESH_TTL_MS = 60 * 60 * 1000;
const FAILURE_BACKOFF_MS = 60 * 60 * 1000;
const DEBOUNCE_MS = 30_000;

let lastModulesFetchedAt = 0;
let lastFeaturedFetchedAt = 0;
let lastModulesAttemptAt = 0;
let lastFeaturedAttemptAt = 0;
let lastModulesFailureAt = 0;
let lastFeaturedFailureAt = 0;
let lastLegacyAttemptAt = 0;
let lastLegacyFailureAt = 0;

function shouldRefresh(lastFetchedAt: number, lastAttemptAt: number, lastFailureAt: number): boolean {
  const now = Date.now();
  if (now - lastAttemptAt < DEBOUNCE_MS) return false;
  if (lastFetchedAt > 0 && now - lastFetchedAt < REFRESH_TTL_MS) return false;
  if (lastFailureAt > 0 && now - lastFailureAt < FAILURE_BACKOFF_MS) return false;
  return true;
}

async function fetchJson<T>(url: string, validate: (raw: unknown) => raw is T): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    return validate(data) ? data : null;
  } catch {
    return null;
  }
}

/** 探索 Tab 聚焦时后台刷新 modules + featured + legacy figures（对齐 App `refreshExploreContentWhenFocused`）。 */
export async function refreshExploreContentWeb(): Promise<{
  modules: import("@/lib/explore/explore-modules-bundle-types").ExploreModulesBundle | null;
  featured: import("@/lib/explore/explore-featured-articles-bundle-types").ExploreFeaturedArticlesBundle | null;
  legacyFigures: import("@/lib/explore/legacy-figures-mobile-bundle-types").MobileLegacyFiguresBundle | null;
}> {
  const modulesOk = shouldRefresh(lastModulesFetchedAt, lastModulesAttemptAt, lastModulesFailureAt);
  const featuredOk = shouldRefresh(lastFeaturedFetchedAt, lastFeaturedAttemptAt, lastFeaturedFailureAt);
  const legacyOk = shouldRefresh(
    getLegacyFiguresBundleFetchedAt(),
    lastLegacyAttemptAt,
    lastLegacyFailureAt,
  );

  let modules: import("@/lib/explore/explore-modules-bundle-types").ExploreModulesBundle | null = null;
  let featured: import("@/lib/explore/explore-featured-articles-bundle-types").ExploreFeaturedArticlesBundle | null =
    null;
  let legacyFigures: import("@/lib/explore/legacy-figures-mobile-bundle-types").MobileLegacyFiguresBundle | null =
    null;

  if (modulesOk) {
    lastModulesAttemptAt = Date.now();
    modules = await fetchJson("/api/mobile/explore/modules", isExploreModulesBundle);
    if (modules) {
      lastModulesFetchedAt = Date.now();
      lastModulesFailureAt = 0;
    } else {
      lastModulesFailureAt = Date.now();
    }
  }

  if (featuredOk) {
    lastFeaturedAttemptAt = Date.now();
    featured = await fetchJson("/api/mobile/explore/featured-articles", isExploreFeaturedArticlesBundle);
    if (featured && featured.articles.length > 0) {
      lastFeaturedFetchedAt = Date.now();
      lastFeaturedFailureAt = 0;
    } else {
      lastFeaturedFailureAt = Date.now();
    }
  }

  if (legacyOk) {
    lastLegacyAttemptAt = Date.now();
    legacyFigures = await fetchJson("/api/mobile/explore/legacy-figures", isMobileLegacyFiguresBundle);
    if (legacyFigures) {
      setCachedLegacyFiguresBundle(legacyFigures);
      lastLegacyFailureAt = 0;
    } else {
      lastLegacyFailureAt = Date.now();
    }
  }

  return { modules, featured, legacyFigures };
}

/** 人物馆页：拉取 mobile bundle 并写入缓存（与探索 Tab 刷新共用节流）。 */
export async function refreshLegacyFiguresWeb(): Promise<
  import("@/lib/explore/legacy-figures-mobile-bundle-types").MobileLegacyFiguresBundle | null
> {
  const { legacyFigures } = await refreshExploreContentWeb();
  return legacyFigures ?? getCachedLegacyFiguresBundle();
}
