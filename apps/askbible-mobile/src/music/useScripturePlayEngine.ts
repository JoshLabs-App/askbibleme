import { getShellPlaybackMode } from "../audio/playbackState";
import { useCallback } from "react";
import type { MutableRefObject } from "react";
import { setShellNativeAudioTakeover } from "../audio/shellNativeAudioTakeover";
import { pauseShellAppMusic } from "../audio/shellMediaControls";
import { setShellScriptureWantPlaying } from "../audio/shellScriptureWantPlaying";
import { endPlanFlowChapterAdvance, consumeReadPlanFlowAutoplay, clearPlanFlowSessionActive } from "../read/read-plan-flow-autoplay";
import { resetScriptureChapterEndTracking } from "./scriptureChapterEnd";
import { beginScripturePlayAttempt, isScripturePlaybackBusy } from "./scripturePlaybackExclusive";
import { isScripturePlaybackStarted } from "./scripturePlaybackHelpers";
import {
  patchReadChapterSrc as patchReadChapterSrcHelper,
  tryPlayScriptureWithFallback as tryPlayScriptureWithFallbackHelper,
} from "./scripturePlayFallback";
import { runScripturePlayInFlight } from "./scripturePlayInFlight";
import { clearScriptureChapterHandoff } from "./scripturePlaybackPriority";
import { publishScripturePlaybackSec, setScripturePlaybackClockPlaying } from "./scripturePlaybackSec";
import { clearScripturePlayingChapter } from "./scripturePlayingChapterStore";
import { clearPlayingReadChapterPlayback } from "../read/read-chapter-playback-store";
import { markScriptureWantPlaying, clearScriptureResumeTimer } from "./scriptureResumeAfterInterruption";
import { scriptureChapterPool } from "./scripture-chapter-pool";
import type {
  ReadChapterPlaybackRegistration,
  ScriptureAudioRepeatMode,
  ScriptureShellPlaybackBridge,
} from "./scripturePlaybackTypes";
import { useIosNativeScriptureEnded } from "./useIosNativeScriptureEnded";
import { useScriptureFollowNativeChapter } from "./useScriptureFollowNativeChapter";
import { useScripturePlayEngineRefs } from "./useScripturePlayEngineRefs";

type Args = {
  bridge: ScriptureShellPlaybackBridge;
  readChapterRef: MutableRefObject<ReadChapterPlaybackRegistration | null>;
  setReadChapter: (reg: ReadChapterPlaybackRegistration | null) => void;
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
  setPlaybackMode,
  setScripturePreparing,
  setScriptureCurrentSec,
  setScriptureDurationSec,
  scripturePlaybackRateRef,
  scriptureAudioRepeatRef,
  lastScriptureProgressSecRef,
}: Args) {
  const { unloadCurrent, endMusicSession } = bridge;
  const refs = useScripturePlayEngineRefs();
  const { scriptureSrcRef } = refs;

  const isStarted = useCallback(
    () => isScripturePlaybackStarted({ soundRef: bridge.soundRef, scriptureSrcRef }),
    [bridge.soundRef, scriptureSrcRef],
  );

  useIosNativeScriptureEnded({
    soundRef: bridge.soundRef,
    scriptureSrcRef,
    scriptureAudioRepeatRef,
    readChapterRef,
    autoPlayScriptureRef: refs.autoPlayScriptureRef,
    scriptureChapterHandoffRef: refs.scriptureChapterHandoffRef,
    scriptureWantPlayingRef: refs.scriptureWantPlayingRef,
    scriptureStopAtOnEndedRef: refs.scriptureStopAtOnEndedRef,
    scripturePlaybackRateRef,
    setReadChapter,
  });

  /** 跟随原生正在朗读的章：同步界面与今日计划，队列见底时补货。 */
  useScriptureFollowNativeChapter({
    scriptureSrcRef,
    scriptureAudioRepeatRef,
    scripturePlaybackRateRef,
    readChapterRef,
    setReadChapter,
  });

  const stopScripturePlayback = useCallback(async () => {
    scriptureChapterPool.stop();
    markScriptureWantPlaying(refs.scriptureWantPlayingRef, false);
    setShellScriptureWantPlaying(false);
    pauseShellAppMusic();
    setShellNativeAudioTakeover(false);
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
    setScripturePlaybackClockPlaying(false);
    lastScriptureProgressSecRef.current = -1;
    setScriptureCurrentSec(0);
    setScriptureDurationSec(0);
    clearScripturePlayingChapter();
    clearPlayingReadChapterPlayback();
    setPlaybackMode("music");
  }, [
    endMusicSession,
    lastScriptureProgressSecRef,
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
        soundRef: bridge.soundRef,
        playingReg: playingReg !== undefined ? playingReg : readChapterRef.current,
        isBusy: () =>
          isScripturePlaybackBusy({
            soundRef: bridge.soundRef,
            scripturePlayInFlightRef: refs.scripturePlayInFlightRef,
          }),
      });
    },
    [bridge.soundRef, isStarted, patchReadChapterSrc, playScripture, readChapterRef, refs.scripturePlayInFlightRef],
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
