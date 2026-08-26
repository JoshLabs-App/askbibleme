import { Platform } from "react-native";
import { pickRandomNextTrackIndexInAlbum } from "./musicCalmTrackAdvance";
import { resolveIosNativeMusicAssetUri } from "./startIosNativeMusicTrack";
import type { PlaybackTrack } from "./types";

/** 安卓关屏后 JS 易冻住：预取多首供原生接播（约 30–60 分钟，视曲长而定）。 */
export const MUSIC_NATIVE_NEXT_PREFETCH = Platform.OS === "android" ? 12 : 4;

export async function buildMusicNativeNextUris(args: {
  tracks: PlaybackTrack[];
  startIndex: number;
  count?: number;
}): Promise<string[]> {
  const count = Math.max(1, args.count ?? MUSIC_NATIVE_NEXT_PREFETCH);
  if (args.tracks.length === 0) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  let idx = args.startIndex;
  for (let i = 0; i < count; i += 1) {
    const nextIdx = pickRandomNextTrackIndexInAlbum(args.tracks, idx, args.tracks.length);
    const track = args.tracks[nextIdx];
    if (!track) break;
    const uri = await resolveIosNativeMusicAssetUri(track);
    if (uri && !seen.has(uri)) {
      seen.add(uri);
      out.push(uri);
    }
    idx = nextIdx;
  }
  return out;
}

/** 原生链式接播后，用 assetUri 反查曲目索引（供 UI / 续播对齐）。 */
export function findTrackIndexByResolvedUri(tracks: PlaybackTrack[], assetUri: string): number {
  const needle = assetUri.trim();
  if (!needle) return -1;
  for (let i = 0; i < tracks.length; i += 1) {
    const track = tracks[i];
    const candidates = [track.src, track.catalogSrc, track.analysisSrc].filter(Boolean) as string[];
    for (const raw of candidates) {
      if (raw.trim() === needle) return i;
      if (needle.endsWith(raw.trim()) || raw.trim().endsWith(needle)) return i;
    }
  }
  return -1;
}
