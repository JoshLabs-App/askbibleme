import { KNOWN_MUSIC_ALBUMS, normalizeMusicAlbumLabel } from "./musicAlbumCatalog";
import type { PlaybackTrack } from "./types";

export function buildMusicHomeAlbumNames(tracks: PlaybackTrack[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const known of KNOWN_MUSIC_ALBUMS) {
    seen.add(known);
    ordered.push(known);
  }
  for (const tr of tracks) {
    const label = normalizeMusicAlbumLabel(tr.album);
    if (seen.has(label)) continue;
    seen.add(label);
    ordered.push(label);
  }
  return ordered;
}

export function buildMusicHomeAlbumCounts(tracks: PlaybackTrack[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const tr of tracks) {
    const label = normalizeMusicAlbumLabel(tr.album);
    counts[label] = (counts[label] ?? 0) + 1;
  }
  return counts;
}
