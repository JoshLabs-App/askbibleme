import { getShellPlaybackMode } from "../audio/playbackState";
import { useCallback, useRef, type MutableRefObject } from "react";
import type { AudioPlayer } from "expo-audio";
import {
  logShellSoundError,
  safeGetSoundStatus,
  safeSeekSoundRatio,
} from "../audio/safeShellSound";
import { seekShellMediaPosition, setShellMusicVolume } from "../audio/shellMediaControls";
import { publishScripturePlaybackSec } from "./scripturePlaybackSec";
import type { MusicPlaybackMode, MusicRepeatMode, ShellSleepTimerMinutes } from "./musicPlaybackTypes";
import { useMusicRepeatControls } from "./useMusicRepeatControls";
import { useMusicSleepTimerControl } from "./useMusicSleepTimerControl";

type Args = {
  soundRef: MutableRefObject<AudioPlayer | null>;
  musicGainRef: MutableRefObject<number>;
  musicRepeatModeRef: MutableRefObject<MusicRepeatMode>;
  lastMusicProgressSecRef: MutableRefObject<number>;
  lastScriptureProgressSecRef: MutableRefObject<number>;
  sleepTimerDeadlineRef: MutableRefObject<number | null>;
  musicRepeatMode: MusicRepeatMode;
  sleepTimerMinutes: 0 | ShellSleepTimerMinutes;
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
    musicGainRef,
    musicRepeatModeRef,
    lastMusicProgressSecRef,
    lastScriptureProgressSecRef,
    sleepTimerDeadlineRef,
    musicRepeatMode,
    sleepTimerMinutes,
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
    sleepTimerDeadlineRef,
    sleepTimerMinutes,
    setSleepTimerMinutesState,
  });

  const scriptureDurationSecRef = useRef(scriptureDurationSec);
  scriptureDurationSecRef.current = scriptureDurationSec;
  const musicDurationSecRef = useRef(musicDurationSec);
  musicDurationSecRef.current = musicDurationSec;

  const seekRatio = useCallback(async (ratio: number) => {
    const clamped = Math.max(0, Math.min(1, ratio));
    {
      const mode = getShellPlaybackMode();
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
    /** 跳转一律经原生播放器；expo-av 那条尾巴已删。 */
  }, [
    lastMusicProgressSecRef,
    lastScriptureProgressSecRef,
    setMusicCurrentSec,
    setScriptureCurrentSec,
    soundRef,
  ]);

  const setMusicGain = useCallback(async (gain: number) => {
    const next = Math.max(0, Math.min(1, Number(gain)));
    musicGainRef.current = next;
    /** 音量写到原生播放器。expo-av 那条回退路径已删——真机上音频一律走原生。 */
    setShellMusicVolume(next);
  }, [musicGainRef]);

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
