import { useCallback } from "react";
import { getShellMusicWantPlaying } from "../audio/shellMusicWantPlaying";
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
  // 用户已停播时勿把旧 UI playing 刷回 ref，否则续播逻辑会误开。
  refs.playingStateRef.current = getShellMusicWantPlaying() ? state.playing : false;

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
