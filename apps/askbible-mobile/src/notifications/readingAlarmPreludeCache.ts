import * as FileSystem from "expo-file-system/legacy";
import { warmBundledModuleUri } from "../music/musicTrackPlayback";
import {
  listLocalPlayableTrackIndicesInAlbum,
  pickRandomLocalPlayableTrackIndexInAlbum,
} from "../music/musicStoreHelpers";
import type { PlaybackTrack } from "../music/types";

const PRELUDE_FILENAME = "reading_alarm_prelude.mp3";
/** 与 Android/iOS 原生 `reading-alarm-prelude-pool` 目录一致。 */
export const READING_ALARM_PRELUDE_POOL_DIR = "reading-alarm-prelude-pool";

export function readingAlarmPreludePoolDirUri(): string | null {
  const doc = FileSystem.documentDirectory;
  if (!doc) return null;
  return `${doc}${READING_ALARM_PRELUDE_POOL_DIR}/`;
}

export function readingAlarmPreludeDestUri(): string | null {
  const doc = FileSystem.documentDirectory;
  if (!doc) return null;
  return `${doc}${PRELUDE_FILENAME}`;
}

async function resolveCopyableTrackUri(track: PlaybackTrack): Promise<string | null> {
  if (track.bundledModule != null) {
    return warmBundledModuleUri(track.bundledModule);
  }
  const src = track.src?.trim() ?? "";
  if (!src) return null;
  if (src.startsWith("file://") || src.startsWith("/")) return src;
  return null;
}

async function copyTrackToPool(track: PlaybackTrack, poolDir: string): Promise<boolean> {
  const sourceUri = await resolveCopyableTrackUri(track);
  if (!sourceUri) return false;
  const dest = `${poolDir}${track.id}.mp3`;
  try {
    await FileSystem.copyAsync({ from: sourceUri, to: dest });
    return true;
  } catch {
    return false;
  }
}

/** 同步「安静」专辑本地可播曲目到预备音乐池；原生闹钟每次从此目录随机选曲。 */
export async function warmReadingAlarmPreludePool(tracks: readonly PlaybackTrack[]): Promise<void> {
  const poolDir = readingAlarmPreludePoolDirUri();
  if (!poolDir || tracks.length === 0) return;

  await FileSystem.makeDirectoryAsync(poolDir, { intermediates: true }).catch(() => {});

  const localIndices = listLocalPlayableTrackIndicesInAlbum(tracks);
  const keepIds = new Set<string>();
  for (const index of localIndices) {
    const track = tracks[index];
    if (!track) continue;
    if (await copyTrackToPool(track, poolDir)) {
      keepIds.add(track.id);
    }
  }

  const existing = await FileSystem.readDirectoryAsync(poolDir).catch(() => [] as string[]);
  for (const name of existing) {
    if (!name.endsWith(".mp3")) continue;
    const id = name.slice(0, -4);
    if (!keepIds.has(id)) {
      await FileSystem.deleteAsync(`${poolDir}${name}`, { idempotent: true }).catch(() => {});
    }
  }
}

/** 将「安静」专辑随机本地曲目写入 legacy 单文件缓存（JS 回退路径）。 */
export async function refreshReadingAlarmPreludeCache(tracks: readonly PlaybackTrack[]): Promise<void> {
  const dest = readingAlarmPreludeDestUri();
  if (!dest || tracks.length === 0) return;

  const index = pickRandomLocalPlayableTrackIndexInAlbum(tracks);
  const track = tracks[index];
  if (!track) return;

  const sourceUri = await resolveCopyableTrackUri(track);
  if (!sourceUri) return;

  try {
    await FileSystem.copyAsync({ from: sourceUri, to: dest });
  } catch {
    /* 保留已有缓存或 APK raw 回退 */
  }
}

/** @deprecated use {@link warmReadingAlarmPreludePool} */
export async function warmReadingAlarmPreludeCache(tracks: readonly PlaybackTrack[]): Promise<void> {
  await warmReadingAlarmPreludePool(tracks);
  await refreshReadingAlarmPreludeCache(tracks);
}
