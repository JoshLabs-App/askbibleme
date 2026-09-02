import { createAudioPlayer, type AudioPlayer, type AudioSource } from "expo-audio";
import { toLegacyPlaybackStatus } from "../audio/legacyPlaybackStatus";
import { waitForAudioPlayerLoaded } from "../audio/expoAudioPlayerReady";
import type { MutableRefObject } from "react";
import { Platform } from "react-native";
import { primeShellSoundPlayback, shellSoundDownloadFirst } from "../audio/shellAudioMode";
import { logShellSoundError } from "../audio/safeShellSound";
import { syncShellMediaSessionExplicit } from "../audio/shellMediaControls";
import { createScripturePlaybackStatusHandler } from "./scripturePlaybackStatus";
import { clearScripturePlayingChapter } from "./scripturePlayingChapterStore";
import type {
  ReadChapterPlaybackRegistration,
  ScriptureAudioRepeatMode,
  ScriptureShellPlaybackBridge,
} from "./scripturePlaybackTypes";

type CreateArgs = {
  bridge: ScriptureShellPlaybackBridge;
  avSource: AudioSource;
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
  | { ok: true; sound: AudioPlayer }
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

  let sound: AudioPlayer;
  try {
    sound = createAudioPlayer(avSource, {
      updateInterval: Platform.OS === "android" ? 400 : 500,
      downloadFirst: shellSoundDownloadFirst(avSource),
    });
    sound.volume = 1;
    sound.muted = false;
    sound.addListener("playbackStatusUpdate", (raw) => {
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
      })(toLegacyPlaybackStatus(raw, sound.volume, sound.muted));
    });
    await waitForAudioPlayerLoaded(sound);
    sound.setPlaybackRate(scripturePlaybackRateRef.current, "high");
    sound.play();
    await primeShellSoundPlayback(sound);
  } catch (err) {
    if (epoch === playbackEpochRef.current) {
      setPlaybackMode("music");
      playbackModeRef.current = "music";
      setPlaying(false);
      clearScripturePlayingChapter();
    }
    logShellSoundError("playScripture-create", err);
    return { ok: false, stale: false };
  }

  if (epoch !== playbackEpochRef.current || soundId !== activeSoundIdRef.current) {
    sound.remove();
    return { ok: false, stale: true };
  }

  const chapter = readChapterRef.current;
  const playingStatus = toLegacyPlaybackStatus(sound.currentStatus, sound.volume, sound.muted);
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
