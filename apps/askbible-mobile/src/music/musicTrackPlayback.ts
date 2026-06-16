import type { AVPlaybackSource } from "expo-av";
import { Asset } from "expo-asset";
import { Platform } from "react-native";

/** 壳层音乐：APK 内优先 `require()` 模块，避免 Android 上 Asset.uri 无法播放 */
export type MusicTrackPlayback = {
  src: string;
  bundledModule?: number;
};

const bundledModuleUriCache = new Map<number, string>();

function isLocalDevHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  if (!h) return true;
  if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) return true;
  if (h.startsWith("10.") || h.startsWith("192.168.")) return true;
  const m = h.match(/^172\.(\d+)\./);
  if (m) {
    const octet = Number(m[1]);
    if (Number.isFinite(octet) && octet >= 16 && octet <= 31) return true;
  }
  return false;
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
      bundledModuleUriCache.set(bundledModule, localUri);
      return localUri;
    }
  } catch {
    /* ignore warm failures */
  }
  return null;
}

/** 实际创建 Sound 前的播放源：Android bundled 走缓存 URI，其余与 {@link musicTrackAvSource} 一致。 */
export async function resolveMusicTrackAvSourceForPlay(
  track: MusicTrackPlayback | null,
): Promise<AVPlaybackSource | null> {
  const base = musicTrackAvSource(track);
  if (!track || base == null) return null;
  if (Platform.OS !== "android" || track.bundledModule == null) return base;
  const localUri = await warmBundledModuleUri(track.bundledModule);
  return localUri ? { uri: localUri } : base;
}
