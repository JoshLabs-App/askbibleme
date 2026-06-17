import type { AVPlaybackSource } from "expo-av";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import { isIosSimulator, isLocalDevHost } from "../config/askbibleBaseUrl";
import { isTrackPlayable } from "./trackArtwork";
import type { PlaybackTrack } from "./types";

/** 壳层音乐：APK 内优先 `require()` 模块，避免 Android 上 Asset.uri 无法播放 */
export type MusicTrackPlayback = {
  src: string;
  bundledModule?: number;
};

const bundledModuleUriCache = new Map<number, string>();
const IOS_SIM_BUNDLED_MUSIC_CACHE = `${FileSystem.cacheDirectory ?? ""}askbible-bundled-music/`;

function normalizeIosHttpUri(uri: string): string {
  if (Platform.OS !== "ios") return uri;
  if (!/^http:\/\//i.test(uri)) return uri;
  try {
    const u = new URL(uri);
    if (isLocalDevHost(u.hostname)) return uri;
    u.protocol = "https:";
    return u.toString();
  } catch {
    return uri;
  }
}

export function musicTrackAvSource(track: MusicTrackPlayback | null): AVPlaybackSource | null {
  if (!track) return null;
  if (track.bundledModule != null) return track.bundledModule;
  const normalizedUri = normalizeIosHttpUri(track.src.trim());
  return normalizedUri ? { uri: normalizedUri } : null;
}

/** Android：预热并缓存 bundled 模块对应的本地 file URI，避免每次播放重复 Asset.loadAsync。 */
export async function warmBundledModuleUri(bundledModule: number): Promise<string | null> {
  const cached = bundledModuleUriCache.get(bundledModule);
  if (cached) return cached;
  try {
    const [asset] = await Asset.loadAsync(bundledModule);
    const localUri = (asset?.localUri || asset?.uri || "").trim();
    if (localUri) {
      if (Platform.OS === "ios" && isIosSimulator() && IOS_SIM_BUNDLED_MUSIC_CACHE) {
        try {
          await FileSystem.makeDirectoryAsync(IOS_SIM_BUNDLED_MUSIC_CACHE, { intermediates: true });
          const dest = `${IOS_SIM_BUNDLED_MUSIC_CACHE}${bundledModule}.mp3`;
          const info = await FileSystem.getInfoAsync(dest);
          if (!info.exists) {
            await FileSystem.copyAsync({ from: localUri, to: dest });
          }
          bundledModuleUriCache.set(bundledModule, dest);
          return dest;
        } catch {
          /* fall through to Asset localUri */
        }
      }
      bundledModuleUriCache.set(bundledModule, localUri);
      return localUri;
    }
  } catch {
    /* ignore warm failures */
  }
  return null;
}

/** 实际创建 Sound 前的播放源：bundled 先预热为本地 file URI（iOS 模拟器上 require 模块常无声）。 */
export async function resolveMusicTrackAvSourceForPlay(
  track: MusicTrackPlayback | null,
): Promise<AVPlaybackSource | null> {
  const base = musicTrackAvSource(track);
  if (!track || base == null) return null;
  if (track.bundledModule != null) {
    const localUri = await warmBundledModuleUri(track.bundledModule);
    if (localUri) return { uri: localUri };
  }
  return base;
}

/** 当前曲目不可播时找下一首候选；`verifySource` 会跳过无 AV 源的条目。 */
export function findNextMusicTrackFallbackIndex(
  tracks: readonly PlaybackTrack[],
  skipIndex: number,
  failedIds: Set<string>,
  verifySource = false,
): number | null {
  for (let k = 0; k < tracks.length; k += 1) {
    if (k === skipIndex) continue;
    const candidate = tracks[k];
    if (!candidate) continue;
    const tid = candidate.id.trim();
    if (!tid || failedIds.has(tid)) continue;
    if (verifySource) {
      if (!isTrackPlayable(candidate)) continue;
      if (musicTrackAvSource(candidate) == null) {
        failedIds.add(tid);
        continue;
      }
    }
    return k;
  }
  return null;
}
