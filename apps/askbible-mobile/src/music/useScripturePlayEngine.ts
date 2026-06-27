import { useCallback } from "react";
import { runScripturePlayInFlight } from "./scripturePlayInFlight";
import {
  patchReadChapterSrc as patchReadChapterSrcHelper,
  tryPlayScriptureWithFallback as tryPlayScriptureWithFallbackHelper,
} from "./scripturePlayFallback";
import { markScriptureWantPlaying, clearScriptureResumeTimer } from "./scriptureResumeAfterInterruption";
import { beginScripturePlayAttempt, isScripturePlaybackBusy } from "./scripturePlaybackExclusive";
import { isScripturePlaybackStarted } from "./scripturePlaybackHelpers";
import { resetScriptureChapterEndTracking } from "./scriptureChapterEnd";
import { clearScriptureChapterHandoff } from "./scripturePlaybackPriority";
import { publishScripturePlaybackSec } from "./scripturePlaybackSec";
import { endPlanFlowChapterAdvance, consumeReadPlanFlowAutoplay, clearPlanFlowSessionActive } from "../read/read-plan-flow-autoplay";
import { scriptureChapterPool } from "./scripture-chapter-pool";
import type {
  ReadChapterPlaybackRegistration,
  ScriptureAudioRepeatMode,
  ScriptureShellPlaybackBridge,
} from "./scripturePlaybackTypes";
import { useScripturePlayEngineRefs } from "./useScripturePlayEngineRefs";
import type { MutableRefObject } from "react";

type Args = {
  bridge: ScriptureShellPlaybackBridge;
  readChapterRef: MutableRefObject<ReadChapterPlaybackRegistration | null>;
  setReadChapter: (reg: ReadChapterPlaybackRegistration | null) => void;
  setPlaying: (playing: boolean) => void;
  setPlaybackMode: (mode: "music" | "scripture") => void;
  setScripturePreparing: (preparing: boolean) => void;
  setScriptureCurrentSec: (sec: number) => void;
  setScriptureDurationSec: (sec: number) => void;
  scripturePlaybackRateRef: MutableRefObject<number>;
  scriptureAudioRepeatRef: MutableRefObject<ScriptureAudioRepeatMode>;
  lastScriptureProgressSecRef: MutableRefObject<number>;
};

export function useScripturePlayEngine({
  bridge,
  readChapterRef,
  setReadChapter,
  setPlaying,
  setPlaybackMode,
  setScripturePreparing,
  setScriptureCurrentSec,
  setScriptureDurationSec,
  scripturePlaybackRateRef,
  scriptureAudioRepeatRef,
  lastScriptureProgressSecRef,
}: Args) {
  const { playbackModeRef, unloadCurrent, endMusicSession } = bridge;
  const refs = useScripturePlayEngineRefs();
  const { scriptureSrcRef } = refs;

  const isStarted = useCallback(
    () => isScripturePlaybackStarted({ playbackModeRef, soundRef: bridge.soundRef, scriptureSrcRef }),
    [bridge.soundRef, playbackModeRef, scriptureSrcRef],
  );

  const stopScripturePlayback = useCallback(async () => {
    scriptureChapterPool.stop();
    markScriptureWantPlaying(refs.scriptureWantPlayingRef, false);
    refs.autoPlayScriptureRef.current = false;
    consumeReadPlanFlowAutoplay();
    clearPlanFlowSessionActive();
    beginScripturePlayAttempt();
    refs.scripturePlayInFlightRef.current = null;
    clearScriptureResumeTimer();
    endPlanFlowChapterAdvance();
    clearScriptureChapterHandoff(refs.scriptureChapterHandoffRef);
    resetScriptureChapterEndTracking(
      refs.scriptureChapterEndHandledRef,
      refs.scriptureLastProgressMsRef,
      refs.scriptureLastProgressAtRef,
    );
    setScripturePreparing(false);
    endMusicSession();
    await unloadCurrent();
    scriptureSrcRef.current = null;
    refs.scriptureStopAtSecRef.current = null;
    publishScripturePlaybackSec(0);
    lastScriptureProgressSecRef.current = -1;
    setScriptureCurrentSec(0);
    setScriptureDurationSec(0);
    setPlaying(false);
    setPlaybackMode("music");
    playbackModeRef.current = "music";
  }, [
    endMusicSession,
    lastScriptureProgressSecRef,
    playbackModeRef,
    refs.scriptureChapterEndHandledRef,
    refs.scriptureLastProgressAtRef,
    refs.scriptureLastProgressMsRef,
    refs.scripturePlayInFlightRef,
    refs.scriptureStopAtSecRef,
    refs.autoPlayScriptureRef,
    refs.scriptureChapterHandoffRef,
    refs.scriptureWantPlayingRef,
    scriptureSrcRef,
    setPlaybackMode,
    setPlaying,
    setScriptureCurrentSec,
    setScriptureDurationSec,
    setScripturePreparing,
    unloadCurrent,
  ]);

  const patchReadChapterSrc = useCallback(
    (src: string) => {
      patchReadChapterSrcHelper({ src, readChapterRef, setReadChapter });
    },
    [readChapterRef, setReadChapter],
  );

  const playScripture = useCallback(
    (src: string) =>
      runScripturePlayInFlight({
        src,
        bridge,
        readChapterRef,
        scripturePlaybackRateRef,
        scriptureAudioRepeatRef,
        lastScriptureProgressSecRef,
        refs,
        setPlaying,
        setScriptureCurrentSec,
        setScriptureDurationSec,
        setScripturePreparing,
        setPlaybackMode,
        unloadCurrent,
      }),
    [
      bridge,
      lastScriptureProgressSecRef,
      readChapterRef,
      refs,
      scriptureAudioRepeatRef,
      scripturePlaybackRateRef,
      setPlaybackMode,
      setPlaying,
      setScriptureCurrentSec,
      setScriptureDurationSec,
      setScripturePreparing,
      unloadCurrent,
    ],
  );

  const tryPlayScriptureWithFallback = useCallback(
    async (
      reg: ReadChapterPlaybackRegistration,
      preferredSrc: string,
      playingReg?: ReadChapterPlaybackRegistration | null,
    ): Promise<boolean> => {
      return tryPlayScriptureWithFallbackHelper({
        reg,
        preferredSrc,
        playScripture,
        patchReadChapterSrc,
        isStarted,
        playingReg: playingReg !== undefined ? playingReg : readChapterRef.current,
        isBusy: () =>
          isScripturePlaybackBusy({
            playbackModeRef,
            soundRef: bridge.soundRef,
            scripturePlayInFlightRef: refs.scripturePlayInFlightRef,
          }),
      });
    },
    [bridge.soundRef, isStarted, patchReadChapterSrc, playbackModeRef, playScripture, readChapterRef, refs.scripturePlayInFlightRef],
  );

  return {
    ...refs,
    isStarted,
    stopScripturePlayback,
    patchReadChapterSrc,
    playScripture,
    tryPlayScriptureWithFallback,
  };
}
