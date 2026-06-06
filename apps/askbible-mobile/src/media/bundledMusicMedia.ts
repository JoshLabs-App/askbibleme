import type { MusicTrackPlayback } from "../music/musicTrackPlayback";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";

/** useTrackAnalysis 识别的离线分析 JSON 句柄（非 HTTP URL）。 */
export const BUNDLED_MUSIC_ANALYSIS_PREFIX = "bundled-music-analysis:";

/** 音乐播放源：仅使用设备本地资源（安装包内/本地资源包），不直连远端 URL。 */
export function resolveMusicTrackPlayback(
  trackId: string,
  remoteAbsolute: string,
): MusicTrackPlayback {
  const id = trackId.trim();
  // bundled-only 模式才会按需加载安装包内资源；日常 dev 模式尽量走远端，减少初始依赖图。
  if (!isMobileBundledOnly()) {
    return { src: (remoteAbsolute || "").trim() };
  }
  const { getBundledMusicTrackModule, resolveBundledMusicTrackUri } = require("./generated/bundled-music-tracks") as typeof import("./generated/bundled-music-tracks");
  const bundledModule = id ? (getBundledMusicTrackModule(id) ?? undefined) : undefined;
  const bundledUri = bundledModule != null ? resolveBundledMusicTrackUri(id) ?? "" : "";
  return { src: bundledUri, bundledModule };
}

export function resolveMusicTrackPlaybackUri(trackId: string, remoteAbsolute: string): string {
  return resolveMusicTrackPlayback(trackId, remoteAbsolute).src;
}

export function resolveMusicAnalysisPlaybackUri(trackId: string, remoteAbsolute: string): string | null {
  if (!isMobileBundledOnly() || !trackId.trim()) return remoteAbsolute || null;
  const id = trackId.trim();
  const { getBundledMusicAnalysis } = require("./generated/bundled-music-analysis") as typeof import("./generated/bundled-music-analysis");
  if (getBundledMusicAnalysis(id)) return `${BUNDLED_MUSIC_ANALYSIS_PREFIX}${id}`;
  return null;
}
