import type { MusicTrackPlayback } from "../music/musicTrackPlayback";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { getBundledMusicAnalysis } from "./generated/bundled-music-analysis";
import {
  getBundledMusicTrackModule,
  resolveBundledMusicTrackUri,
} from "./generated/bundled-music-tracks";

/** useTrackAnalysis 识别的离线分析 JSON 句柄（非 HTTP URL）。 */
export const BUNDLED_MUSIC_ANALYSIS_PREFIX = "bundled-music-analysis:";

/** 音乐播放源：仅使用设备本地资源（安装包内/本地资源包），不直连远端 URL。 */
export function resolveMusicTrackPlayback(
  trackId: string,
  remoteAbsolute: string,
): MusicTrackPlayback {
  void remoteAbsolute;
  const id = trackId.trim();
  const bundledModule = id ? (getBundledMusicTrackModule(id) ?? undefined) : undefined;
  // 音乐播放只走设备本地（安装包内 / 后续本地资源包），不直连远端流媒体 URL。
  const src = bundledModule != null ? resolveBundledMusicTrackUri(id) ?? "" : "";
  return { src, bundledModule };
}

export function resolveMusicTrackPlaybackUri(trackId: string, remoteAbsolute: string): string {
  return resolveMusicTrackPlayback(trackId, remoteAbsolute).src;
}

export function resolveMusicAnalysisPlaybackUri(trackId: string, remoteAbsolute: string): string | null {
  if (!isMobileBundledOnly() || !trackId.trim()) return remoteAbsolute || null;
  const id = trackId.trim();
  if (getBundledMusicAnalysis(id)) return `${BUNDLED_MUSIC_ANALYSIS_PREFIX}${id}`;
  return null;
}
