import { useCallback, type MutableRefObject } from "react";
import { normalizeMusicResumeSec, writeMusicPlaybackResume } from "./music-playback-prefs";
import type { MusicCompanionStore, PlaybackTrack } from "./types";

type Args = {
  tracks: PlaybackTrack[];
  storeRef: MutableRefObject<MusicCompanionStore | null>;
  resumeTrackIdRef: MutableRefObject<string | null>;
  resumePositionSecRef: MutableRefObject<number>;
};

export function useMusicResumePersistence({
  tracks,
  storeRef,
  resumeTrackIdRef,
  resumePositionSecRef,
}: Args) {
  return useCallback(
    async (trackId: string, positionSec: number) => {
      const normalizedTrackId = trackId.trim();
      if (!normalizedTrackId) return;
      const trackDurationSec =
        tracks.find((t) => t.id === normalizedTrackId)?.durationSec ??
        storeRef.current?.audioTracks.find((t) => t.id === normalizedTrackId)?.durationSec;
      const normalizedSec = normalizeMusicResumeSec(
        Number.isFinite(positionSec) ? Math.max(0, positionSec) : 0,
        trackDurationSec,
      );
      resumeTrackIdRef.current = normalizedTrackId;
      resumePositionSecRef.current = normalizedSec;
      try {
        await writeMusicPlaybackResume({ trackId: normalizedTrackId, positionSec: normalizedSec });
      } catch {
        /* ignore local storage write failures */
      }
    },
    [resumePositionSecRef, resumeTrackIdRef, storeRef, tracks],
  );
}
