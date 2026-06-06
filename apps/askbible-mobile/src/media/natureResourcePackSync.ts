import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { fetchWithTimeout } from "../api/fetchWithTimeout";
import { getAskBibleBaseUrl, toAbsoluteUrl } from "../config/askbibleBaseUrl";
import type { NatureSettingsV2 } from "../types/nature";

type NaturePackAsset = {
  path: string;
  size: number;
  md5: string;
};

type NaturePackManifest = {
  packType: "nature";
  packVersion: string;
  settings?: NatureSettingsV2;
  assets: NaturePackAsset[];
  generatedAt?: string;
};

type NaturePackState = {
  version: string;
  settings: NatureSettingsV2 | null;
  byPath: Record<string, string>;
};

const STORAGE_KEY = "askbible.mobile.nature-resource-pack.v1";
const ROOT = `${FileSystem.documentDirectory}nature-resource-pack`;
const CURRENT_DIR = `${ROOT}/current`;

let hydrated = false;
let syncing = false;
let syncPromise: Promise<boolean> | null = null;
let state: NaturePackState = { version: "", settings: null, byPath: {} };
const listeners = new Set<() => void>();

function normalizeNatureAssetPath(raw: string): string {
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
      // ignore listener failure
    }
  });
}

async function persistState() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage failure
  }
}

async function hydrateState() {
  if (hydrated) return;
  try {
    const raw = (await AsyncStorage.getItem(STORAGE_KEY))?.trim();
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<NaturePackState>;
      state = {
        version: typeof parsed.version === "string" ? parsed.version : "",
        settings:
          parsed.settings && typeof parsed.settings === "object"
            ? (parsed.settings as NatureSettingsV2)
            : null,
        byPath:
          parsed.byPath && typeof parsed.byPath === "object"
            ? (parsed.byPath as Record<string, string>)
            : {},
      };
    }
  } catch {
    state = { version: "", settings: null, byPath: {} };
  } finally {
    hydrated = true;
  }
}

async function ensureParentDir(fileUri: string) {
  const lastSlash = fileUri.lastIndexOf("/");
  const dir = lastSlash > 0 ? fileUri.slice(0, lastSlash) : CURRENT_DIR;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
}

function isValidManifest(raw: unknown): raw is NaturePackManifest {
  if (!raw || typeof raw !== "object") return false;
  const obj = raw as Partial<NaturePackManifest>;
  if (obj.packType !== "nature") return false;
  if (typeof obj.packVersion !== "string" || !obj.packVersion.trim()) return false;
  if (!Array.isArray(obj.assets)) return false;
  return true;
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

async function downloadAsset(
  baseUrl: string,
  asset: NaturePackAsset,
  onUnitProgress?: (percent: number) => void,
): Promise<string | null> {
  const pathNorm = normalizeNatureAssetPath(asset.path);
  if (!pathNorm.startsWith("/nature/") || pathNorm.includes("..")) return null;

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

async function fetchNaturePackManifest(): Promise<NaturePackManifest | null> {
  const baseUrl = getAskBibleBaseUrl().replace(/\/$/, "");
  const manifestUrl = `${baseUrl}/api/mobile/resource-pack/nature/manifest`;
  const res = await fetchWithTimeout(manifestUrl, {
    headers: { Accept: "application/json" },
    timeoutMs: 5000,
  });
  if (!res.ok) return null;
  const raw: unknown = await res.json();
  if (!isValidManifest(raw)) return null;
  return raw;
}

function shouldUpdateFromManifest(manifest: NaturePackManifest): boolean {
  if (state.version !== manifest.packVersion) return true;
  return Object.keys(state.byPath).length === 0;
}

async function runSyncOnce(options: ResourcePackSyncOptions = {}): Promise<boolean> {
  await hydrateState();
  if (syncing) return false;
  syncing = true;
  try {
    const baseUrl = getAskBibleBaseUrl().replace(/\/$/, "");
    const manifest = await fetchNaturePackManifest();
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
      const key = normalizeNatureAssetPath(asset.path);
      if (key) nextByPath[key] = uri;
    }

    if (Object.keys(nextByPath).length === 0) return false;

    state = {
      version: manifest.packVersion,
      settings:
        manifest.settings && typeof manifest.settings === "object"
          ? manifest.settings
          : null,
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

export type NaturePackUpdateCheck = {
  available: boolean;
  latestVersion: string;
};

export async function ensureNatureResourcePackSync(options?: ResourcePackSyncOptions): Promise<boolean> {
  if (!syncPromise) {
    syncPromise = runSyncOnce(options ?? {}).finally(() => {
      syncPromise = null;
    });
  }
  return syncPromise;
}

export async function checkNatureResourcePackUpdate(): Promise<NaturePackUpdateCheck> {
  await hydrateState();
  try {
    const manifest = await fetchNaturePackManifest();
    if (!manifest) return { available: false, latestVersion: "" };
    return {
      available: shouldUpdateFromManifest(manifest),
      latestVersion: manifest.packVersion,
    };
  } catch {
    return { available: false, latestVersion: "" };
  }
}

export async function hydrateNatureResourcePackState(): Promise<void> {
  await hydrateState();
}

export function resolveNatureResourcePackUri(pathOrUrl: string): string | null {
  const key = normalizeNatureAssetPath(pathOrUrl);
  if (!key) return null;
  return state.byPath[key] ?? null;
}

export async function readSyncedNatureSettings(): Promise<NatureSettingsV2 | null> {
  await hydrateState();
  return state.settings;
}

export function subscribeNatureResourcePackChange(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

