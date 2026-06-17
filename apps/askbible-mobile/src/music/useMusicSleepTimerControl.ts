import { useCallback, useEffect, type MutableRefObject } from "react";
import { safePauseSound } from "../audio/safeShellSound";
import type { ShellSleepTimerMinutes } from "./musicPlaybackTypes";
import type { Audio } from "expo-av";

type Args = {
  soundRef: MutableRefObject<Audio.Sound | null>;
  sleepTimerDeadlineRef: MutableRefObject<number | null>;
  sleepTimerMinutes: 0 | ShellSleepTimerMinutes;
  setPlaying: (playing: boolean) => void;
  setSleepTimerMinutesState: (minutes: 0 | ShellSleepTimerMinutes) => void;
};

export function useMusicSleepTimerControl({
  soundRef,
  sleepTimerDeadlineRef,
  sleepTimerMinutes,
  setPlaying,
  setSleepTimerMinutesState,
}: Args) {
  const pauseShellPlayback = useCallback(async () => {
    const sound = soundRef.current;
    if (!sound) {
      setPlaying(false);
      return;
    }
    await safePauseSound(sound);
    setPlaying(false);
  }, [setPlaying, soundRef]);

  const setSleepTimerMinutes = useCallback((minutes: 0 | ShellSleepTimerMinutes) => {
    setSleepTimerMinutesState(minutes);
    if (minutes === 0) {
      sleepTimerDeadlineRef.current = null;
      return;
    }
    sleepTimerDeadlineRef.current = Date.now() + minutes * 60 * 1000;
  }, [setSleepTimerMinutesState, sleepTimerDeadlineRef]);

  useEffect(() => {
    if (sleepTimerMinutes === 0) return;
    const id = setInterval(() => {
      const d = sleepTimerDeadlineRef.current;
      if (d == null || Date.now() < d) return;
      sleepTimerDeadlineRef.current = null;
      setSleepTimerMinutesState(0);
      void pauseShellPlayback();
    }, 1000);
    return () => clearInterval(id);
  }, [pauseShellPlayback, setSleepTimerMinutesState, sleepTimerDeadlineRef, sleepTimerMinutes]);

  return { setSleepTimerMinutes, pauseShellPlayback };
}
