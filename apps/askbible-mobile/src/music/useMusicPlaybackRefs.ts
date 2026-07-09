import { Audio } from "expo-av";
import { useMemo, useRef } from "react";
import type { MusicCompanionStore } from "./types";
import type { MusicPlaybackMode, MusicRepeatMode } from "./musicPlaybackTypes";

export function useMusicPlaybackRefs() {
  const soundRef = useRef<Audio.Sound | null>(null);
  const sleepTimerDeadlineRef = useRef<number | null>(null);
  const activeSoundIdRef = useRef(0);
  const playbackEpochRef = useRef(0);
  const playbackModeRef = useRef<MusicPlaybackMode>("music");
  const trackIndexRef = useRef(0);
  const playTrackAtRef = useRef<(index: number, opts?: { autoPlay?: boolean }) => Promise<boolean>>(async () => false);
  const lastMusicProgressSecRef = useRef(-1);
  const lastScriptureProgressSecRef = useRef(-1);
  const musicSessionRef = useRef<{ trackId: string; startedAt: number } | null>(null);
  const calmLoopTransitioningRef = useRef(false);
  const playTrackGenerationRef = useRef(0);
  const resumeTrackIdRef = useRef<string | null>(null);
  const resumePositionSecRef = useRef<number>(0);
  const playbackResumeHydratedRef = useRef(false);
  const lastMusicPersistMsRef = useRef(0);
  const musicRepeatModeRef = useRef<MusicRepeatMode>("all");
  const musicGainRef = useRef(1);
  const latestRemoteMusicStoreRef = useRef<MusicCompanionStore | null>(null);
  const failedTrackIdsRef = useRef<Set<string>>(new Set());
  const musicMaxProgressMsRef = useRef(0);
  const musicSoundActivatedAtRef = useRef(0);
  const playingStateRef = useRef(false);
  const storeRef = useRef<MusicCompanionStore | null>(null);

  return useMemo(
    () => ({
      soundRef,
      sleepTimerDeadlineRef,
      activeSoundIdRef,
      playbackEpochRef,
      playbackModeRef,
      trackIndexRef,
      playTrackAtRef,
      lastMusicProgressSecRef,
      lastScriptureProgressSecRef,
      musicSessionRef,
      calmLoopTransitioningRef,
      playTrackGenerationRef,
      resumeTrackIdRef,
      resumePositionSecRef,
      playbackResumeHydratedRef,
      lastMusicPersistMsRef,
      musicRepeatModeRef,
      musicGainRef,
      latestRemoteMusicStoreRef,
      failedTrackIdsRef,
      musicMaxProgressMsRef,
      musicSoundActivatedAtRef,
      playingStateRef,
      storeRef,
    }),
    [
      soundRef,
      sleepTimerDeadlineRef,
      activeSoundIdRef,
      playbackEpochRef,
      playbackModeRef,
      trackIndexRef,
      playTrackAtRef,
      lastMusicProgressSecRef,
      lastScriptureProgressSecRef,
      musicSessionRef,
      calmLoopTransitioningRef,
      playTrackGenerationRef,
      resumeTrackIdRef,
      resumePositionSecRef,
      playbackResumeHydratedRef,
      lastMusicPersistMsRef,
      musicRepeatModeRef,
      musicGainRef,
      latestRemoteMusicStoreRef,
      failedTrackIdsRef,
      musicMaxProgressMsRef,
      musicSoundActivatedAtRef,
      playingStateRef,
      storeRef,
    ],
  );
}

export type MusicPlaybackRefs = ReturnType<typeof useMusicPlaybackRefs>;
