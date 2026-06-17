import { Audio } from "expo-av";
import type { AVPlaybackSource } from "expo-av";
import type { MutableRefObject } from "react";
import { primeShellSoundPlayback, shellSoundDownloadFirst } from "../audio/shellAudioMode";
import { logShellSoundError } from "../audio/safeShellSound";
import { createScripturePlaybackStatusHandler } from "./scripturePlaybackStatus";
import type {
  ReadChapterPlaybackRegistration,
  ScriptureAudioRepeatMode,
  ScriptureShellPlaybackBridge,
} from "./scripturePlaybackTypes";

type CreateArgs = {
  bridge: ScriptureShellPlaybackBridge;
  avSource: AVPlaybackSource;
  soundId: number;
  epoch: number;
  readChapterRef: MutableRefObject<ReadChapterPlaybackRegistration | null>;
  scripturePlaybackRateRef: MutableRefObject<number>;
  scriptureAudioRepeatRef: MutableRefObject<ScriptureAudioRepeatMode>;
  lastScriptureProgressSecRef: MutableRefObject<number>;
  scriptureStopAtSecRef: MutableRefObject<number | null>;
  scriptureStopAtOnEndedRef: MutableRefObject<(() => void) | null>;
  autoPlayScriptureRef: MutableRefObject<boolean>;
  setPlaying: (playing: boolean) => void;
  setScriptureCurrentSec: (sec: number) => void;
  setScriptureDurationSec: (sec: number) => void;
  setPlaybackMode: (mode: "music" | "scripture") => void;
};

export type CreatedScriptureSound =
  | { ok: true; sound: Audio.Sound }
  | { ok: false; stale: true }
  | { ok: false; stale: false };

export async function createScriptureSound(args: CreateArgs): Promise<CreatedScriptureSound> {
  const {
    bridge,
    avSource,
    soundId,
    epoch,
    readChapterRef,
    scripturePlaybackRateRef,
    scriptureAudioRepeatRef,
    lastScriptureProgressSecRef,
    scriptureStopAtSecRef,
    scriptureStopAtOnEndedRef,
    autoPlayScriptureRef,
    setPlaying,
    setScriptureCurrentSec,
    setScriptureDurationSec,
    setPlaybackMode,
  } = args;

  const { activeSoundIdRef, playbackEpochRef, playbackModeRef } = bridge;

  let sound: Audio.Sound;
  try {
    const created = await Audio.Sound.createAsync(
      avSource,
      {
        shouldPlay: true,
        progressUpdateIntervalMillis: 350,
        volume: 1,
        isMuted: false,
        rate: scripturePlaybackRateRef.current,
        shouldCorrectPitch: true,
      },
      createScripturePlaybackStatusHandler({
        ...bridge,
        soundId,
        setPlaying,
        setScriptureCurrentSec,
        setScriptureDurationSec,
        lastScriptureProgressSecRef,
        scriptureStopAtSecRef,
        scriptureStopAtOnEndedRef,
        scriptureAudioRepeatRef,
        readChapterRef,
        autoPlayScriptureRef,
      }),
      shellSoundDownloadFirst(avSource),
    );
    sound = created.sound;
    await primeShellSoundPlayback(sound);
  } catch (err) {
    if (epoch === playbackEpochRef.current) {
      setPlaybackMode("music");
      playbackModeRef.current = "music";
      setPlaying(false);
    }
    logShellSoundError("playScripture-create", err);
    return { ok: false, stale: false };
  }

  if (epoch !== playbackEpochRef.current || soundId !== activeSoundIdRef.current) {
    await sound.unloadAsync();
    return { ok: false, stale: true };
  }

  return { ok: true, sound };
}
