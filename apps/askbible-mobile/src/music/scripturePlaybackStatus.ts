import type { AVPlaybackStatus } from "expo-av";
import type { MutableRefObject } from "react";
import { SCRIPTURE_PROGRESS_UI_INTERVAL_SEC, shouldEmitPlaybackSecUpdate } from "./musicPlaybackProgress";
import {
  finishScriptureChapterOnce,
  isScriptureChapterEndStalled,
  isScriptureNearChapterEnd,
  noteScripturePlaybackProgress,
  shouldScheduleScriptureMidChapterResume,
} from "./scriptureChapterEnd";
import { handleScriptureStopAtStatus } from "./scripturePlaybackStopAt";
import { publishScripturePlaybackSec } from "./scripturePlaybackSec";
import {
  scheduleScriptureResumeAfterInterruption,
  type ScriptureResumeCtx,
} from "./scriptureResumeAfterInterruption";
import type {
  ReadChapterPlaybackRegistration,
  ScriptureAudioRepeatMode,
  ScriptureShellPlaybackBridge,
} from "./scripturePlaybackTypes";

type StatusHandlerArgs = ScriptureShellPlaybackBridge &
  ScriptureResumeCtx & {
  soundId: number;
  setPlaying: (playing: boolean) => void;
  setScriptureCurrentSec: (sec: number) => void;
  setScriptureDurationSec: (sec: number) => void;
  lastScriptureProgressSecRef: MutableRefObject<number>;
  scriptureStopAtSecRef: MutableRefObject<number | null>;
  scriptureStopAtOnEndedRef: MutableRefObject<(() => void) | null>;
  scriptureAudioRepeatRef: MutableRefObject<ScriptureAudioRepeatMode>;
  readChapterRef: MutableRefObject<ReadChapterPlaybackRegistration | null>;
  autoPlayScriptureRef: MutableRefObject<boolean>;
  scriptureChapterHandoffRef: MutableRefObject<boolean>;
  scriptureChapterEndHandledRef: MutableRefObject<boolean>;
  scriptureLastProgressMsRef: MutableRefObject<number>;
  scriptureLastProgressAtRef: MutableRefObject<number>;
};

export function createScripturePlaybackStatusHandler(
  args: StatusHandlerArgs,
): (status: AVPlaybackStatus) => void {
  const {
    soundId,
    activeSoundIdRef,
    soundRef,
    playbackModeRef,
    setPlaying,
    lastScriptureProgressSecRef,
    setScriptureCurrentSec,
    setScriptureDurationSec,
    scriptureStopAtSecRef,
    scriptureStopAtOnEndedRef,
    scriptureAudioRepeatRef,
    readChapterRef,
    autoPlayScriptureRef,
    scriptureChapterHandoffRef,
    scriptureWantPlayingRef,
    scripturePlayInFlightRef,
    scriptureChapterEndHandledRef,
    scriptureLastProgressMsRef,
    scriptureLastProgressAtRef,
  } = args;

  const finishArgs = {
    soundRef,
    scriptureAudioRepeatRef,
    readChapterRef,
    autoPlayScriptureRef,
    scriptureChapterHandoffRef,
    setPlaying,
    chapterEndHandledRef: scriptureChapterEndHandledRef,
  };

  return (status: AVPlaybackStatus) => {
    if (soundId !== activeSoundIdRef.current) return;
    if (!status.isLoaded) {
      if ("error" in status && status.error) {
        setPlaying(false);
      }
      return;
    }
    setPlaying(status.isPlaying);
    const scriptureSec = status.positionMillis / 1000;
    publishScripturePlaybackSec(scriptureSec);
    if (
      shouldEmitPlaybackSecUpdate(
        lastScriptureProgressSecRef,
        scriptureSec,
        SCRIPTURE_PROGRESS_UI_INTERVAL_SEC,
      )
    ) {
      setScriptureCurrentSec(scriptureSec);
    }
    setScriptureDurationSec(status.durationMillis != null ? status.durationMillis / 1000 : 0);

    if (
      handleScriptureStopAtStatus({
        status,
        soundRef,
        scriptureStopAtSecRef,
        scriptureStopAtOnEndedRef,
        setPlaying,
      })
    ) {
      return;
    }

    const durationMs = status.durationMillis ?? 0;
    const positionMs = status.positionMillis ?? 0;
    noteScripturePlaybackProgress(positionMs, scriptureLastProgressMsRef, scriptureLastProgressAtRef);

    if (status.didJustFinish) {
      finishScriptureChapterOnce(finishArgs);
      return;
    }

    const nearEnd = durationMs > 0 && isScriptureNearChapterEnd(positionMs, durationMs);
    const wantContinue =
      scriptureWantPlayingRef.current && playbackModeRef.current === "scripture";

    if (nearEnd && wantContinue) {
      if (
        !status.isPlaying ||
        isScriptureChapterEndStalled(
          positionMs,
          durationMs,
          scriptureLastProgressMsRef,
          scriptureLastProgressAtRef,
        )
      ) {
        if (finishScriptureChapterOnce(finishArgs)) {
          return;
        }
      }
    }

    if (
      !status.isPlaying &&
      scriptureWantPlayingRef.current &&
      playbackModeRef.current === "scripture" &&
      shouldScheduleScriptureMidChapterResume(positionMs, durationMs)
    ) {
      scheduleScriptureResumeAfterInterruption({
        playbackModeRef,
        soundRef,
        scriptureWantPlayingRef,
        scripturePlayInFlightRef,
        scriptureStopAtSecRef,
        setPlaying,
      });
    }
  };
}
