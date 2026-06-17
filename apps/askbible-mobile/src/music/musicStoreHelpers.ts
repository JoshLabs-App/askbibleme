import { firstPlayableTrackIndex, firstPlayableTrackIndexInAlbum } from "./trackArtwork";
import type { MusicCompanionStore, PlaybackTrack } from "./types";

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
  const calmIdx = firstPlayableTrackIndexInAlbum(tracks, "安静");
  return calmIdx >= 0 ? calmIdx : firstPlayableTrackIndex(tracks);
}
