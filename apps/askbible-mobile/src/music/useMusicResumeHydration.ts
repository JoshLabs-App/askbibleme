import { InteractionManager } from "react-native";
import { useEffect, useRef, type MutableRefObject } from "react";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import {
  normalizeMusicResumeSec,
  readMusicPlaybackResume,
  writeMusicPlaybackResume,
} from "./music-playback-prefs";
import { resolveDefaultCalmTrackIndex } from "./musicStoreHelpers";
import { isTrackPlayable } from "./trackArtwork";
import type { PlaybackTrack } from "./types";

type Args = {
  enabled?: boolean;
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
  enabled = true,
  tracks,
  playbackResumeHydratedRef,
  resumeTrackIdRef,
  resumePositionSecRef,
  lastMusicProgressSecRef,
  setTrackIndex,
  setMusicCurrentSec,
  setMusicDurationSec,
}: Args): void {
  const hydrateStartedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (tracks.length === 0 || playbackResumeHydratedRef.current || hydrateStartedRef.current) return;
    hydrateStartedRef.current = true;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      void (async () => {
        try {
          const saved = await readMusicPlaybackResume();
          if (cancelled) return;
          if (saved) {
            let idx = tracks.findIndex((x) => x.id === saved.trackId);
            if (idx >= 0) {
              if (
                isMobileBundledOnly() &&
                !tracks[idx]?.localReady &&
                !isTrackPlayable(tracks[idx]!)
              ) {
                idx = resolveDefaultCalmTrackIndex(tracks);
              }
              resumeTrackIdRef.current = tracks[idx]?.id ?? saved.trackId;
              const trackDurationSec = tracks[idx]?.durationSec;
              const normalizedSec = normalizeMusicResumeSec(
                Math.max(0, saved.positionSec),
                trackDurationSec,
              );
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
            }
          }
        } finally {
          // 落点写完再就绪，供进音乐页自动续播等待。
          if (!cancelled) playbackResumeHydratedRef.current = true;
          else hydrateStartedRef.current = false;
        }
      })();
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [
    enabled,
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
