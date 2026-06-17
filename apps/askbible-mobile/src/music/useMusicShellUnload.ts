import { useCallback } from "react";
import { safeStopAndUnloadSound } from "../audio/safeShellSound";
import type { MusicPlaybackRefs } from "./useMusicPlaybackRefs";

export function useMusicShellUnload(
  refs: Pick<MusicPlaybackRefs, "playbackEpochRef" | "activeSoundIdRef" | "soundRef">,
) {
  return useCallback(async () => {
    refs.playbackEpochRef.current += 1;
    refs.activeSoundIdRef.current += 1;
    const sound = refs.soundRef.current;
    refs.soundRef.current = null;
    if (!sound) return;
    await safeStopAndUnloadSound(sound);
  }, [refs.activeSoundIdRef, refs.playbackEpochRef, refs.soundRef]);
}
