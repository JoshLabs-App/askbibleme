import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { logSwallowedError } from "../debug/logSwallowedError";
import type { MusicCompanionStore } from "../music/types";

export type MusicPackAsset = {
  path: string;
  size: number;
  md5: string;
};

export type MusicPackManifest = {
  packType: "music";
  packVersion: string;
  store?: MusicCompanionStore;
  assets: MusicPackAsset[];
  generatedAt?: string;
};

export type MusicPackState = {
  version: string;
  store: MusicCompanionStore | null;
  byPath: Record<string, string>;
};

export const MUSIC_RESOURCE_PACK_STORAGE_KEY = "askbible.mobile.music-resource-pack.v1";
export const MUSIC_RESOURCE_PACK_ROOT = `${FileSystem.documentDirectory}music-resource-pack`;
export const MUSIC_RESOURCE_PACK_CURRENT_DIR = `${MUSIC_RESOURCE_PACK_ROOT}/current`;

let hydrated = false;
let syncing = false;
let syncPromise: Promise<boolean> | null = null;
let state: MusicPackState = { version: "", store: null, byPath: {} };
const listeners = new Set<() => void>();

export function normalizeMusicAssetPath(raw: string): string {
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

export function localMusicPackUriForPath(assetPath: string): string {
  return `${MUSIC_RESOURCE_PACK_CURRENT_DIR}/${assetPath.replace(/^\//, "")}`;
}

export function emitMusicResourcePackChange() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

export async function persistMusicResourcePackState() {
  try {
    await AsyncStorage.setItem(MUSIC_RESOURCE_PACK_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    logSwallowedError("musicResourcePackState.persistMusicResourcePackState", error);
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

export async function hydrateMusicResourcePackStateInternal() {
  if (hydrated) return;
  try {
    const raw = (await AsyncStorage.getItem(MUSIC_RESOURCE_PACK_STORAGE_KEY))?.trim();
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MusicPackState>;
      const byPath =
        parsed.byPath && typeof parsed.byPath === "object"
          ? (parsed.byPath as Record<string, string>)
          : {};
      const pruned = await pruneMissingPackFiles(byPath);
      state = {
        version: typeof parsed.version === "string" ? parsed.version : "",
        store:
          parsed.store && typeof parsed.store === "object"
            ? (parsed.store as MusicCompanionStore)
            : null,
        byPath: pruned,
      };
      if (Object.keys(pruned).length !== Object.keys(byPath).length) {
        await persistMusicResourcePackState();
      }
    }
  } catch (error) {
    logSwallowedError("musicResourcePackState.hydrateMusicResourcePackStateInternal", error);
    state = { version: "", store: null, byPath: {} };
  } finally {
    hydrated = true;
  }
}

export async function isMusicAssetLocal(assetPath: string): Promise<boolean> {
  const key = normalizeMusicAssetPath(assetPath);
  if (!key) return false;
  const uri = state.byPath[key]?.trim();
  if (!uri) return false;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return Boolean(info.exists);
  } catch {
    return false;
  }
}

export function getMusicResourcePackState(): MusicPackState {
  return state;
}

export function setMusicResourcePackState(next: MusicPackState) {
  state = next;
}

export function getMusicResourcePackSyncing(): boolean {
  return syncing;
}

export function setMusicResourcePackSyncing(value: boolean) {
  syncing = value;
}

export function getMusicResourcePackSyncPromise(): Promise<boolean> | null {
  return syncPromise;
}

export function setMusicResourcePackSyncPromise(promise: Promise<boolean> | null) {
  syncPromise = promise;
}

export function subscribeMusicResourcePackChange(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function isValidMusicPackManifest(raw: unknown): raw is MusicPackManifest {
  if (!raw || typeof raw !== "object") return false;
  const obj = raw as Partial<MusicPackManifest>;
  if (obj.packType !== "music") return false;
  if (typeof obj.packVersion !== "string" || !obj.packVersion.trim()) return false;
  if (!Array.isArray(obj.assets)) return false;
  return true;
}

export function shouldUpdateMusicPackFromManifest(manifest: MusicPackManifest): boolean {
  if (state.version !== manifest.packVersion) return true;
  if (Object.keys(state.byPath).length === 0) return true;
  return false;
}

/** 比对 manifest：版本变更、尚无缓存、或仍有曲目/分析文件未落盘时需同步。 */
export async function shouldSyncMusicResourcePack(manifest: MusicPackManifest): Promise<boolean> {
  if (shouldUpdateMusicPackFromManifest(manifest)) return true;
  for (const asset of manifest.assets) {
    const key = normalizeMusicAssetPath(asset.path);
    if (!key) continue;
    if (!(await isMusicAssetLocal(key))) return true;
  }
  return false;
}

export async function ensureMusicPackParentDir(fileUri: string) {
  const lastSlash = fileUri.lastIndexOf("/");
  const dir = lastSlash > 0 ? fileUri.slice(0, lastSlash) : MUSIC_RESOURCE_PACK_CURRENT_DIR;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
}

export function deleteMusicResourcePackPath(key: string) {
  delete state.byPath[key];
}

export function setMusicResourcePackPath(key: string, uri: string) {
  state.byPath[key] = uri;
}

export function setMusicResourcePackStore(store: MusicCompanionStore | null) {
  state.store = store;
}
