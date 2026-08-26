import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { musicTrackHasRemoteR2Fallback } from "../media/bundledMusicMedia";
import { DEFAULT_MUSIC_ALBUM, normalizeMusicAlbumLabel } from "./musicAlbumCatalog";
import type { PlaybackTrack } from "./types";

export function isTrackPlayable(track: PlaybackTrack): boolean {
  if (track.localReady) return true;
  // TEMP：R2 / 圣诗直链在 bundled-only 下也可播。src 与 catalogSrc 都要认。
  if (musicTrackHasRemoteR2Fallback(track.catalogSrc)) return true;
  if (musicTrackHasRemoteR2Fallback(track.src)) return true;
  if (isMobileBundledOnly()) return false;
  return Boolean(track.catalogSrc?.trim() || track.src?.trim());
}

export function firstPlayableTrackIndex(tracks: readonly PlaybackTrack[]): number {
  const idx = tracks.findIndex((t) => isTrackPlayable(t));
  return idx >= 0 ? idx : 0;
}

export function firstPlayableTrackIndexInAlbum(
  tracks: readonly PlaybackTrack[],
  album: string,
): number {
  const key = album.trim();
  if (!key) return -1;
  return tracks.findIndex(
    (t) => isTrackPlayable(t) && normalizeMusicAlbumLabel(t.album) === normalizeMusicAlbumLabel(key),
  );
}

/**
 * 壳层/首页播放键选曲：
 * - 若当前 preferred 已可播（含用户在音乐栏切过的其它专辑、R2 点播），继续该曲；
 * - 否则只回落到「安静」本地曲，不把其它专辑混进默认播。
 */
export function resolveShellMusicPlayIndex(
  tracks: readonly PlaybackTrack[],
  preferredIndex: number,
): number {
  if (tracks.length === 0) return 0;
  const normalizedPreferred = ((preferredIndex % tracks.length) + tracks.length) % tracks.length;
  const preferred = tracks[normalizedPreferred];
  if (preferred && isTrackPlayable(preferred)) {
    return normalizedPreferred;
  }

  const calmLocalIdx = tracks.findIndex(
    (t) =>
      isTrackPlayable(t) &&
      t.localReady &&
      normalizeMusicAlbumLabel(t.album) === normalizeMusicAlbumLabel(DEFAULT_MUSIC_ALBUM),
  );
  if (calmLocalIdx >= 0) return calmLocalIdx;

  const calmIdx = firstPlayableTrackIndexInAlbum(tracks, DEFAULT_MUSIC_ALBUM);
  if (calmIdx >= 0) return calmIdx;
  return firstPlayableTrackIndex(tracks);
}

