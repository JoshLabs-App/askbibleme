import type { MutableRefObject } from "react";
import type { ScriptureShellPlaybackBridge } from "./scripturePlaybackTypes";
import type { MusicPlaybackRefs } from "./useMusicPlaybackRefs";

export type MusicPlayTrackBridge = Pick<
  MusicPlaybackRefs,
  | "soundRef"
  
  
  | "activeSoundIdRef"
  | "playbackEpochRef"
 
  | "trackIndexRef"
  | "playTrackAtRef"
  | "playTrackGenerationRef"
  | "calmLoopTransitioningRef"
  | "lastMusicProgressSecRef"
  | "lastMusicPersistMsRef"
  | "musicRepeatModeRef"
  | "musicGainRef"
  | "musicMaxProgressMsRef"
  | "musicSoundActivatedAtRef"
  | "resumeTrackIdRef"
  | "resumePositionSecRef"
  | "failedTrackIdsRef"
  | "storeRef"
  | "musicSessionRef"
> & {
  scriptureSrcRef: MutableRefObject<string | null>;
};

export function createScriptureShellBridge(
  refs: Pick<
    MusicPlaybackRefs,
    "soundRef" | "activeSoundIdRef" | "playbackEpochRef"
  >,
  unloadCurrent: () => Promise<void>,
  endMusicSession: () => void,
): ScriptureShellPlaybackBridge {
  return {
    soundRef: refs.soundRef,
    activeSoundIdRef: refs.activeSoundIdRef,
    playbackEpochRef: refs.playbackEpochRef,
    unloadCurrent,
    endMusicSession,
  };
}

export function createMusicPlayTrackBridge(
  refs: MusicPlaybackRefs,
  scriptureSrcRef: MutableRefObject<string | null>,
): MusicPlayTrackBridge {
  return {
    soundRef: refs.soundRef,
    activeSoundIdRef: refs.activeSoundIdRef,
    playbackEpochRef: refs.playbackEpochRef,
    trackIndexRef: refs.trackIndexRef,
    playTrackAtRef: refs.playTrackAtRef,
    playTrackGenerationRef: refs.playTrackGenerationRef,
    calmLoopTransitioningRef: refs.calmLoopTransitioningRef,
    lastMusicProgressSecRef: refs.lastMusicProgressSecRef,
    lastMusicPersistMsRef: refs.lastMusicPersistMsRef,
    musicRepeatModeRef: refs.musicRepeatModeRef,
    musicGainRef: refs.musicGainRef,
    musicMaxProgressMsRef: refs.musicMaxProgressMsRef,
    musicSoundActivatedAtRef: refs.musicSoundActivatedAtRef,
    resumeTrackIdRef: refs.resumeTrackIdRef,
    resumePositionSecRef: refs.resumePositionSecRef,
    failedTrackIdsRef: refs.failedTrackIdsRef,
    storeRef: refs.storeRef,
    scriptureSrcRef,
    musicSessionRef: refs.musicSessionRef,
  };
}
