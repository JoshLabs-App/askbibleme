import type { PlaybackTrack } from "./types";
import { normalizeMusicAlbumLabel } from "./musicAlbumCatalog";
import { pickRandomNextIndex } from "../../../../lib/music/album-playback";

/** 避免 iOS 模拟器 / 坏源在加载瞬间误报曲末，导致 playTrackAt 连环切换。 */
export function shouldAdvanceMusicOnEnd(
  maxProgressMs: number,
  durationMillis: number | null | undefined,
  activatedAtMs: number,
): boolean {
  if (Date.now() - activatedAtMs < 2000) return false;
  if (maxProgressMs < 900) return false;
  if (typeof durationMillis === "number" && durationMillis > 1200) {
    return maxProgressMs >= Math.min(3000, durationMillis * 0.12);
  }
  return true;
}

export function pickRandomNextTrackIndex(current: number, total: number): number {
  return pickRandomNextIndex(current, total);
}

export function pickRandomNextTrackIndexInAlbum(
  tracks: PlaybackTrack[],
  currentIndex: number,
  fallbackTotal: number,
): number {
  const current = tracks[currentIndex];
  const albumKey = normalizeMusicAlbumLabel(current?.album);
  if (!albumKey) return pickRandomNextTrackIndex(currentIndex, fallbackTotal);
  const sameAlbumIndices = tracks
    .map((tr, idx) => ({ tr, idx }))
    .filter(({ tr }) => normalizeMusicAlbumLabel(tr.album) === albumKey)
    .map(({ idx }) => idx);
  if (sameAlbumIndices.length <= 1) return currentIndex;
  const currentPos = sameAlbumIndices.findIndex((idx) => idx === currentIndex);
  if (currentPos < 0) return sameAlbumIndices[0] ?? currentIndex;
  let nextPos = currentPos;
  for (let i = 0; i < 8 && nextPos === currentPos; i += 1) {
    nextPos = Math.floor(Math.random() * sameAlbumIndices.length);
  }
  if (nextPos === currentPos) {
    nextPos = (currentPos + 1) % sameAlbumIndices.length;
  }
  return sameAlbumIndices[nextPos] ?? currentIndex;
}
