import type { AudioSource } from "expo-audio";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { Image, Platform } from "react-native";
import { normalizeShellMusicFileUri } from "../audio/shellMusicPlayableAssetUri";
import { isIosSimulator, isLocalDevHost } from "../config/askbibleBaseUrl";
import { normalizeMusicAlbumLabel } from "./musicAlbumCatalog";
import { isTrackPlayable } from "./trackArtwork";
import type { PlaybackTrack } from "./types";

/** 壳层音乐：APK 内优先 `require()` 模块，避免 Android 上 Asset.uri 无法播放 */
export type MusicTrackPlayback = {
  src: string;
  bundledModule?: number;
};

const bundledModuleUriCache = new Map<number, string>();
const bundledModuleUriInFlightCache = new Map<number, Promise<string | null>>();
const IOS_SIM_BUNDLED_MUSIC_CACHE = `${FileSystem.cacheDirectory ?? ""}askbible-bundled-music/`;

/** ExoPlayer 不能当文件打开的 Expo 虚拟路径（会 ENOENT）。 */
function isAndroidResVirtualUri(uri: string): boolean {
  const u = uri.trim();
  return (
    u.includes("android_res/") ||
    u.includes("android_asset/") ||
    u.startsWith("/android_res") ||
    u.startsWith("/android_asset")
  );
}

function isHttpUri(uri: string): boolean {
  return /^https?:\/\//i.test(uri.trim());
}

function isUsableBundledFileUri(uri: string): boolean {
  const u = uri.trim();
  if (!u) return false;
  if (isAndroidResVirtualUri(u)) return false;
  // iOS 原生 AVPlayer 只要本地 file；Metro http 会空转无声。
  if (isHttpUri(u)) return false;
  return true;
}

/**
 * 安卓 release：`require(mp3)` 解析成 raw 资源名（无 scheme）。
 * ExoPlayer 对「无 scheme URI」走 RawResourceDataSource；`file:///android_res/...` 会 ENOENT。
 */
function androidRawResourceName(bundledModule: number): string | null {
  try {
    const resolved = Image.resolveAssetSource(bundledModule);
    const uri = (resolved?.uri || "").trim();
    if (!uri) return null;
    const fromVirtual = uri.match(/(?:^|\/)android_res\/raw\/([^/.]+)/i);
    if (fromVirtual?.[1]) return fromVirtual[1];
    // 形如 assets_audio_scenes_scenewavesocean
    if (!uri.includes("://") && !uri.startsWith("/") && !uri.includes("/")) {
      return uri.replace(/\.(mp3|m4a|wav|ogg)$/i, "");
    }
  } catch {
    /* ignore */
  }
  return null;
}

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

export function musicTrackAvSource(track: MusicTrackPlayback | null): AudioSource | null {
  if (!track) return null;
  if (track.bundledModule != null) return track.bundledModule;
  const normalizedUri = normalizeIosHttpUri(track.src.trim());
  return normalizedUri ? { uri: normalizedUri } : null;
}

/** 同步读取 warm 缓存（供 Android 封面视频等避免再次 Asset.fromModule 冲掉 localUri）。 */
export function getCachedBundledModuleUri(bundledModule: number): string | null {
  return bundledModuleUriCache.get(bundledModule) ?? null;
}

