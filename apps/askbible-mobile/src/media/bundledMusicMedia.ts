import type { MusicTrackPlayback } from "../music/musicTrackPlayback";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { peekAndroidMusicPadTrackUri } from "./androidMusicAssetPack";
import { getBundledMusicAnalysis } from "./generated/bundled-music-analysis";
import { ANDROID_MUSIC_PAD_TRACK_FILES } from "./generated/bundled-music-pad-manifest";
import {
  getBundledMusicTrackModule,
  resolveBundledMusicTrackUri,
} from "./generated/bundled-music-tracks";
import {
  buildMusicAudioRemoteUrl,
  isHymnCommonsDirectAudioUrl,
  isMusicAudioRemoteStreamEnabled,
} from "./musicAudioRemote";
import { peekMusicR2CachedUri } from "./musicR2StreamCache";
import { resolveMusicResourcePackUri } from "./musicResourcePackSync";

/** useTrackAnalysis 识别的离线分析 JSON 句柄（非 HTTP URL）。 */
export const BUNDLED_MUSIC_ANALYSIS_PREFIX = "bundled-music-analysis:";

export type MusicTrackPlaybackResolved = MusicTrackPlayback & {
  /** 安装包内或已下载到 DocumentDirectory */
  localReady: boolean;
};

/**
 * 音乐播放源：
 * 安装包 → Android PAD → R2 本地缓存 → 旧 resource-pack → R2 HTTPS（TEMPORARY）→ 线上流式（非 bundled-only）。
 */
export function resolveMusicTrackPlayback(
  trackId: string,
  catalogSrc: string,
): MusicTrackPlaybackResolved {
  const id = trackId.trim();
  const bundledModule = id ? (getBundledMusicTrackModule(id) ?? undefined) : undefined;
  if (bundledModule != null) {
    return {
      src: resolveBundledMusicTrackUri(id) ?? "",
      bundledModule,
      localReady: true,
    };
  }
  const padUri = peekAndroidMusicPadTrackUri(id);
  if (padUri) {
    return { src: padUri, localReady: true };
  }
  // PAD 清单里有、尚未缓存 URI：标未就绪（勿当流式）
  if (ANDROID_MUSIC_PAD_TRACK_FILES[id]) {
    return { src: "", localReady: false };
  }
  const r2Cached = peekMusicR2CachedUri(catalogSrc);
  if (r2Cached) {
    return { src: r2Cached, localReady: true };
  }
  const synced = resolveMusicResourcePackUri(catalogSrc);
  if (synced) {
    return { src: synced, localReady: true };
  }
  const r2Stream = buildMusicAudioRemoteUrl(catalogSrc);
  if (r2Stream) {
    return { src: r2Stream, localReady: false };
  }
  const stream = catalogSrc.trim();
  if (isHymnCommonsDirectAudioUrl(stream)) {
    return { src: stream, localReady: false };
  }
  if (stream && !isMobileBundledOnly()) {
    return { src: stream, localReady: false };
  }
  return { src: "", localReady: false };
}

export function resolveMusicTrackPlaybackUri(trackId: string, remoteAbsolute: string): string {
  return resolveMusicTrackPlayback(trackId, remoteAbsolute).src;
}

export function resolveMusicAnalysisPlaybackUri(trackId: string, remoteAbsolute: string): string | null {
  const synced = resolveMusicResourcePackUri(remoteAbsolute);
  if (synced) return synced;
  if (!trackId.trim()) return null;
  const id = trackId.trim();
  if (getBundledMusicAnalysis(id)) return `${BUNDLED_MUSIC_ANALYSIS_PREFIX}${id}`;
  return null;
}

export function musicTrackHasRemoteR2Fallback(catalogSrc: string): boolean {
  if (!isMusicAudioRemoteStreamEnabled()) return false;
  if (isHymnCommonsDirectAudioUrl(catalogSrc)) return true;
  return Boolean(buildMusicAudioRemoteUrl(catalogSrc));
}
