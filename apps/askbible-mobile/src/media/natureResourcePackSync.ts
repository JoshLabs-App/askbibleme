import { fetchWithTimeout } from "../api/fetchWithTimeout";
import { isNetworkAvailable } from "../network/isNetworkAvailable";
import { getAskBibleBaseUrl } from "../config/askbibleBaseUrl";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import type { NatureSettingsV2 } from "../types/nature";
import {
  downloadNaturePackAsset,
  emitNatureResourcePackChange,
  getNatureResourcePackState,
  getNatureResourcePackSyncPromise,
  getNatureResourcePackSyncing,
  hydrateNatureResourcePackStateInternal,
  isValidNaturePackManifest,
  normalizeNatureAssetPath,
  persistNatureResourcePackState,
  ResourcePackSyncOptions,
  ResourcePackSyncProgress,
  setNatureResourcePackState,
  setNatureResourcePackSyncPromise,
  setNatureResourcePackSyncing,
  shouldUpdateNaturePackFromManifest,
  subscribeNatureResourcePackChange,
  type NaturePackManifest,
} from "./natureResourcePackState";

export type { ResourcePackSyncProgress, ResourcePackSyncOptions } from "./natureResourcePackState";

async function fetchNaturePackManifest(): Promise<NaturePackManifest | null> {
  if (isMobileBundledOnly()) return null;
  if (!(await isNetworkAvailable())) return null;
  const baseUrl = getAskBibleBaseUrl().replace(/\/$/, "");
  const manifestUrl = `${baseUrl}/api/mobile/resource-pack/nature/manifest`;
  const res = await fetchWithTimeout(manifestUrl, {
    headers: { Accept: "application/json" },
    timeoutMs: 5000,
  });
  if (!res.ok) return null;
  const raw: unknown = await res.json();
  if (!isValidNaturePackManifest(raw)) return null;
  return raw;
}

async function runSyncOnce(options: ResourcePackSyncOptions = {}): Promise<boolean> {
  await hydrateNatureResourcePackStateInternal();
  if (getNatureResourcePackSyncing()) return false;
  setNatureResourcePackSyncing(true);
  try {
    const baseUrl = getAskBibleBaseUrl().replace(/\/$/, "");
    const manifest = await fetchNaturePackManifest();
    if (!manifest) return false;
    if (!options.force && !shouldUpdateNaturePackFromManifest(manifest)) {
      return false;
    }

    const total = manifest.assets.length;
    const nextByPath: Record<string, string> = {};
    for (let i = 0; i < manifest.assets.length; i += 1) {
      const asset = manifest.assets[i]!;
      options.onProgress?.({
        completedUnits: i,
        totalUnits: total,
        currentLabel: asset.path,
        unitPercent: 0,
      });
      const uri = await downloadNaturePackAsset(baseUrl, asset, (unitPercent) => {
        options.onProgress?.({
          completedUnits: i,
          totalUnits: total,
          currentLabel: asset.path,
          unitPercent,
        });
      });
      if (!uri) continue;
      const key = normalizeNatureAssetPath(asset.path);
      if (key) nextByPath[key] = uri;
    }

    if (Object.keys(nextByPath).length === 0) return false;

    setNatureResourcePackState({
      version: manifest.packVersion,
      settings:
        manifest.settings && typeof manifest.settings === "object"
          ? manifest.settings
          : null,
      byPath: nextByPath,
    });
    await persistNatureResourcePackState();
    emitNatureResourcePackChange();
    options.onProgress?.({
      completedUnits: total,
      totalUnits: total,
      currentLabel: "",
      unitPercent: 100,
    });
    return true;
  } catch {
    return false;
  } finally {
    setNatureResourcePackSyncing(false);
  }
}

export type NaturePackUpdateCheck = {
  available: boolean;
  latestVersion: string;
};

export async function ensureNatureResourcePackSync(options?: ResourcePackSyncOptions): Promise<boolean> {
  if (isMobileBundledOnly()) return false;
  if (!getNatureResourcePackSyncPromise()) {
    setNatureResourcePackSyncPromise(
      runSyncOnce(options ?? {}).finally(() => {
        setNatureResourcePackSyncPromise(null);
      }),
    );
  }
  return getNatureResourcePackSyncPromise()!;
}

export async function checkNatureResourcePackUpdate(): Promise<NaturePackUpdateCheck> {
  await hydrateNatureResourcePackStateInternal();
  try {
    const manifest = await fetchNaturePackManifest();
    if (!manifest) return { available: false, latestVersion: "" };
    return {
      available: shouldUpdateNaturePackFromManifest(manifest),
      latestVersion: manifest.packVersion,
    };
  } catch {
    return { available: false, latestVersion: "" };
  }
}

export async function hydrateNatureResourcePackState(): Promise<void> {
  await hydrateNatureResourcePackStateInternal();
}

export function resolveNatureResourcePackUri(pathOrUrl: string): string | null {
  const key = normalizeNatureAssetPath(pathOrUrl);
  if (!key) return null;
  return getNatureResourcePackState().byPath[key] ?? null;
}

export async function readSyncedNatureSettings(): Promise<NatureSettingsV2 | null> {
  await hydrateNatureResourcePackStateInternal();
  return getNatureResourcePackState().settings;
}

export { subscribeNatureResourcePackChange };
