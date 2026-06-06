import type { AVPlaybackSource } from "expo-av";
import { Platform } from "react-native";

/** 壳层音乐：APK 内优先 `require()` 模块，避免 Android 上 Asset.uri 无法播放 */
export type MusicTrackPlayback = {
  src: string;
  bundledModule?: number;
};

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
