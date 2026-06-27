import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { DEFAULT_MUSIC_ALBUM, normalizeMusicAlbumLabel } from "./musicAlbumCatalog";
import type { PlaybackTrack } from "./types";

export function isTrackPlayable(track: PlaybackTrack): boolean {
  if (track.localReady) return true;
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

/** 底部播放键：优先本地可播的「安静」默认曲，避免冷启动拉远端曲目卡顿。 */
export function resolveShellMusicPlayIndex(
  tracks: readonly PlaybackTrack[],
  preferredIndex: number,
): number {
  if (tracks.length === 0) return 0;
  const normalizedPreferred = ((preferredIndex % tracks.length) + tracks.length) % tracks.length;
  const preferred = tracks[normalizedPreferred];
  if (preferred && isTrackPlayable(preferred) && preferred.localReady) {
    return normalizedPreferred;
  }

  const calmLocalIdx = tracks.findIndex(
    (t) =>
      isTrackPlayable(t) &&
      t.localReady &&
      normalizeMusicAlbumLabel(t.album) === normalizeMusicAlbumLabel(DEFAULT_MUSIC_ALBUM),
  );
  if (calmLocalIdx >= 0) return calmLocalIdx;

  const anyLocalIdx = tracks.findIndex((t) => isTrackPlayable(t) && t.localReady);
  if (anyLocalIdx >= 0) return anyLocalIdx;

  if (preferred && isTrackPlayable(preferred)) return normalizedPreferred;

  const calmIdx = firstPlayableTrackIndexInAlbum(tracks, DEFAULT_MUSIC_ALBUM);
  if (calmIdx >= 0) return calmIdx;
  return firstPlayableTrackIndex(tracks);
}

