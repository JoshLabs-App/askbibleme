import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { fetchWithTimeout } from "../api/fetchWithTimeout";
import { getAskBibleBaseUrl, toAbsoluteUrl } from "../config/askbibleBaseUrl";
import type { MusicCompanionStore } from "../music/types";

type MusicPackAsset = {
  path: string;
  size: number;
  md5: string;
};

type MusicPackManifest = {
  packType: "music";
  packVersion: string;
  store?: MusicCompanionStore;
  assets: MusicPackAsset[];
  generatedAt?: string;
};

type MusicPackState = {
  version: string;
  store: MusicCompanionStore | null;
  byPath: Record<string, string>;
};

const STORAGE_KEY = "askbible.mobile.music-resource-pack.v1";
const ROOT = `${FileSystem.documentDirectory}music-resource-pack`;
const CURRENT_DIR = `${ROOT}/current`;

let hydrated = false;
let syncing = false;
let syncPromise: Promise<boolean> | null = null;
let state: MusicPackState = { version: "", store: null, byPath: {} };
const listeners = new Set<() => void>();

function normalizeMusicAssetPath(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) {
    try {
      return new URL(s).pathname;
    } catch {
      return "";
    }
  }
  return s.startsWith("/") ? s : `/${s}`;
}

function localUriForPath(assetPath: string): string {
  return `${CURRENT_DIR}/${assetPath.replace(/^\//, "")}`;
}

function emit() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

async function persistState() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

async function hydrateState() {
  if (hydrated) return;
  try {
    const raw = (await AsyncStorage.getItem(STORAGE_KEY))?.trim();
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MusicPackState>;
      state = {
        version: typeof parsed.version === "string" ? parsed.version : "",
        store:
          parsed.store && typeof parsed.store === "object"
            ? (parsed.store as MusicCompanionStore)
            : null,
        byPath:
          parsed.byPath && typeof parsed.byPath === "object"
            ? (parsed.byPath as Record<string, string>)
            : {},
      };
    }
  } catch {
    state = { version: "", store: null, byPath: {} };
  } finally {
    hydrated = true;
  }
}

async function ensureParentDir(fileUri: string) {
  const lastSlash = fileUri.lastIndexOf("/");
  const dir = lastSlash > 0 ? fileUri.slice(0, lastSlash) : CURRENT_DIR;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
}

function isValidManifest(raw: unknown): raw is MusicPackManifest {
  if (!raw || typeof raw !== "object") return false;
  const obj = raw as Partial<MusicPackManifest>;
  if (obj.packType !== "music") return false;
  if (typeof obj.packVersion !== "string" || !obj.packVersion.trim()) return false;
  if (!Array.isArray(obj.assets)) return false;
  return true;
}

async function downloadAsset(
  baseUrl: string,
  asset: MusicPackAsset,
  onUnitProgress?: (percent: number) => void,
): Promise<string | null> {
  const pathNorm = normalizeMusicAssetPath(asset.path);
  if (!pathNorm.startsWith("/music/") || pathNorm.includes("..")) return null;

  const target = localUriForPath(pathNorm);
  const existing = await FileSystem.getInfoAsync(target, { md5: true });
  if (existing.exists && existing.size === asset.size && existing.md5 === asset.md5) {
    onUnitProgress?.(100);
    return target;
  }

  const remote = toAbsoluteUrl(baseUrl, pathNorm);
  if (!remote) return null;

  await ensureParentDir(target);
  try {
    await FileSystem.deleteAsync(target, { idempotent: true });
  } catch {
    /* ignore */
  }

  if (onUnitProgress) {
    const resumable = FileSystem.createDownloadResumable(remote, target, {}, (progress) => {
      const total = progress.totalBytesExpectedToWrite;
      const pct =
        total > 0 ? Math.min(100, Math.floor((progress.totalBytesWritten / total) * 100)) : 0;
      onUnitProgress(pct);
    });
    const result = await resumable.downloadAsync();
    if (!result?.uri || result.status !== 200) return null;
    const verified = await FileSystem.getInfoAsync(target, { md5: true });
    if (!verified.exists || verified.size !== asset.size || verified.md5 !== asset.md5) return null;
    onUnitProgress(100);
    return target;
  }

  const result = await FileSystem.downloadAsync(remote, target, { md5: true });
  if (!result?.uri) return null;
  if (result.status !== 200) return null;
  if (result.md5 !== asset.md5) return null;
  return result.uri;
}

async function fetchMusicPackManifest(): Promise<MusicPackManifest | null> {
  const baseUrl = getAskBibleBaseUrl().replace(/\/$/, "");
  const manifestUrl = `${baseUrl}/api/mobile/resource-pack/music/manifest`;
  const res = await fetchWithTimeout(manifestUrl, {
    headers: { Accept: "application/json" },
    timeoutMs: 8000,
  });
  if (!res.ok) return null;
  const raw: unknown = await res.json();
  if (!isValidManifest(raw)) return null;
  return raw;
}

function shouldUpdateFromManifest(manifest: MusicPackManifest): boolean {
  if (state.version !== manifest.packVersion) return true;
  return Object.keys(state.byPath).length === 0;
}

async function runSyncOnce(options: ResourcePackSyncOptions = {}): Promise<boolean> {
  await hydrateState();
  if (syncing) return false;
  syncing = true;
  try {
    const baseUrl = getAskBibleBaseUrl().replace(/\/$/, "");
    const manifest = await fetchMusicPackManifest();
    if (!manifest) return false;
    if (!options.force && !shouldUpdateFromManifest(manifest)) {
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
      const uri = await downloadAsset(baseUrl, asset, (unitPercent) => {
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

    state = {
      version: manifest.packVersion,
      store:
        manifest.store && typeof manifest.store === "object"
          ? manifest.store
          : state.store,
      byPath: nextByPath,
    };
    await persistState();
    emit();
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
    syncing = false;
  }
}

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

export async function ensureMusicResourcePackSync(options?: ResourcePackSyncOptions): Promise<boolean> {
  const force = Boolean(options?.force);
  if (!syncPromise) {
    syncPromise = runSyncOnce({ force, onProgress: options?.onProgress }).finally(() => {
      syncPromise = null;
    });
  }
  return syncPromise;
}

export async function checkMusicResourcePackUpdate(): Promise<MusicPackUpdateCheck> {
  await hydrateState();
  try {
    const manifest = await fetchMusicPackManifest();
    if (!manifest) return { available: false, latestVersion: "" };
    return {
      available: shouldUpdateFromManifest(manifest),
      latestVersion: manifest.packVersion,
    };
  } catch {
    return { available: false, latestVersion: "" };
  }
}

export async function hydrateMusicResourcePackState(): Promise<void> {
  await hydrateState();
}

export function resolveMusicResourcePackUri(pathOrUrl: string): string | null {
  const key = normalizeMusicAssetPath(pathOrUrl);
  if (!key) return null;
  return state.byPath[key] ?? null;
}

export async function readSyncedMusicCompanionStore(): Promise<MusicCompanionStore | null> {
  await hydrateState();
  return state.store;
}

export function subscribeMusicResourcePackChange(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}
