import { normalizeMusicAlbumLabel } from "./musicAlbumCatalog";
import type { PlaybackTrack } from "./types";

export function shouldPauseMusicPagePlayback(args: {
  selectedAlbum: string;
  currentAlbum: string;
  playing: boolean;
}): boolean {
  if (!args.playing) return false;
  return (
    normalizeMusicAlbumLabel(args.selectedAlbum) === normalizeMusicAlbumLabel(args.currentAlbum)
  );
}

/** 音乐页播放键：停在当前选中的目录，不回落到安静。 */
export function resolveMusicPagePlayIndex(
  tracks: readonly PlaybackTrack[],
  album: string,
  currentIndex: number,
  isPlayable: (track: PlaybackTrack) => boolean,
): number | null {
  const key = normalizeMusicAlbumLabel(album);
  const inAlbum: number[] = [];
  const playable: number[] = [];
  const localReady: number[] = [];
  for (let i = 0; i < tracks.length; i += 1) {
    const track = tracks[i];
    if (!track || normalizeMusicAlbumLabel(track.album) !== key) continue;
    inAlbum.push(i);
    if (!isPlayable(track)) continue;
    playable.push(i);
    if (track.localReady) localReady.push(i);
  }
  if (inAlbum.length === 0) return null;
  if (inAlbum.includes(currentIndex) && playable.includes(currentIndex)) {
    return currentIndex;
  }
  return localReady[0] ?? playable[0] ?? inAlbum[0] ?? null;
}

export function resolveMusicPageToggleAction(args: {
  selectedAlbum: string;
  currentAlbum: string;
  playing: boolean;
  tracks: readonly PlaybackTrack[];
  trackIndex: number;
  isPlayable: (track: PlaybackTrack) => boolean;
}): { type: "pause" } | { type: "play"; index: number } | { type: "ignore" } {
  if (
    shouldPauseMusicPagePlayback({
      selectedAlbum: args.selectedAlbum,
      currentAlbum: args.currentAlbum,
      playing: args.playing,
    })
  ) {
    return { type: "pause" };
  }
  const index = resolveMusicPagePlayIndex(
    args.tracks,
    args.selectedAlbum,
    args.trackIndex,
    args.isPlayable,
  );
  if (index == null) return { type: "ignore" };
  return { type: "play", index };
}
