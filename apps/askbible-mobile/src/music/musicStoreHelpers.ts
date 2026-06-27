import { pickRandomNextIndex } from "../../../../lib/music/album-playback";
import { DEFAULT_MUSIC_ALBUM, normalizeMusicAlbumLabel } from "./musicAlbumCatalog";
import { firstPlayableTrackIndex, firstPlayableTrackIndexInAlbum, isTrackPlayable } from "./trackArtwork";
import type { MusicCompanionStore, PlaybackTrack } from "./types";

export function listLocalPlayableTrackIndices(tracks: readonly PlaybackTrack[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < tracks.length; i += 1) {
    const track = tracks[i];
    if (track && isTrackPlayable(track) && track.localReady) out.push(i);
  }
  return out;
}

export function listLocalPlayableTrackIndicesInAlbum(
  tracks: readonly PlaybackTrack[],
  album: string = DEFAULT_MUSIC_ALBUM,
): number[] {
  const key = normalizeMusicAlbumLabel(album);
  const out: number[] = [];
  for (let i = 0; i < tracks.length; i += 1) {
    const track = tracks[i];
    if (
      track &&
      isTrackPlayable(track) &&
      track.localReady &&
      normalizeMusicAlbumLabel(track.album) === key
    ) {
      out.push(i);
    }
  }
  return out;
}

/** 在设备本地可播曲目中随机选一首（仅 1 首时仍返回该首）。 */
export function pickRandomLocalPlayableTrackIndex(
  tracks: readonly PlaybackTrack[],
  excludeIndex?: number,
): number {
  if (tracks.length === 0) return 0;
  let candidates = listLocalPlayableTrackIndices(tracks);
  if (excludeIndex != null && candidates.length > 1) {
    const filtered = candidates.filter((idx) => idx !== excludeIndex);
    if (filtered.length > 0) candidates = filtered;
  }
  if (candidates.length === 0) return resolveDefaultCalmTrackIndex(tracks);
  if (candidates.length === 1) return candidates[0]!;
  return candidates[pickRandomNextIndex(0, candidates.length)]!;
}

/** 在指定专辑的本地可播曲目中随机选一首（读经闹钟预备音乐用）。 */
export function pickRandomLocalPlayableTrackIndexInAlbum(
  tracks: readonly PlaybackTrack[],
  album: string = DEFAULT_MUSIC_ALBUM,
  excludeIndex?: number,
): number {
  if (tracks.length === 0) return 0;
  let candidates = listLocalPlayableTrackIndicesInAlbum(tracks, album);
  if (excludeIndex != null && candidates.length > 1) {
    const filtered = candidates.filter((idx) => idx !== excludeIndex);
    if (filtered.length > 0) candidates = filtered;
  }
  if (candidates.length === 0) return resolveDefaultCalmTrackIndex(tracks);
  if (candidates.length === 1) return candidates[0]!;
  return candidates[pickRandomNextIndex(0, candidates.length)]!;
}

export function hasAtLeastBundledTracks(
  candidate: MusicCompanionStore | null | undefined,
  bundled: MusicCompanionStore,
): candidate is MusicCompanionStore {
  if (!candidate) return false;
  const candidateCount = Array.isArray(candidate.audioTracks) ? candidate.audioTracks.length : 0;
  const bundledCount = Array.isArray(bundled.audioTracks) ? bundled.audioTracks.length : 0;
  return candidateCount >= bundledCount;
}

export function resolveDefaultCalmTrackIndex(tracks: PlaybackTrack[]): number {
  const calmIdx = firstPlayableTrackIndexInAlbum(tracks, normalizeMusicAlbumLabel("安静"));
  return calmIdx >= 0 ? calmIdx : firstPlayableTrackIndex(tracks);
}

/** 新会话默认曲：优先在本地可播曲目中随机，避免安装包仅 1 首 starter 时永远同一首。 */
export function resolveSessionDefaultTrackIndex(tracks: PlaybackTrack[]): number {
  const localIndices = listLocalPlayableTrackIndices(tracks);
  if (localIndices.length > 1) return pickRandomLocalPlayableTrackIndex(tracks);
  return resolveDefaultCalmTrackIndex(tracks);
}
