import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { safePauseSound } from "../audio/safeShellSound";
import {
  pauseShellAppMusic,
  setShellSleepTimerDeadline,
  subscribeShellSleepTimerFired,
} from "../audio/shellMediaControls";
import { setShellMusicNativePlaying } from "../audio/shellMusicNativePlaying";
import { setShellMusicWantPlaying } from "../audio/shellMusicWantPlaying";
import { setShellNativeAudioTakeover } from "../audio/shellNativeAudioTakeover";
import { runMusicSleepTimerFire } from "./musicSleepTimerFire";
import type { ShellSleepTimerMinutes } from "./musicPlaybackTypes";
import type { AudioPlayer } from "expo-audio";
import type { MusicPlaybackMode } from "./musicPlaybackTypes";

type Args = {
  soundRef: MutableRefObject<AudioPlayer | null>;
  playbackModeRef: MutableRefObject<MusicPlaybackMode>;
  playingStateRef: MutableRefObject<boolean>;
  sleepTimerDeadlineRef: MutableRefObject<number | null>;
  sleepTimerMinutes: 0 | ShellSleepTimerMinutes;
  setPlaying: (playing: boolean) => void;
  setSleepTimerMinutesState: (minutes: 0 | ShellSleepTimerMinutes) => void;
};

export function useMusicSleepTimerControl({
  soundRef,
  playingStateRef,
  sleepTimerDeadlineRef,
  sleepTimerMinutes,
  setPlaying,
  setSleepTimerMinutesState,
}: Args) {
  const firingRef = useRef(false);

  const pauseShellPlayback = useCallback(async () => {
    const sound = soundRef.current;
    setShellMusicWantPlaying(false);
    setShellMusicNativePlaying(false);
    setShellNativeAudioTakeover(false);
    playingStateRef.current = false;
    setPlaying(false);
    // iOS 音乐走原生 AVPlayer：soundRef 常为 null，仍须 pauseAppMusic，否则只灭黄标、音频继续。
    pauseShellAppMusic();
    if (sound) {
      await safePauseSound(sound);
    }
  }, [playingStateRef, setPlaying, soundRef]);

  const fireSleepTimer = useCallback(async () => {
    await runMusicSleepTimerFire({
      firingRef,
      sleepTimerDeadlineRef,
      setSleepTimerMinutesState,
      pauseShellPlayback,
    });
  }, [
    pauseShellPlayback,
    setSleepTimerMinutesState,
    sleepTimerDeadlineRef,
  ]);

  const setSleepTimerMinutes = useCallback((minutes: 0 | ShellSleepTimerMinutes) => {
    setSleepTimerMinutesState(minutes);
    if (minutes === 0) {
      sleepTimerDeadlineRef.current = null;
      setShellSleepTimerDeadline(null);
      return;
    }
    const deadline = Date.now() + minutes * 60 * 1000;
    sleepTimerDeadlineRef.current = deadline;
    setShellSleepTimerDeadline(deadline);
  }, [setSleepTimerMinutesState, sleepTimerDeadlineRef]);

  useEffect(() => subscribeShellSleepTimerFired(() => {
    void fireSleepTimer();
  }), [fireSleepTimer]);

  // 前台兜底：一次性超时。锁屏后 JS 会被冻住，到期由原生触发。
  useEffect(() => {
    if (sleepTimerMinutes === 0) return;
    const deadline = sleepTimerDeadlineRef.current;
    if (deadline == null) return;
    const id = setTimeout(() => {
      void fireSleepTimer();
    }, Math.max(0, deadline - Date.now()));
    return () => clearTimeout(id);
  }, [fireSleepTimer, sleepTimerDeadlineRef, sleepTimerMinutes]);

  return { setSleepTimerMinutes, pauseShellPlayback };
}
