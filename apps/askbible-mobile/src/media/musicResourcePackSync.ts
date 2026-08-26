import * as FileSystem from "expo-file-system/legacy";
import { getAskBibleBaseUrl } from "../config/askbibleBaseUrl";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import type { MusicCompanionStore } from "../music/types";
import { downloadMusicAssetDirect, downloadMusicPackAsset, fetchMusicPackManifest } from "./musicResourcePackDownload";
import {
  deleteMusicResourcePackPath,
  emitMusicResourcePackChange,
  getMusicResourcePackState,
  getMusicResourcePackSyncPromise,
  getMusicResourcePackSyncing,
  hydrateMusicResourcePackStateInternal,
  isMusicAssetLocal,
  normalizeMusicAssetPath,
  persistMusicResourcePackState,
  setMusicResourcePackPath,
  setMusicResourcePackState,
  setMusicResourcePackStore,
  setMusicResourcePackSyncPromise,
  setMusicResourcePackSyncing,
  shouldSyncMusicResourcePack,
  subscribeMusicResourcePackChange,
} from "./musicResourcePackState";

export type MusicPackUpdateCheck = {
  available: boolean;
  latestVersion: string;
};

export type ResourcePackSyncProgress = {
  completedUnits: number;
  totalUnits: number;
  currentLabel: string;
  unitPercent: number;
};

export type ResourcePackSyncOptions = {
  force?: boolean;
  onProgress?: (progress: ResourcePackSyncProgress) => void;
};

export type MusicTrackDownloadInput = {
  src: string;
  analysisSrc?: string;
};

async function runSyncOnce(options: ResourcePackSyncOptions = {}): Promise<boolean> {
  await hydrateMusicResourcePackStateInternal();
  if (getMusicResourcePackSyncing()) return false;
  setMusicResourcePackSyncing(true);
  try {
    const baseUrl = getAskBibleBaseUrl().replace(/\/$/, "");
    const manifest = await fetchMusicPackManifest();
    if (!manifest) return false;
    if (!options.force && !(await shouldSyncMusicResourcePack(manifest))) {
      return false;
    }

    const prev = getMusicResourcePackState();
    const total = manifest.assets.length;
    const nextByPath: Record<string, string> = { ...prev.byPath };
    for (let i = 0; i < manifest.assets.length; i += 1) {
      const asset = manifest.assets[i]!;
      options.onProgress?.({
        completedUnits: i,
        totalUnits: total,
        currentLabel: asset.path,
        unitPercent: 0,
      });
      const uri = await downloadMusicPackAsset(baseUrl, asset, (unitPercent) => {
        options.onProgress?.({
          completedUnits: i,
          totalUnits: total,
          currentLabel: asset.path,
          unitPercent,
        });
      });
      if (!uri) continue;
      const key = normalizeMusicAssetPath(asset.path);
      if (key) nextByPath[key] = uri;
    }

    if (Object.keys(nextByPath).length === 0) return false;

    setMusicResourcePackState({
      version: manifest.packVersion,
      store:
        manifest.store && typeof manifest.store === "object"
          ? manifest.store
          : prev.store,
      byPath: nextByPath,
    });
    await persistMusicResourcePackState();
    emitMusicResourcePackChange();
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
    setMusicResourcePackSyncing(false);
  }
}

export async function ensureMusicResourcePackSync(options?: ResourcePackSyncOptions): Promise<boolean> {
  if (isMobileBundledOnly()) return false;
  const force = Boolean(options?.force);
  if (!getMusicResourcePackSyncPromise()) {
    setMusicResourcePackSyncPromise(
      runSyncOnce({ force, onProgress: options?.onProgress }).finally(() => {
        setMusicResourcePackSyncPromise(null);
      }),
    );
  }
  return getMusicResourcePackSyncPromise()!;
}

