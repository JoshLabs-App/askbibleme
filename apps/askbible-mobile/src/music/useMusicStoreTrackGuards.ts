import { useEffect, useRef } from "react";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { isTrackPlayable } from "./trackArtwork";
import { warmBundledModuleUri } from "./musicTrackPlayback";
import { resolveDefaultCalmTrackIndex } from "./musicStoreHelpers";
import { warmReadingAlarmPreludePool } from "../notifications/readingAlarmPreludeCache";
import type { PlaybackTrack } from "./types";

export function useBundledOnlyTrackIndexGuard(
  tracks: PlaybackTrack[],
  trackIndex: number,
  setTrackIndex: (index: number) => void,
): void {
  useEffect(() => {
    if (!isMobileBundledOnly() || tracks.length === 0) return;
    const current = tracks[trackIndex];
    if (current?.localReady) return;
    const next = resolveDefaultCalmTrackIndex(tracks);
    if (next !== trackIndex) setTrackIndex(next);
  }, [tracks, trackIndex, setTrackIndex]);
}

export function useWarmCalmBundledTrack(tracks: PlaybackTrack[]): void {
  const lastPreludeKeyRef = useRef("");

  useEffect(() => {
    if (tracks.length === 0) return;

    for (const track of tracks) {
      if (!isTrackPlayable(track) || !track.localReady || track.bundledModule == null) continue;
      void warmBundledModuleUri(track.bundledModule);
    }

    const localKey = tracks
      .filter((t) => t.localReady)
      .map((t) => t.id)
      .sort()
      .join("|");
    if (localKey === lastPreludeKeyRef.current) return;
    lastPreludeKeyRef.current = localKey;
    void warmReadingAlarmPreludePool(tracks);
  }, [tracks]);
}
