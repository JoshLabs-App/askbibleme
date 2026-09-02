import { useCallback, useRef, type MutableRefObject } from "react";
import type { AudioPlayer } from "expo-audio";
import {
  logShellSoundError,
  safeGetSoundStatus,
  safeSeekSoundRatio,
} from "../audio/safeShellSound";
import { isNativeMainTrackOs } from "../audio/shellNativeAudioTakeover";
import { seekShellMediaPosition, setShellMusicVolume } from "../audio/shellMediaControls";
import { publishScripturePlaybackSec } from "./scripturePlaybackSec";
import type { MusicPlaybackMode, MusicRepeatMode, ShellSleepTimerMinutes } from "./musicPlaybackTypes";
import { useMusicRepeatControls } from "./useMusicRepeatControls";
import { useMusicSleepTimerControl } from "./useMusicSleepTimerControl";

type Args = {
  soundRef: MutableRefObject<AudioPlayer | null>;
  playbackModeRef: MutableRefObject<MusicPlaybackMode>;
  playingStateRef: MutableRefObject<boolean>;
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
  scriptureDurationSec: number;
  musicDurationSec: number;
  setMusicRepeatModeState: (mode: MusicRepeatMode | ((prev: MusicRepeatMode) => MusicRepeatMode)) => void;
  setSleepTimerMinutesState: (minutes: 0 | ShellSleepTimerMinutes) => void;
};

export function useMusicShellControls(args: Args) {
  const {
    soundRef,
    playbackModeRef,
    playingStateRef,
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
    scriptureDurationSec,
    musicDurationSec,
    setMusicRepeatModeState,
    setSleepTimerMinutesState,
  } = args;

  const { setMusicRepeatMode, toggleMusicRepeatOne, toggleMusicRepeatAll } = useMusicRepeatControls({
    musicRepeatModeRef,
    setMusicRepeatModeState,
  });

  const { setSleepTimerMinutes, pauseShellPlayback } = useMusicSleepTimerControl({
    soundRef,
    playbackModeRef,
    playingStateRef,
    sleepTimerDeadlineRef,
    sleepTimerMinutes,
    setPlaying,
    setSleepTimerMinutesState,
  });

  const scriptureDurationSecRef = useRef(scriptureDurationSec);
  scriptureDurationSecRef.current = scriptureDurationSec;
  const musicDurationSecRef = useRef(musicDurationSec);
  musicDurationSecRef.current = musicDurationSec;

  const seekRatio = useCallback(async (ratio: number) => {
    const clamped = Math.max(0, Math.min(1, ratio));
    if (isNativeMainTrackOs()) {
      const mode = playbackModeRef.current;
      if (mode === "scripture") {
        const dur = scriptureDurationSecRef.current;
        if (dur > 0.05) {
          const sec = clamped * dur;
          if (seekShellMediaPosition(sec)) {
            publishScripturePlaybackSec(sec);
            lastScriptureProgressSecRef.current = sec;
            setScriptureCurrentSec(sec);
            return;
          }
        }
      } else if (mode === "music") {
        const dur = musicDurationSecRef.current;
        if (dur > 0.05) {
          const sec = clamped * dur;
          if (seekShellMediaPosition(sec)) {
            lastMusicProgressSecRef.current = sec;
            setMusicCurrentSec(sec);
            return;
          }
        }
      }
    }
    const sound = soundRef.current;
    if (!sound) return;
    const st = await safeGetSoundStatus(sound);
    if (!st?.isLoaded || st.durationMillis == null || st.durationMillis <= 0) return;
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
    // 原生主轨（iOS/Android）没有 expo-av sound，音量必须写到原生播放器。
    if (isNativeMainTrackOs()) setShellMusicVolume(next);
    const sound = soundRef.current;
    if (!sound || playbackModeRef.current !== "music") return;
    const st = await safeGetSoundStatus(sound);
    if (!st?.isLoaded) return;
    try {
      sound.volume = next;
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
