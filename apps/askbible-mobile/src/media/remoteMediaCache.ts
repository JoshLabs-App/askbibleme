import * as FileSystem from "expo-file-system/legacy";
import { logSwallowedError } from "../debug/logSwallowedError";

/**
 * 通用「R2 点播 + 边播边缓存到本机」工具，抽自 `musicR2StreamCache.ts` 的既有实现
 * （那份保持不动，继续单独维护，避免动到已经在线上跑的音乐播放路径）。
 * 自然场景音效 / 自然视频这类「新搬去 R2」的媒体共用这份，别再各写一份一样的缓存逻辑。
 */
export type RemoteMediaCache = {
  /** 已缓存的本地 file://；未命中返回 null（会真的去查磁盘）。 */
  resolveCachedUri(key: string): Promise<string | null>;
  /** 同步 peek：仅当此前 resolve/download 过并写入内存时可用。 */
  peekCachedUri(key: string): string | null;
  rememberCachedUri(key: string, localUri: string): void;
  /** 播放器实际装载某个 URI 时调用；清理时会跳过它，避免删到正在播的文件。 */
  markActiveUri(uri: string | null | undefined): void;
  /** 边播边存：从远端拉到 DocumentDirectory；已存在则直接返回，不重复下载。 */
  downloadToCache(key: string, remoteUrl: string): Promise<string | null>;
};

export function createRemoteMediaCache(opts: {
  /** DocumentDirectory 下的子目录名，如 "nature-video-r2-cache"。 */
  cacheDirName: string;
  /** 磁盘上限；超出后按最旧修改时间删，跳过正在播放的文件。 */
  maxBytes: number;
  /** 允许写入缓存的扩展名（含点），过滤掉临时/无关文件。 */
  extensions: string[];
}): RemoteMediaCache {
  const CACHE_ROOT = `${FileSystem.documentDirectory}${opts.cacheDirName}`;
  const memoryHit = new Map<string, string>();
  let activePlayingUri: string | null = null;

  function cacheFileUri(key: string): string {
    return `${CACHE_ROOT}/${key}`;
  }

  async function ensureParentDir(fileUri: string): Promise<void> {
    const parent = fileUri.replace(/\/[^/]+$/, "");
    await FileSystem.makeDirectoryAsync(parent, { intermediates: true });
  }

  type CacheFileEntry = { uri: string; key: string; size: number; mtime: number };

  async function listCacheFiles(): Promise<CacheFileEntry[]> {
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
          if (!opts.extensions.some((ext) => name.endsWith(ext))) continue;
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

  async function pruneIfNeeded(keepUri?: string): Promise<void> {
    try {
      const files = await listCacheFiles();
      let total = files.reduce((sum, f) => sum + Math.max(0, f.size), 0);
      if (total <= opts.maxBytes) return;
      files.sort((a, b) => a.mtime - b.mtime);
      for (const file of files) {
        if (total <= opts.maxBytes) break;
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
      logSwallowedError(`remoteMediaCache[${opts.cacheDirName}].pruneIfNeeded`, error);
    }
  }

  return {
    async resolveCachedUri(key) {
      const uri = cacheFileUri(key);
      try {
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists || typeof info.size !== "number" || info.size <= 0) return null;
        return uri;
      } catch {
        return null;
      }
    },
    peekCachedUri(key) {
      return memoryHit.get(key) ?? null;
    },
    rememberCachedUri(key, localUri) {
      if (!key || !localUri) return;
      memoryHit.set(key, localUri);
    },
    markActiveUri(uri) {
      activePlayingUri = uri || null;
    },
    async downloadToCache(key, remoteUrl) {
      if (!key || !remoteUrl) return null;
      const existing = await this.resolveCachedUri(key);
      if (existing) {
        this.rememberCachedUri(key, existing);
        return existing;
      }
      const target = cacheFileUri(key);
      const tmp = `${target}.download`;
      try {
        await ensureParentDir(target);
        await FileSystem.deleteAsync(tmp, { idempotent: true });
        const result = await FileSystem.downloadAsync(remoteUrl, tmp);
        if (!result?.uri || result.status < 200 || result.status >= 300) return null;
        const info = await FileSystem.getInfoAsync(tmp);
        if (!info.exists || typeof info.size !== "number" || info.size <= 0) return null;
        await FileSystem.deleteAsync(target, { idempotent: true });
        await FileSystem.moveAsync({ from: tmp, to: target });
        this.rememberCachedUri(key, target);
        void pruneIfNeeded(target);
        return target;
      } catch (error) {
        logSwallowedError(`remoteMediaCache[${opts.cacheDirName}].downloadToCache`, error);
        try {
          await FileSystem.deleteAsync(tmp, { idempotent: true });
        } catch {
          /* ignore */
        }
        return null;
      }
    },
  };
}
