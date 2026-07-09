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
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;
    if (!isMobileBundledOnly() || tracks.length === 0) return;
    const current = tracks[trackIndex];
    if (current?.localReady) return;
    const next = resolveDefaultCalmTrackIndex(tracks);
    if (next !== trackIndex) setTrackIndex(next);
  }, [enabled, tracks, trackIndex, setTrackIndex]);
}

export function useWarmCalmBundledTrack(tracks: PlaybackTrack[], enabled = true): void {
  const lastPreludeKeyRef = useRef("");

  useEffect(() => {
    if (!enabled) return;
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
    const timer = setTimeout(() => {
      void warmReadingAlarmPreludePool(tracks);
    }, 2200);
    return () => clearTimeout(timer);
  }, [enabled, tracks]);
}
