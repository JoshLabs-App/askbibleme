import { useCallback, type MutableRefObject } from "react";
import type { MusicRepeatMode } from "./musicPlaybackTypes";

type Args = {
  musicRepeatModeRef: MutableRefObject<MusicRepeatMode>;
  setMusicRepeatModeState: (mode: MusicRepeatMode | ((prev: MusicRepeatMode) => MusicRepeatMode)) => void;
};

export function useMusicRepeatControls({ musicRepeatModeRef, setMusicRepeatModeState }: Args) {
  const setMusicRepeatMode = useCallback((mode: MusicRepeatMode) => {
    musicRepeatModeRef.current = mode;
    setMusicRepeatModeState(mode);
  }, [musicRepeatModeRef, setMusicRepeatModeState]);

  const toggleMusicRepeatOne = useCallback(() => {
    setMusicRepeatModeState((prev) => {
      const next: MusicRepeatMode = prev === "one" ? "off" : "one";
      musicRepeatModeRef.current = next;
      if (__DEV__) {
        console.warn("[music-repeat] toggle one", prev, "->", next);
      }
      return next;
    });
  }, [musicRepeatModeRef, setMusicRepeatModeState]);

  const toggleMusicRepeatAll = useCallback(() => {
    setMusicRepeatModeState((prev) => {
      const next: MusicRepeatMode = prev === "all" ? "off" : "all";
      musicRepeatModeRef.current = next;
      if (__DEV__) {
        console.warn("[music-repeat] toggle all", prev, "->", next);
      }
      return next;
    });
  }, [musicRepeatModeRef, setMusicRepeatModeState]);

  return { setMusicRepeatMode, toggleMusicRepeatOne, toggleMusicRepeatAll };
}
