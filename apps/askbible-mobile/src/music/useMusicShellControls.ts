import { useCallback, type MutableRefObject } from "react";
import type { Audio } from "expo-av";
import {
  logShellSoundError,
  safeGetSoundStatus,
  safeSeekSoundRatio,
} from "../audio/safeShellSound";
import { publishScripturePlaybackSec } from "./scripturePlaybackSec";
import type { MusicPlaybackMode, MusicRepeatMode, ShellSleepTimerMinutes } from "./musicPlaybackTypes";
import { useMusicRepeatControls } from "./useMusicRepeatControls";
import { useMusicSleepTimerControl } from "./useMusicSleepTimerControl";

type Args = {
  soundRef: MutableRefObject<Audio.Sound | null>;
  playbackModeRef: MutableRefObject<MusicPlaybackMode>;
  musicGainRef: MutableRefObject<number>;
  musicRepeatModeRef: MutableRefObject<MusicRepeatMode>;
  lastMusicProgressSecRef: MutableRefObject<number>;
  lastScriptureProgressSecRef: MutableRefObject<number>;
  sleepTimerDeadlineRef: MutableRefObject<number | null>;
  musicRepeatMode: MusicRepeatMode;
  sleepTimerMinutes: 0 | ShellSleepTimerMinutes;
  setPlaying: (playing: boolean) => void;
  setMusicCurrentSec: (sec: number) => void;
  setScriptureCurrentSec: (sec: number) => void;
  setMusicRepeatModeState: (mode: MusicRepeatMode | ((prev: MusicRepeatMode) => MusicRepeatMode)) => void;
  setSleepTimerMinutesState: (minutes: 0 | ShellSleepTimerMinutes) => void;
};

export function useMusicShellControls(args: Args) {
  const {
    soundRef,
    playbackModeRef,
    musicGainRef,
    musicRepeatModeRef,
    lastMusicProgressSecRef,
    lastScriptureProgressSecRef,
    sleepTimerDeadlineRef,
    musicRepeatMode,
    sleepTimerMinutes,
    setPlaying,
    setMusicCurrentSec,
    setScriptureCurrentSec,
    setMusicRepeatModeState,
    setSleepTimerMinutesState,
  } = args;

  const { setMusicRepeatMode, toggleMusicRepeatOne, toggleMusicRepeatAll } = useMusicRepeatControls({
    musicRepeatModeRef,
    setMusicRepeatModeState,
  });

  const { setSleepTimerMinutes, pauseShellPlayback } = useMusicSleepTimerControl({
    soundRef,
    sleepTimerDeadlineRef,
    sleepTimerMinutes,
    setPlaying,
    setSleepTimerMinutesState,
  });

  const seekRatio = useCallback(async (ratio: number) => {
    const sound = soundRef.current;
    if (!sound) return;
    const st = await safeGetSoundStatus(sound);
    if (!st?.isLoaded || st.durationMillis == null || st.durationMillis <= 0) return;
    const clamped = Math.max(0, Math.min(1, ratio));
    const ok = await safeSeekSoundRatio(sound, clamped);
    if (!ok) return;
    const sec = clamped * (st.durationMillis / 1000);
    if (playbackModeRef.current === "music") {
      lastMusicProgressSecRef.current = sec;
      setMusicCurrentSec(sec);
    } else {
      publishScripturePlaybackSec(sec);
      lastScriptureProgressSecRef.current = sec;
      setScriptureCurrentSec(sec);
    }
  }, [
    lastMusicProgressSecRef,
    lastScriptureProgressSecRef,
    playbackModeRef,
    setMusicCurrentSec,
    setScriptureCurrentSec,
    soundRef,
  ]);

  const setMusicGain = useCallback(async (gain: number) => {
    const next = Math.max(0, Math.min(1, Number(gain)));
    musicGainRef.current = next;
    const sound = soundRef.current;
    if (!sound || playbackModeRef.current !== "music") return;
    const st = await safeGetSoundStatus(sound);
    if (!st?.isLoaded) return;
    try {
      await sound.setVolumeAsync(next);
    } catch (err) {
      logShellSoundError("setMusicGain", err);
    }
  }, [musicGainRef, playbackModeRef, soundRef]);

  return {
    musicRepeatMode,
    setMusicRepeatMode,
    toggleMusicRepeatOne,
    toggleMusicRepeatAll,
    sleepTimerMinutes,
    setSleepTimerMinutes,
    seekRatio,
    setMusicGain,
    pauseShellPlayback,
  };
}
