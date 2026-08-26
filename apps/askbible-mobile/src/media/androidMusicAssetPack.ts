import { NativeModules, Platform } from "react-native";
import {
  ANDROID_MUSIC_PAD_PACK_NAME,
  ANDROID_MUSIC_PAD_TRACK_FILES,
} from "./generated/bundled-music-pad-manifest";

type PackStatus = {
  status: string;
  bytesDownloaded: number;
  totalBytes: number;
  packName: string;
};

type NativePad = {
  getPackStatus: () => Promise<PackStatus>;
  ensurePack: () => Promise<PackStatus>;
  getTrackFileUri: (relativePath: string) => Promise<string | null>;
};

const native: NativePad | null =
  Platform.OS === "android"
    ? (NativeModules.AskBibleMusicAssetPack as NativePad | undefined) ?? null
    : null;

const uriCache = new Map<string, string>();

export function isAndroidMusicPadEnabled(): boolean {
  return (
    Platform.OS === "android" &&
    native != null &&
    Object.keys(ANDROID_MUSIC_PAD_TRACK_FILES).length > 0
  );
}

export function androidMusicPadTrackCount(): number {
  return Object.keys(ANDROID_MUSIC_PAD_TRACK_FILES).length;
}

export function androidMusicPadPackName(): string {
  return ANDROID_MUSIC_PAD_PACK_NAME;
}

/** 冷启动 / 进音乐页：续下或确认 fast-follow pack。 */
export async function ensureAndroidMusicAssetPack(): Promise<PackStatus | null> {
  if (!isAndroidMusicPadEnabled() || !native) return null;
  try {
    // 非 Play 安装时 fetch 可能永不完成；勿阻塞 bootstrap
    return await Promise.race([
      native.ensurePack(),
      new Promise<PackStatus>((resolve) =>
        setTimeout(
          () =>
            resolve({
              status: "timeout",
              bytesDownloaded: 0,
              totalBytes: 0,
              packName: ANDROID_MUSIC_PAD_PACK_NAME,
            }),
          12_000,
        ),
      ),
    ]);
  } catch {
    try {
      return await native.getPackStatus();
    } catch {
      return null;
    }
  }
}

/** trackId → file://；pack 未就绪则 null。 */
export async function resolveAndroidMusicPadTrackUri(trackId: string): Promise<string | null> {
  if (!isAndroidMusicPadEnabled() || !native) return null;
  const id = trackId.trim();
  const rel = ANDROID_MUSIC_PAD_TRACK_FILES[id];
  if (!rel) return null;
  const cached = uriCache.get(id);
  if (cached) return cached;
  try {
    const uri = await native.getTrackFileUri(rel);
    if (uri?.startsWith("file://")) {
      uriCache.set(id, uri);
      return uri;
    }
  } catch {
    /* pack not ready */
  }
  return null;
}

/** 同步探测：仅用缓存（列表渲染勿 await 全表）。 */
export function peekAndroidMusicPadTrackUri(trackId: string): string | null {
  return uriCache.get(trackId.trim()) ?? null;
}

/** ensure pack + 把已落地曲目 URI 填进缓存，供 enrich / peek 使用。 */
export async function warmAndroidMusicPadTrackUris(): Promise<number> {
  if (!isAndroidMusicPadEnabled() || !native) return 0;
  await ensureAndroidMusicAssetPack();
  let ready = 0;
  for (const id of Object.keys(ANDROID_MUSIC_PAD_TRACK_FILES)) {
    const uri = await resolveAndroidMusicPadTrackUri(id);
    if (uri) ready += 1;
  }
  return ready;
}
