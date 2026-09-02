import * as FileSystem from "expo-file-system/legacy";
import { logSwallowedError } from "../debug/logSwallowedError";
import {
  buildMusicAudioRemoteUrl,
  normalizeMusicAudioObjectKey,
} from "./musicAudioRemote";

/** 音乐 R2 点播缓存：与 askbible.me resource-pack 目录分离。 */
const CACHE_ROOT = `${FileSystem.documentDirectory}music-r2-cache`;
/** 磁盘上限约 400MB；超出后按最旧修改时间删。 */
const MAX_CACHE_BYTES = 400 * 1024 * 1024;

function cacheFileUri(objectKey: string): string {
  return `${CACHE_ROOT}/${objectKey}`;
}

async function ensureParentDir(fileUri: string): Promise<void> {
  const parent = fileUri.replace(/\/[^/]+$/, "");
  await FileSystem.makeDirectoryAsync(parent, { intermediates: true });
}

type CacheFileEntry = { uri: string; key: string; size: number; mtime: number };

async function listCacheAudioFiles(): Promise<CacheFileEntry[]> {
  const out: CacheFileEntry[] = [];
  const walk = async (rel: string) => {
    const dir = rel ? `${CACHE_ROOT}/${rel}` : CACHE_ROOT;
    let names: string[];
    try {
      names = await FileSystem.readDirectoryAsync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      if (name.endsWith(".download")) continue;
      const childRel = rel ? `${rel}/${name}` : name;
      const uri = `${CACHE_ROOT}/${childRel}`;
      try {
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists) continue;
        if (info.isDirectory) {
          await walk(childRel);
          continue;
        }
        if (!name.endsWith(".mp3") && !name.endsWith(".m4a")) continue;
        const size = typeof info.size === "number" ? info.size : 0;
        const mtime =
          "modificationTime" in info && typeof info.modificationTime === "number"
            ? info.modificationTime
            : 0;
        out.push({ uri, key: childRel, size, mtime });
      } catch {
        /* ignore */
      }
    }
  };
  await walk("");
  return out;
}

const memoryHit = new Map<string, string>();

/** 当前正在播放的本地缓存 URI；清理时须跳过，避免删到播放器正读取的文件。 */
let activePlayingUri: string | null = null;

/** 播放器在装载一个曲目的最终 src 时调用；与缓存目录无关的 URI 传入也无副作用。 */
export function markMusicR2CacheActiveUri(uri: string | null | undefined): void {
  activePlayingUri = uri || null;
}

async function pruneMusicR2CacheIfNeeded(keepUri?: string): Promise<void> {
  try {
    const files = await listCacheAudioFiles();
    let total = files.reduce((sum, f) => sum + Math.max(0, f.size), 0);
    if (total <= MAX_CACHE_BYTES) return;
    files.sort((a, b) => a.mtime - b.mtime);
    for (const file of files) {
      if (total <= MAX_CACHE_BYTES) break;
      if (keepUri && file.uri === keepUri) continue;
      if (activePlayingUri && file.uri === activePlayingUri) continue;
      try {
        await FileSystem.deleteAsync(file.uri, { idempotent: true });
        memoryHit.delete(file.key);
        total -= Math.max(0, file.size);
      } catch {
        /* ignore */
      }
    }
  } catch (error) {
    logSwallowedError("musicR2StreamCache.pruneMusicR2CacheIfNeeded", error);
  }
}

/** 已缓存的本地 file://；未命中返回 null。 */
export async function resolveMusicR2CachedUri(pathOrUrl: string): Promise<string | null> {
  const key = normalizeMusicAudioObjectKey(pathOrUrl);
  if (!key) return null;
  const uri = cacheFileUri(key);
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists || typeof info.size !== "number" || info.size <= 0) return null;
    return uri;
  } catch {
    return null;
  }
}

/** 同步 peek：仅当此前已 resolve 过并写入内存时可用；否则走 async。 */
export function peekMusicR2CachedUri(pathOrUrl: string): string | null {
  const key = normalizeMusicAudioObjectKey(pathOrUrl);
  if (!key) return null;
  return memoryHit.get(key) ?? null;
}

export function rememberMusicR2CachedUri(pathOrUrl: string, localUri: string): void {
  const key = normalizeMusicAudioObjectKey(pathOrUrl);
  if (!key || !localUri) return;
  memoryHit.set(key, localUri);
}

/** 边播边存：从 R2 拉到 DocumentDirectory；已存在则直接返回。 */
export async function downloadMusicAudioToR2Cache(pathOrUrl: string): Promise<string | null> {
  const key = normalizeMusicAudioObjectKey(pathOrUrl);
  if (!key) return null;
  const existing = await resolveMusicR2CachedUri(pathOrUrl);
  if (existing) {
    rememberMusicR2CachedUri(pathOrUrl, existing);
    return existing;
  }
  const remote = buildMusicAudioRemoteUrl(pathOrUrl);
  if (!remote) return null;

  const target = cacheFileUri(key);
  const tmp = `${target}.download`;
  try {
    await ensureParentDir(target);
    await FileSystem.deleteAsync(tmp, { idempotent: true });
    const result = await FileSystem.downloadAsync(remote, tmp);
    if (!result?.uri || result.status < 200 || result.status >= 300) return null;
    const info = await FileSystem.getInfoAsync(tmp);
    if (!info.exists || typeof info.size !== "number" || info.size <= 0) return null;
    await FileSystem.deleteAsync(target, { idempotent: true });
    await FileSystem.moveAsync({ from: tmp, to: target });
    rememberMusicR2CachedUri(pathOrUrl, target);
    await pruneMusicR2CacheIfNeeded(target);
    return target;
  } catch (error) {
    logSwallowedError("musicR2StreamCache.downloadMusicAudioToR2Cache", error);
    try {
      await FileSystem.deleteAsync(tmp, { idempotent: true });
    } catch {
      /* ignore */
    }
    return null;
  }
}

/** 启动时扫已有缓存进内存，供 resolve 同步命中。 */
export async function hydrateMusicR2CacheIndex(): Promise<void> {
  try {
    const rootInfo = await FileSystem.getInfoAsync(CACHE_ROOT);
    if (!rootInfo.exists) return;
    const files = await listCacheAudioFiles();
    for (const file of files) {
      memoryHit.set(file.key, file.uri);
    }
    await pruneMusicR2CacheIfNeeded();
  } catch (error) {
    logSwallowedError("musicR2StreamCache.hydrateMusicR2CacheIndex", error);
  }
}
