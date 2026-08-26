import type { ShellSleepTimerMinutes, MusicRepeatMode } from "./musicPlaybackTypes";
import { normalizeMusicAlbumLabel } from "./musicAlbumCatalog";
import type { PlaybackTrack } from "./types";
import { isTrackPlayable } from "./trackArtworkPlayable";

export function defaultRepeatModeForAlbum(album: string): MusicRepeatMode | null {
  if (album === "睡眠" || album === "专注工作") return "one";
  if (album === "安静" || album === "下午茶" || album === "钢琴" || album === "赞美诗") return "all";
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
    // 纯本地包：仍列出 R2 可点播曲（TEMP）；勿只留 localReady，否则非首曲整栏消失。
    .filter(({ tr }) => !offlineMusicOnly || isTrackPlayable(tr))
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
  const localReady = playable.filter((idx) => tracks[idx]?.localReady);
  return localReady[0] ?? playable[0] ?? albumIndices[0] ?? null;
}

/** 首页点选专辑：从可播曲里随机一首（含 R2），不要固定第一首。 */
export function pickRandomPlayableTrackIndexInAlbum(
  tracks: readonly PlaybackTrack[],
  album: string,
  excludeIndex?: number,
  preferLocalReady = false,
): number | null {
  const key = normalizeMusicAlbumLabel(album);
  const candidates: number[] = [];
  const localReady: number[] = [];
  for (let i = 0; i < tracks.length; i += 1) {
    const track = tracks[i];
    if (!track || !isTrackPlayable(track)) continue;
    if (normalizeMusicAlbumLabel(track.album) !== key) continue;
    candidates.push(i);
    if (track.localReady) localReady.push(i);
  }
  const pool =
    preferLocalReady && localReady.length > 0 ? localReady : candidates;
  if (excludeIndex != null && pool.length > 1) {
    const filtered = pool.filter((idx) => idx !== excludeIndex);
    if (filtered.length > 0) return filtered[Math.floor(Math.random() * filtered.length)]!;
  }
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0]!;
  return pool[Math.floor(Math.random() * pool.length)]!;
}
