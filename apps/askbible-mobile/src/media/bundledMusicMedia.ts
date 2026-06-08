import type { MusicTrackPlayback } from "../music/musicTrackPlayback";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { getBundledMusicAnalysis } from "./generated/bundled-music-analysis";
import {
  getBundledMusicTrackModule,
  resolveBundledMusicTrackUri,
} from "./generated/bundled-music-tracks";
import { resolveMusicResourcePackUri } from "./musicResourcePackSync";

export type MusicTrackPlaybackResolved = MusicTrackPlayback & {
  /** 安装包内或已下载到 DocumentDirectory */
  localReady: boolean;
};

/** useTrackAnalysis 识别的离线分析 JSON 句柄（非 HTTP URL）。 */
export const BUNDLED_MUSIC_ANALYSIS_PREFIX = "bundled-music-analysis:";

/** 音乐播放源：安装包 starter → 已下载包 → 线上流式（边播边存）。 */
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
  const synced = resolveMusicResourcePackUri(catalogSrc);
  if (synced) {
    return { src: synced, localReady: true };
  }
  const stream = catalogSrc.trim();
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
