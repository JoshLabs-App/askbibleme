import type { Audio, AVPlaybackStatus } from "expo-av";
import type { MutableRefObject } from "react";
import {
  MUSIC_PROGRESS_UI_INTERVAL_SEC,
  shouldEmitPlaybackSecUpdate,
} from "./musicPlaybackProgress";
import {
  handleMusicCalmLoopTrimStatus,
  musicDurationSecWithCalmTrim,
} from "./musicCalmLoopPlaybackStatus";
import { handleMusicTrackDidJustFinish } from "./musicTrackEndPlaybackStatus";
import type { MusicRepeatMode } from "./musicPlaybackTypes";
import type { PlaybackTrack } from "./types";

type PlaybackMode = "music" | "scripture";

export type MusicPlaybackStatusHandlerArgs = {
  soundId: number;
  epoch: number;
  track: PlaybackTrack;
  tracks: PlaybackTrack[];
  activeSoundIdRef: MutableRefObject<number>;
  playbackEpochRef: MutableRefObject<number>;
  playbackModeRef: MutableRefObject<PlaybackMode>;
  soundRef: MutableRefObject<Audio.Sound | null>;
  musicMaxProgressMsRef: MutableRefObject<number>;
  musicSoundActivatedAtRef: MutableRefObject<number>;
  calmLoopTransitioningRef: MutableRefObject<boolean>;
  lastMusicProgressSecRef: MutableRefObject<number>;
  lastMusicPersistMsRef: MutableRefObject<number>;
  musicRepeatModeRef: MutableRefObject<MusicRepeatMode>;
  musicGainRef: MutableRefObject<number>;
  trackIndexRef: MutableRefObject<number>;
  playTrackAtRef: MutableRefObject<(index: number) => Promise<void>>;
  syncPlayingState: (playing: boolean) => void;
  setPlaying: (playing: boolean) => void;
  setMusicCurrentSec: (sec: number) => void;
  setMusicDurationSec: (sec: number) => void;
  persistMusicResume: (trackId: string, positionSec: number) => void | Promise<void>;
};

export function createMusicPlaybackStatusHandler(
  args: MusicPlaybackStatusHandlerArgs,
): (status: AVPlaybackStatus) => void {
  const {
    soundId,
    epoch,
    track,
    tracks,
    activeSoundIdRef,
    playbackEpochRef,
    playbackModeRef,
    soundRef,
    musicMaxProgressMsRef,
    musicSoundActivatedAtRef,
    calmLoopTransitioningRef,
    lastMusicProgressSecRef,
    lastMusicPersistMsRef,
    musicRepeatModeRef,
    musicGainRef,
    trackIndexRef,
    playTrackAtRef,
    syncPlayingState,
    setPlaying,
    setMusicCurrentSec,
    setMusicDurationSec,
    persistMusicResume,
  } = args;

  return (status: AVPlaybackStatus) => {
    if (soundId !== activeSoundIdRef.current || epoch !== playbackEpochRef.current) return;
    if (!status.isLoaded) return;
    if (status.positionMillis > musicMaxProgressMsRef.current) {
      musicMaxProgressMsRef.current = status.positionMillis;
    }
    syncPlayingState(status.isPlaying);
    if (playbackModeRef.current === "music") {
      const musicSec = status.positionMillis / 1000;
      if (
        shouldEmitPlaybackSecUpdate(
          lastMusicProgressSecRef,
          musicSec,
          MUSIC_PROGRESS_UI_INTERVAL_SEC,
        )
      ) {
        setMusicCurrentSec(musicSec);
      }
      setMusicDurationSec(
        musicDurationSecWithCalmTrim(
          track,
          status.durationMillis ?? undefined,
          musicRepeatModeRef.current,
        ),
      );
      if (
        handleMusicCalmLoopTrimStatus({
          status,
          track,
          soundRef,
          musicRepeatModeRef,
          musicGainRef,
          calmLoopTransitioningRef,
          setPlaying,
        })
      ) {
        return;
      }
      const now = Date.now();
      if (now - lastMusicPersistMsRef.current > 1800 || !status.isPlaying) {
        lastMusicPersistMsRef.current = now;
        void persistMusicResume(track.id, status.positionMillis / 1000);
      }
    }
    if (status.didJustFinish && playbackModeRef.current === "music") {
      handleMusicTrackDidJustFinish({
        status,
        track,
        tracks,
        soundRef,
        musicMaxProgressMsRef,
        musicSoundActivatedAtRef,
        calmLoopTransitioningRef,
        musicRepeatModeRef,
        musicGainRef,
        trackIndexRef,
        playTrackAtRef,
        syncPlayingState,
        setPlaying,
      });
    }
  };
}
