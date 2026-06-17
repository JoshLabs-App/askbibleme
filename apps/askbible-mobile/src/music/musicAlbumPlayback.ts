import type { ShellSleepTimerMinutes, MusicRepeatMode } from "./musicPlaybackTypes";
import { normalizeMusicAlbumLabel } from "./musicAlbumCatalog";
import type { PlaybackTrack } from "./types";
import { isTrackPlayable } from "./trackArtwork";

export function defaultRepeatModeForAlbum(album: string): MusicRepeatMode | null {
  if (album === "睡眠" || album === "专注工作") return "one";
  if (album === "安静" || album === "下午茶") return "all";
  return null;
}

export function defaultMusicGainForAlbum(album: string): number {
  return album === "睡眠" ? 0.3 : 1;
}

export function resolveSleepTimerOnAlbumSwitch(
  nextAlbum: string,
  currentSleepTimer: 0 | ShellSleepTimerMinutes,
): 0 | ShellSleepTimerMinutes | null {
  if (nextAlbum === "睡眠") {
    return currentSleepTimer === 0 ? 30 : null;
  }
  return currentSleepTimer > 0 ? 0 : null;
}

export function buildFilteredTrackIndices(
  tracks: PlaybackTrack[],
  album: string,
  offlineMusicOnly: boolean,
): number[] {
  return tracks
    .map((tr, index) => ({ tr, index }))
    .filter(({ tr }) => normalizeMusicAlbumLabel(tr.album) === album)
    .filter(({ tr }) => !offlineMusicOnly || tr.localReady)
    .map(({ index }) => index);
}

export function resolveAlbumTrackIndices(tracks: PlaybackTrack[], album: string): number[] {
  return tracks
    .map((tr, index) => ({ tr, index }))
    .filter(({ tr }) => normalizeMusicAlbumLabel(tr.album) === album)
    .map(({ index }) => index);
}

export function pickAlbumStartTrackIndex(
  tracks: PlaybackTrack[],
  album: string,
  trackIndex: number,
): number | null {
  const albumIndices = resolveAlbumTrackIndices(tracks, album);
  if (albumIndices.length === 0) return null;
  const currentTrack = tracks[trackIndex];
  const currentAlbumLabel = currentTrack ? normalizeMusicAlbumLabel(currentTrack.album) : "";
  if (album === currentAlbumLabel && albumIndices.includes(trackIndex)) return null;
  const playable = albumIndices.filter((idx) => {
    const tr = tracks[idx];
    return tr && isTrackPlayable(tr);
  });
  return playable[0] ?? albumIndices[0] ?? null;
}
