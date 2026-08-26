import * as FileSystem from "expo-file-system/legacy";
import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import { chapterAudioPackageKey } from "./readAudioPackageDownloadPaths";

/** 今日读经 / 边播边存：与完整「语音包」目录分离，到期可清。 */
const STREAM_CACHE_ROOT = `${FileSystem.documentDirectory}read-chapter-audio-cache`;
const ACCESS_INDEX_URI = `${STREAM_CACHE_ROOT}/access-index-v1.json`;
/** 自最近访问起保留天数 */
export const CHAPTER_AUDIO_STREAM_CACHE_RETENTION_DAYS = 10;
const RETENTION_MS = CHAPTER_AUDIO_STREAM_CACHE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

type AccessIndex = Record<string, number>;

let purgeInFlight: Promise<void> | null = null;
let accessIndexMemory: AccessIndex | null = null;

function streamCacheRelKey(packageKey: string, bookId: string, chapter: number): string {
  return `${packageKey}/${bookId.toUpperCase()}-${chapter}.mp3`;
}

export function chapterStreamCacheFileUri(
  packageKey: string,
  bookId: string,
  chapter: number,
): string {
  return `${STREAM_CACHE_ROOT}/${streamCacheRelKey(packageKey, bookId, chapter)}`;
}

async function ensureStreamCacheRoot(): Promise<void> {
  await FileSystem.makeDirectoryAsync(STREAM_CACHE_ROOT, { intermediates: true });
}

async function readAccessIndex(): Promise<AccessIndex> {
  if (accessIndexMemory) return accessIndexMemory;
  try {
    const raw = await FileSystem.readAsStringAsync(ACCESS_INDEX_URI);
    const parsed = JSON.parse(raw) as AccessIndex;
    accessIndexMemory = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    accessIndexMemory = {};
  }
  return accessIndexMemory;
}

async function writeAccessIndex(next: AccessIndex): Promise<void> {
  accessIndexMemory = next;
  try {
    await ensureStreamCacheRoot();
    await FileSystem.writeAsStringAsync(ACCESS_INDEX_URI, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

async function touchStreamCacheAccess(relKey: string): Promise<void> {
  const index = await readAccessIndex();
  index[relKey] = Date.now();
  await writeAccessIndex(index);
}

export async function resolveStreamCachedChapterAudioUri(args: {
  translationId: string;
  voiceId: CuvChapterAudioVoiceId;
  bookId: string;
  chapter: number;
}): Promise<string | null> {
  const packageKey = chapterAudioPackageKey({
    translationId: args.translationId,
    voiceId: args.voiceId,
  });
  const relKey = streamCacheRelKey(packageKey, args.bookId, args.chapter);
  const uri = chapterStreamCacheFileUri(packageKey, args.bookId, args.chapter);
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists || typeof info.size !== "number" || info.size <= 0) return null;
    void touchStreamCacheAccess(relKey);
    return uri;
  } catch {
    return null;
  }
}

export async function ensureStreamCachePackageDir(packageKey: string): Promise<void> {
  await FileSystem.makeDirectoryAsync(`${STREAM_CACHE_ROOT}/${packageKey}`, {
    intermediates: true,
  });
}

/** 下载到流式缓存目录，并记录访问时间。 */
export async function downloadChapterAudioToStreamCache(args: {
  translationId: string;
  voiceId: CuvChapterAudioVoiceId;
  bookId: string;
  chapter: number;
  remoteSrc: string;
  candidateUrls: string[];
}): Promise<string | null> {
  const remote = args.remoteSrc.trim();
  if (!remote || !/^https?:\/\//i.test(remote)) return null;

  const packageKey = chapterAudioPackageKey({
    translationId: args.translationId,
    voiceId: args.voiceId,
  });
  const relKey = streamCacheRelKey(packageKey, args.bookId, args.chapter);
  const target = chapterStreamCacheFileUri(packageKey, args.bookId, args.chapter);
  const existing = await resolveStreamCachedChapterAudioUri(args);
  if (existing) return existing;

  await ensureStreamCachePackageDir(packageKey);
  const tmp = `${target}.download`;
  const urls = [remote, ...args.candidateUrls.filter((u) => u.trim() && u !== remote)];

  for (const url of urls) {
    try {
      await FileSystem.deleteAsync(tmp, { idempotent: true });
      const result = await FileSystem.downloadAsync(url, tmp);
      if (!result?.uri || result.status < 200 || result.status >= 300) continue;
      const info = await FileSystem.getInfoAsync(tmp);
      if (!info.exists || typeof info.size !== "number" || info.size <= 0) continue;
      await FileSystem.deleteAsync(target, { idempotent: true });
      await FileSystem.moveAsync({ from: tmp, to: target });
      await touchStreamCacheAccess(relKey);
      return target;
    } catch {
      /* try next */
    }
  }
  return null;
}

/** 删除超过保留期（默认 10 天未访问）的流式章音频。 */
export async function purgeExpiredChapterAudioStreamCache(): Promise<void> {
  if (purgeInFlight) return purgeInFlight;
  purgeInFlight = (async () => {
    try {
      await ensureStreamCacheRoot();
      const index = await readAccessIndex();
      const cutoff = Date.now() - RETENTION_MS;
      const next: AccessIndex = {};
      let changed = false;

      for (const [relKey, lastAccess] of Object.entries(index)) {
        const ts = typeof lastAccess === "number" ? lastAccess : 0;
        if (ts >= cutoff) {
          next[relKey] = ts;
          continue;
        }
        changed = true;
        try {
          await FileSystem.deleteAsync(`${STREAM_CACHE_ROOT}/${relKey}`, { idempotent: true });
        } catch {
          /* ignore */
        }
      }

      // 扫目录：无索引的旧文件按 modificationTime 清理
      try {
        const packageDirs = await FileSystem.readDirectoryAsync(STREAM_CACHE_ROOT);
        for (const name of packageDirs) {
          if (name.endsWith(".json")) continue;
          const dir = `${STREAM_CACHE_ROOT}/${name}`;
          const dirInfo = await FileSystem.getInfoAsync(dir);
          if (!dirInfo.exists || !dirInfo.isDirectory) continue;
          const files = await FileSystem.readDirectoryAsync(dir);
          for (const file of files) {
            if (!file.endsWith(".mp3")) continue;
            const relKey = `${name}/${file}`;
            if (next[relKey] != null) continue;
            const uri = `${dir}/${file}`;
            const info = await FileSystem.getInfoAsync(uri);
            const mod =
              info.exists && "modificationTime" in info && typeof info.modificationTime === "number"
                ? info.modificationTime * (info.modificationTime < 1e12 ? 1000 : 1)
                : 0;
            if (mod > 0 && mod >= cutoff) {
              next[relKey] = mod;
              changed = true;
              continue;
            }
            changed = true;
            try {
              await FileSystem.deleteAsync(uri, { idempotent: true });
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        /* ignore scan errors */
      }

      if (changed || Object.keys(index).length !== Object.keys(next).length) {
        await writeAccessIndex(next);
      }
    } finally {
      purgeInFlight = null;
    }
  })();
  return purgeInFlight;
}
