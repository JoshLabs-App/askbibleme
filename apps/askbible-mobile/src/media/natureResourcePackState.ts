import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { logSwallowedError } from "../debug/logSwallowedError";
import { toAbsoluteUrl } from "../config/askbibleBaseUrl";
import type { NatureSettingsV2 } from "../types/nature";

export type NaturePackAsset = {
  path: string;
  size: number;
  md5: string;
};

export type NaturePackManifest = {
  packType: "nature";
  packVersion: string;
  settings?: NatureSettingsV2;
  assets: NaturePackAsset[];
  generatedAt?: string;
};

export type NaturePackState = {
  version: string;
  settings: NatureSettingsV2 | null;
  byPath: Record<string, string>;
};

const STORAGE_KEY = "askbible.mobile.nature-resource-pack.v1";
const ROOT = `${FileSystem.documentDirectory}nature-resource-pack`;
export const NATURE_RESOURCE_PACK_CURRENT_DIR = `${ROOT}/current`;

let hydrated = false;
let syncing = false;
let syncPromise: Promise<boolean> | null = null;
let state: NaturePackState = { version: "", settings: null, byPath: {} };
const listeners = new Set<() => void>();

export function normalizeNatureAssetPath(raw: string): string {
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

export function localNaturePackUriForPath(assetPath: string): string {
  return `${NATURE_RESOURCE_PACK_CURRENT_DIR}/${assetPath.replace(/^\//, "")}`;
}

function emit() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      // ignore listener failure
    }
  });
}

async function persistState() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    logSwallowedError("natureResourcePackState.persistState", error);
  }
}

async function pruneMissingPackFiles(byPath: Record<string, string>): Promise<Record<string, string>> {
  const entries = Object.entries(byPath);
  if (entries.length === 0) return byPath;
  const next: Record<string, string> = {};
  await Promise.all(
    entries.map(async ([key, uri]) => {
      const path = String(uri || "").trim();
      if (!path) return;
      try {
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists) next[key] = path;
      } catch {
        /* drop stale path */
      }
    }),
  );
  return next;
}

export async function hydrateNatureResourcePackStateInternal() {
  if (hydrated) return;
  try {
    const raw = (await AsyncStorage.getItem(STORAGE_KEY))?.trim();
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<NaturePackState>;
      const byPath =
        parsed.byPath && typeof parsed.byPath === "object"
          ? (parsed.byPath as Record<string, string>)
          : {};
      const pruned = await pruneMissingPackFiles(byPath);
      state = {
        version: typeof parsed.version === "string" ? parsed.version : "",
        settings:
          parsed.settings && typeof parsed.settings === "object"
            ? (parsed.settings as NatureSettingsV2)
            : null,
        byPath: pruned,
      };
      if (Object.keys(pruned).length !== Object.keys(byPath).length) {
        await persistState();
      }
    }
  } catch (error) {
    logSwallowedError("natureResourcePackState.hydrateNatureResourcePackStateInternal", error);
    state = { version: "", settings: null, byPath: {} };
  } finally {
    hydrated = true;
  }
}

export async function ensureNaturePackParentDir(fileUri: string) {
  const lastSlash = fileUri.lastIndexOf("/");
  const dir = lastSlash > 0 ? fileUri.slice(0, lastSlash) : NATURE_RESOURCE_PACK_CURRENT_DIR;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
}

export function isValidNaturePackManifest(raw: unknown): raw is NaturePackManifest {
  if (!raw || typeof raw !== "object") return false;
  const obj = raw as Partial<NaturePackManifest>;
  if (obj.packType !== "nature") return false;
  if (typeof obj.packVersion !== "string" || !obj.packVersion.trim()) return false;
  if (!Array.isArray(obj.assets)) return false;
  return true;
}

export function shouldUpdateNaturePackFromManifest(manifest: NaturePackManifest): boolean {
  if (state.version !== manifest.packVersion) return true;
  return Object.keys(state.byPath).length === 0;
}

export function getNatureResourcePackState() {
  return state;
}

export function setNatureResourcePackState(next: NaturePackState) {
  state = next;
}

export function getNatureResourcePackSyncing() {
  return syncing;
}

export function setNatureResourcePackSyncing(value: boolean) {
  syncing = value;
}

export function getNatureResourcePackSyncPromise() {
  return syncPromise;
}

export function setNatureResourcePackSyncPromise(promise: Promise<boolean> | null) {
  syncPromise = promise;
}

export function emitNatureResourcePackChange() {
  emit();
}

export async function persistNatureResourcePackState() {
  await persistState();
}

export function subscribeNatureResourcePackChange(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

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

export async function downloadNaturePackAsset(
  baseUrl: string,
  asset: NaturePackAsset,
  onUnitProgress?: (percent: number) => void,
): Promise<string | null> {
  const pathNorm = normalizeNatureAssetPath(asset.path);
  if (!pathNorm.startsWith("/nature/") || pathNorm.includes("..")) return null;

  const target = localNaturePackUriForPath(pathNorm);
  const existing = await FileSystem.getInfoAsync(target, { md5: true });
  if (existing.exists && existing.size === asset.size && existing.md5 === asset.md5) {
    onUnitProgress?.(100);
    return target;
  }

  const remote = toAbsoluteUrl(baseUrl, pathNorm);
  if (!remote) return null;

  await ensureNaturePackParentDir(target);
  try {
    await FileSystem.deleteAsync(target, { idempotent: true });
  } catch {
    // ignore
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
