import { useCallback } from "react";
import type { MusicPlaybackMode, MusicRepeatMode } from "./musicPlaybackTypes";
import type { useMusicPlaybackRefs } from "./useMusicPlaybackRefs";

type Refs = ReturnType<typeof useMusicPlaybackRefs>;

export function useMusicPlaybackRefSync(
  refs: Refs,
  state: {
    trackIndex: number;
    playbackMode: MusicPlaybackMode;
    musicRepeatMode: MusicRepeatMode;
    playing: boolean;
  },
  setPlaying: (playing: boolean) => void,
) {
  refs.trackIndexRef.current = state.trackIndex;
  refs.playbackModeRef.current = state.playbackMode;
  refs.musicRepeatModeRef.current = state.musicRepeatMode;
  refs.playingStateRef.current = state.playing;

  // ponytail: syncPlayingState must stay referentially stable for shell wiring deps
  return useCallback(
    (next: boolean) => {
      if (refs.playingStateRef.current === next) return;
      refs.playingStateRef.current = next;
      setPlaying(next);
    },
    [refs.playingStateRef, setPlaying],
  );
}
