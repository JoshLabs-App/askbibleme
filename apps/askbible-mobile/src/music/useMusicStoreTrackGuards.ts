import { useEffect } from "react";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { isTrackPlayable } from "./trackArtwork";
import { warmBundledModuleUri } from "./musicTrackPlayback";
import { resolveDefaultCalmTrackIndex } from "./musicStoreHelpers";
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
  useEffect(() => {
    if (tracks.length === 0) return;
    const calmLocal = tracks.find(
      (t) =>
        isTrackPlayable(t) &&
        t.localReady &&
        (t.album || "").trim() === "安静" &&
        t.bundledModule != null,
    );
    if (!calmLocal?.bundledModule) return;
    void warmBundledModuleUri(calmLocal.bundledModule);
  }, [tracks]);
}
