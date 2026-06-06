import type { MusicTrackPlayback } from "../music/musicTrackPlayback";
import { resolveMusicResourcePackUri } from "./musicResourcePackSync";

/** useTrackAnalysis 识别的离线分析 JSON 句柄（非 HTTP URL）。 */
export const BUNDLED_MUSIC_ANALYSIS_PREFIX = "bundled-music-analysis:";

/** 音乐播放源：本地下载包 → 安装包内置 starter 曲，不常规直连远端播放。 */
export function resolveMusicTrackPlayback(
  trackId: string,
  remoteAbsolute: string,
): MusicTrackPlayback {
  const id = trackId.trim();
  const synced = resolveMusicResourcePackUri(remoteAbsolute);
  if (synced) {
    return { src: synced };
  }
  const { getBundledMusicTrackModule, resolveBundledMusicTrackUri } = require("./generated/bundled-music-tracks") as typeof import("./generated/bundled-music-tracks");
  const bundledModule = id ? (getBundledMusicTrackModule(id) ?? undefined) : undefined;
  const bundledUri = bundledModule != null ? resolveBundledMusicTrackUri(id) ?? "" : "";
  if (bundledUri) {
    return { src: bundledUri, bundledModule };
  }
  return { src: "" };
}

export function resolveMusicTrackPlaybackUri(trackId: string, remoteAbsolute: string): string {
  return resolveMusicTrackPlayback(trackId, remoteAbsolute).src;
}

export function resolveMusicAnalysisPlaybackUri(trackId: string, remoteAbsolute: string): string | null {
  const synced = resolveMusicResourcePackUri(remoteAbsolute);
  if (synced) return synced;
  if (!trackId.trim()) return null;
  const id = trackId.trim();
  const { getBundledMusicAnalysis } = require("./generated/bundled-music-analysis") as typeof import("./generated/bundled-music-analysis");
  if (getBundledMusicAnalysis(id)) return `${BUNDLED_MUSIC_ANALYSIS_PREFIX}${id}`;
  return null;
}
