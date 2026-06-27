import type { MutableRefObject } from "react";
import { configureScriptureShellAudioMode } from "../audio/shellAudioMode";
import {
  resolveScriptureAvSource,
  resolveScriptureBundledModule,
} from "../audio/scriptureAudioPlayback";
import { readCuvChapterAudioVoice } from "../bible/cuv-chapter-audio-voice-prefs";
import { createScriptureSound } from "./scriptureSoundCreate";
import { isScripturePlayAttemptCurrent } from "./scripturePlaybackExclusive";
import { markScriptureWantPlaying } from "./scriptureResumeAfterInterruption";
import { clearScriptureChapterHandoff } from "./scripturePlaybackPriority";
import type {
  ReadChapterPlaybackRegistration,
  ScriptureAudioRepeatMode,
  ScriptureShellPlaybackBridge,
} from "./scripturePlaybackTypes";

type Args = {
  bridge: ScriptureShellPlaybackBridge;
  src: string;
  playSeq?: number;
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
  setScripturePreparing: (preparing: boolean) => void;
  setPlaybackMode: (mode: "music" | "scripture") => void;
  unloadCurrent: () => Promise<void>;
  skipInitialUnload?: boolean;
};

export type ScriptureSoundLoadResult = { ok: true } | { ok: false; stale: true } | { ok: false; stale: false };

export async function loadAndPlayScriptureSound({
  bridge,
  src,
  playSeq,
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
  setScripturePreparing,
  setPlaybackMode,
  unloadCurrent,
  skipInitialUnload = false,
}: Args): Promise<ScriptureSoundLoadResult> {
  const { soundRef, playbackEpochRef, playbackModeRef } = bridge;

  if (playSeq != null && !isScripturePlayAttemptCurrent(playSeq)) {
    return { ok: false, stale: true };
  }

  await (skipInitialUnload ? Promise.resolve() : unloadCurrent());
  if (playSeq != null && !isScripturePlayAttemptCurrent(playSeq)) {
    return { ok: false, stale: true };
  }
  await configureScriptureShellAudioMode();
  const epoch = playbackEpochRef.current;

  setPlaybackMode("scripture");
  playbackModeRef.current = "scripture";
  setScripturePreparing(true);

  const soundId = ++bridge.activeSoundIdRef.current;

  const rc = readChapterRef.current;
  const voiceId = rc ? await readCuvChapterAudioVoice() : undefined;
  const bundledModule = rc
    ? resolveScriptureBundledModule({
        translationId: rc.translationId,
        bookId: rc.bookId,
        chapter: rc.chapter,
        voiceId,
      })
    : null;
  const avSource = await resolveScriptureAvSource(src, bundledModule);
  if (!avSource) {
    setScripturePreparing(false);
    return { ok: false, stale: false };
  }
  if (__DEV__) {
    console.warn("[scripture-audio] playScripture source", src, bundledModule ?? "remote");
  }

  const created = await createScriptureSound({
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
  });

  if (!created.ok) {
    setScripturePreparing(false);
    if (!created.stale && __DEV__) {
      console.warn("[scripture-audio] play failed:", src);
    }
    return created;
  }

  if (playSeq != null && !isScripturePlayAttemptCurrent(playSeq)) {
    try {
      await created.sound.unloadAsync();
    } catch {
      /* ignore */
    }
    setScripturePreparing(false);
    return { ok: false, stale: true };
  }

  soundRef.current = created.sound;
  markScriptureWantPlaying(scriptureWantPlayingRef, true);
  clearScriptureChapterHandoff(scriptureChapterHandoffRef);
  setPlaying(true);
  setScripturePreparing(false);
  return { ok: true };
}