export async function checkMusicResourcePackUpdate(): Promise<MusicPackUpdateCheck> {
  await hydrateMusicResourcePackStateInternal();
  try {
    const manifest = await fetchMusicPackManifest();
    if (!manifest) return { available: false, latestVersion: "" };
    return {
      available: await shouldSyncMusicResourcePack(manifest),
      latestVersion: manifest.packVersion,
    };
  } catch {
    return { available: false, latestVersion: "" };
  }
}

export async function hydrateMusicResourcePackState(): Promise<void> {
  await hydrateMusicResourcePackStateInternal();
}

export function resolveMusicResourcePackUri(pathOrUrl: string): string | null {
  const key = normalizeMusicAssetPath(pathOrUrl);
  if (!key) return null;
  return getMusicResourcePackState().byPath[key] ?? null;
}

export async function readSyncedMusicCompanionStore(): Promise<MusicCompanionStore | null> {
  await hydrateMusicResourcePackStateInternal();
  return getMusicResourcePackState().store;
}

export { subscribeMusicResourcePackChange };

/** 按需下载单首曲目（mp3 + 分析 JSON），写入 DocumentDirectory，供本地播放。 */
export async function downloadMusicTrackAssets(
  track: MusicTrackDownloadInput,
  options: ResourcePackSyncOptions = {},
): Promise<boolean> {
  if (isMobileBundledOnly()) return false;
  await hydrateMusicResourcePackStateInternal();
  const baseUrl = getAskBibleBaseUrl().replace(/\/$/, "");
  const wanted = [
    normalizeMusicAssetPath(track.src),
    track.analysisSrc?.trim() ? normalizeMusicAssetPath(track.analysisSrc) : null,
  ].filter((p): p is string => Boolean(p));

  if (wanted.length === 0) return false;

  const localChecks = await Promise.all(wanted.map((p) => isMusicAssetLocal(p)));
  if (localChecks.every(Boolean)) return true;

  let assetsToFetch: import("./musicResourcePackState").MusicPackAsset[] = [];
  try {
    const manifest = await fetchMusicPackManifest();
    if (manifest) {
      assetsToFetch = manifest.assets.filter((asset) =>
        wanted.includes(normalizeMusicAssetPath(asset.path)),
      );
      if (manifest.store && typeof manifest.store === "object") {
        setMusicResourcePackStore(manifest.store);
      }
    }
  } catch {
    assetsToFetch = [];
  }

  const total = Math.max(1, assetsToFetch.length || wanted.length);
  let completed = 0;

  for (const assetPath of wanted) {
    const key = normalizeMusicAssetPath(assetPath);
    if (await isMusicAssetLocal(key)) {
      completed += 1;
      continue;
    }
    const manifestAsset = assetsToFetch.find((a) => normalizeMusicAssetPath(a.path) === key);
    options.onProgress?.({
      completedUnits: completed,
      totalUnits: total,
      currentLabel: key,
      unitPercent: 0,
    });
    const onUnitProgress = (unitPercent: number) => {
      options.onProgress?.({
        completedUnits: completed,
        totalUnits: total,
        currentLabel: key,
        unitPercent,
      });
    };
    let uri = await downloadMusicAssetDirect(baseUrl, key, onUnitProgress);
    if (!uri && manifestAsset) {
      uri = await downloadMusicPackAsset(baseUrl, manifestAsset, onUnitProgress);
    }
    if (!uri) {
      deleteMusicResourcePackPath(key);
      await persistMusicResourcePackState();
      return false;
    }
    if (manifestAsset) {
      try {
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists || (typeof info.size === "number" && info.size !== manifestAsset.size)) {
          deleteMusicResourcePackPath(key);
          await persistMusicResourcePackState();
          return false;
        }
      } catch {
        deleteMusicResourcePackPath(key);
        await persistMusicResourcePackState();
        return false;
      }
    }
    setMusicResourcePackPath(key, uri);
    completed += 1;
  }

  await persistMusicResourcePackState();
  emitMusicResourcePackChange();
  options.onProgress?.({
    completedUnits: total,
    totalUnits: total,
    currentLabel: "",
    unitPercent: 100,
  });
  return true;
}
