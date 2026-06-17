import type { MutableRefObject } from "react";
import { findNextMusicTrackFallbackIndex } from "./musicTrackPlayback";
import type { PlaybackTrack } from "./types";

export function scheduleMusicTrackPlayFallback(args: {
  tracks: PlaybackTrack[];
  index: number;
  failedTrackIdsRef: MutableRefObject<Set<string>>;
  playTrackAtRef: MutableRefObject<(index: number) => Promise<void>>;
  setPlaying: (playing: boolean) => void;
  failedTrackId?: string;
}): boolean {
  const failedId = args.failedTrackId?.trim();
  if (failedId) args.failedTrackIdsRef.current.add(failedId);
  const fallbackIndex = findNextMusicTrackFallbackIndex(
    args.tracks,
    args.index,
    args.failedTrackIdsRef.current,
  );
  if (fallbackIndex != null) {
    void args.playTrackAtRef.current(fallbackIndex);
    return true;
  }
  if (args.failedTrackIdsRef.current.size >= args.tracks.length) {
    args.failedTrackIdsRef.current.clear();
  }
  args.setPlaying(false);
  return false;
}