/** Android：预热并缓存 bundled 模块对应的本地 file URI，避免每次播放重复 Asset.loadAsync。 */
export async function warmBundledModuleUri(bundledModule: number): Promise<string | null> {
  const cached = bundledModuleUriCache.get(bundledModule);
  if (cached && !isHttpUri(cached)) return cached;
  if (cached) bundledModuleUriCache.delete(bundledModule);
  const inFlight = bundledModuleUriInFlightCache.get(bundledModule);
  if (inFlight) return inFlight;

  const loadPromise = (async () => {
    try {
      const [asset] = await Asset.loadAsync(bundledModule);
      if (asset && !asset.downloaded) {
        await asset.downloadAsync();
      }
      // 优先真实解压路径；勿把 /android_res/raw/... 交给 ExoPlayer FileDataSource
      const localUri = (asset?.localUri || "").trim();
      const fallbackUri = (asset?.uri || "").trim();
      const candidate = isUsableBundledFileUri(localUri)
        ? localUri
        : isUsableBundledFileUri(fallbackUri)
          ? fallbackUri
          : "";
      const httpSource = isHttpUri(localUri) ? localUri : isHttpUri(fallbackUri) ? fallbackUri : "";
      const copySource = candidate || httpSource;
      if (copySource && Platform.OS === "ios" && isIosSimulator() && IOS_SIM_BUNDLED_MUSIC_CACHE) {
        try {
          await FileSystem.makeDirectoryAsync(IOS_SIM_BUNDLED_MUSIC_CACHE, { intermediates: true });
          const dest = `${IOS_SIM_BUNDLED_MUSIC_CACHE}${bundledModule}.mp3`;
          const info = await FileSystem.getInfoAsync(dest);
          if (!info.exists) {
            await FileSystem.copyAsync({ from: copySource, to: dest });
          }
          const normalized = normalizeShellMusicFileUri(dest);
          bundledModuleUriCache.set(bundledModule, normalized);
          // 勿写入 shellMusicPlayableAssetUri：本函数也被环境音/金句 gap 调用，
          // 写全局会污染音乐会话 assetUri（真机曾播成 scene- / verse-gap）。
          return normalized;
        } catch {
          /* fall through to local file URI */
        }
      }
      if (candidate) {
        const normalized = normalizeShellMusicFileUri(candidate);
        bundledModuleUriCache.set(bundledModule, normalized);
        return normalized;
      }
      // 安卓：download 失败或仅有虚拟路径时，回退 raw 资源名（无 scheme）
      if (Platform.OS === "android") {
        const rawName =
          androidRawResourceName(bundledModule) ||
          (isAndroidResVirtualUri(fallbackUri)
            ? fallbackUri.match(/android_res\/raw\/([^/.]+)/i)?.[1]
            : null) ||
          null;
        if (rawName) {
          bundledModuleUriCache.set(bundledModule, rawName);
          return rawName;
        }
      }
    } catch {
      if (Platform.OS === "android") {
        const rawName = androidRawResourceName(bundledModule);
        if (rawName) {
          bundledModuleUriCache.set(bundledModule, rawName);
          return rawName;
        }
      }
    } finally {
      bundledModuleUriInFlightCache.delete(bundledModule);
    }
    return null;
  })();

  bundledModuleUriInFlightCache.set(bundledModule, loadPromise);
  return loadPromise;
}

/** 实际创建 Sound 前的播放源：bundled 先预热为本地 file URI（iOS 模拟器上 require 模块常无声）。 */
export async function resolveMusicTrackAvSourceForPlay(
  track: MusicTrackPlayback | null,
): Promise<AudioSource | null> {
  const base = musicTrackAvSource(track);
  if (!track || base == null) return null;
  if (track.bundledModule != null) {
    const localUri = await warmBundledModuleUri(track.bundledModule);
    if (localUri) return { uri: localUri };
  }
  return base;
}

/** 当前曲目不可播时找下一首候选；只在同一专辑内回落，避免点下午茶却跳回安静。 */
export function findNextMusicTrackFallbackIndex(
  tracks: readonly PlaybackTrack[],
  skipIndex: number,
  failedIds: Set<string>,
  verifySource = false,
): number | null {
  const album = tracks[skipIndex]
    ? normalizeMusicAlbumLabel(tracks[skipIndex]!.album)
    : "";
  const tryPick = (wantLocal: boolean): number | null => {
    for (let k = 0; k < tracks.length; k += 1) {
      if (k === skipIndex) continue;
      const candidate = tracks[k];
      if (!candidate) continue;
      const tid = candidate.id.trim();
      if (!tid || failedIds.has(tid)) continue;
      if (album && normalizeMusicAlbumLabel(candidate.album) !== album) continue;
      if (wantLocal && !candidate.localReady) continue;
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
  };
  return tryPick(true) ?? tryPick(false);
}
