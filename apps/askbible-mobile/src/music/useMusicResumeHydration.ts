import { InteractionManager } from "react-native";
import { useEffect, type MutableRefObject } from "react";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import {
  normalizeMusicResumeSec,
  readMusicPlaybackResume,
  writeMusicPlaybackResume,
} from "./music-playback-prefs";
import { resolveDefaultCalmTrackIndex } from "./musicStoreHelpers";
import type { PlaybackTrack } from "./types";

type Args = {
  tracks: PlaybackTrack[];
  playbackResumeHydratedRef: MutableRefObject<boolean>;
  resumeTrackIdRef: MutableRefObject<string | null>;
  resumePositionSecRef: MutableRefObject<number>;
  lastMusicProgressSecRef: MutableRefObject<number>;
  setTrackIndex: (index: number) => void;
  setMusicCurrentSec: (sec: number) => void;
  setMusicDurationSec: (sec: number) => void;
};

export function useMusicResumeHydration({
  tracks,
  playbackResumeHydratedRef,
  resumeTrackIdRef,
  resumePositionSecRef,
  lastMusicProgressSecRef,
  setTrackIndex,
  setMusicCurrentSec,
  setMusicDurationSec,
}: Args): void {
  useEffect(() => {
    if (tracks.length === 0 || playbackResumeHydratedRef.current) return;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled || playbackResumeHydratedRef.current) return;
      playbackResumeHydratedRef.current = true;
      void (async () => {
        const saved = await readMusicPlaybackResume();
        if (cancelled || !saved) return;
        let idx = tracks.findIndex((x) => x.id === saved.trackId);
        if (idx < 0) return;
        if (isMobileBundledOnly() && !tracks[idx]?.localReady) {
          idx = resolveDefaultCalmTrackIndex(tracks);
        }
        resumeTrackIdRef.current = tracks[idx]?.id ?? saved.trackId;
        const trackDurationSec = tracks[idx]?.durationSec;
        const normalizedSec = normalizeMusicResumeSec(Math.max(0, saved.positionSec), trackDurationSec);
        resumePositionSecRef.current = normalizedSec;
        setTrackIndex(idx);
        lastMusicProgressSecRef.current = normalizedSec;
        setMusicCurrentSec(normalizedSec);
        if (trackDurationSec && normalizedSec > 0) {
          setMusicDurationSec(trackDurationSec);
        }
        if (normalizedSec !== saved.positionSec) {
          void writeMusicPlaybackResume({ trackId: saved.trackId, positionSec: normalizedSec });
        }
      })();
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [
    tracks,
    playbackResumeHydratedRef,
    resumeTrackIdRef,
    resumePositionSecRef,
    lastMusicProgressSecRef,
    setTrackIndex,
    setMusicCurrentSec,
    setMusicDurationSec,
  ]);
}
