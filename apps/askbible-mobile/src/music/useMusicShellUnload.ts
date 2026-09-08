import { useCallback } from "react";
import { syncShellMediaSession } from "../audio/shellMediaControls";
import { getShellMusicWantPlaying } from "../audio/shellMusicWantPlaying";
import { safeStopAndUnloadSound } from "../audio/safeShellSound";
import type { MusicPlaybackRefs } from "./useMusicPlaybackRefs";

export function useMusicShellUnload(
  refs: Pick<
    MusicPlaybackRefs,
    "playbackEpochRef" | "activeSoundIdRef"
  >,
) {
  return useCallback(async () => {
    refs.playbackEpochRef.current += 1;
    refs.activeSoundIdRef.current += 1;
    /*
     * 这里原本还要停掉并卸载 expo-av 的 Sound。真机上音频全部由原生播放器出声，
     * soundRef 永远是 null，剩下的只有这两个世代计数——它们仍用于让在途的旧操作作废。
     */
  }, [refs.activeSoundIdRef, refs.playbackEpochRef]);
}
