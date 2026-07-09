import { Audio } from "expo-av";
import type { AVPlaybackSource } from "expo-av";
import type { MutableRefObject } from "react";
import { primeShellSoundPlayback, shellSoundDownloadFirst } from "../audio/shellAudioMode";
import { logShellSoundError } from "../audio/safeShellSound";
import { syncShellMediaSessionExplicit } from "../audio/shellMediaControls";
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
  scriptureWantPlayingRef: MutableRefObject<boolean>;
  scripturePlayInFlightRef: MutableRefObject<Promise<void> | null>;
  scriptureChapterEndHandledRef: MutableRefObject<boolean>;
  scriptureChapterHandoffRef: MutableRefObject<boolean>;
  scriptureLastProgressMsRef: MutableRefObject<number>;
  scriptureLastProgressAtRef: MutableRefObject<number>;
  scriptureSrcRef: MutableRefObject<string | null>;
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
    scriptureWantPlayingRef,
    scripturePlayInFlightRef,
    scriptureChapterEndHandledRef,
    scriptureChapterHandoffRef,
    scriptureLastProgressMsRef,
    scriptureLastProgressAtRef,
    scriptureSrcRef,
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
        scriptureWantPlayingRef,
        scripturePlayInFlightRef,
        scriptureChapterEndHandledRef,
        scriptureChapterHandoffRef,
        scriptureLastProgressMsRef,
        scriptureLastProgressAtRef,
        scriptureSrcRef,
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

  const chapter = readChapterRef.current;
  const playingStatus = await sound.getStatusAsync();
  if (playingStatus.isLoaded && chapter) {
    syncShellMediaSessionExplicit({
      title: `${chapter.bookName} ${chapter.chapter}`,
      artist: "AskBible.me",
      album: chapter.translationId,
      assetUri: chapter.chapterAudioSrc,
      durationSec: playingStatus.durationMillis != null ? playingStatus.durationMillis / 1000 : 0,
      positionSec: playingStatus.positionMillis / 1000,
      playing: playingStatus.isPlaying,
    });
  }

  return { ok: true, sound };
}
