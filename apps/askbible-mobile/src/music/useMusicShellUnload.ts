import { useCallback } from "react";
import { syncShellMediaSession } from "../audio/shellMediaControls";
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
    syncShellMediaSession(null);
  }, [refs.activeSoundIdRef, refs.playbackEpochRef, refs.soundRef]);
}
