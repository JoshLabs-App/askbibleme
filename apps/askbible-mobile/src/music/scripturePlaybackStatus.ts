import type { LegacyPlaybackStatus } from "../audio/legacyPlaybackStatus";
import type { MutableRefObject } from "react";
import { refreshShellMediaSession } from "../audio/shellMediaSessionPayload";
import { safePauseSound } from "../audio/safeShellSound";
import { SCRIPTURE_PROGRESS_UI_INTERVAL_SEC, shouldEmitPlaybackSecUpdate } from "./musicPlaybackProgress";
import {
  finishScriptureChapterOnce,
  isScriptureChapterEndStalled,
  isScriptureNearChapterEnd,
  noteScripturePlaybackProgress,
  shouldScheduleScriptureMidChapterResume,
} from "./scriptureChapterEnd";
import { handleScriptureStopAtStatus } from "./scripturePlaybackStopAt";
import { publishScripturePlaybackSec, setScripturePlaybackClockPlaying } from "./scripturePlaybackSec";
import { noteScriptureListenProgress } from "../read/scripture-listen-totals";
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
  scriptureSrcRef: MutableRefObject<string | null>;
};

export function createScripturePlaybackStatusHandler(
  args: StatusHandlerArgs,
): (status: LegacyPlaybackStatus) => void {
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
    scriptureSrcRef,
  } = args;

  const finishArgs = {
    soundRef,
    scriptureSrcRef,
    scriptureAudioRepeatRef,
    readChapterRef,
    autoPlayScriptureRef,
    scriptureChapterHandoffRef,
    scriptureWantPlayingRef,
    setPlaying,
    chapterEndHandledRef: scriptureChapterEndHandledRef,
  };

  return (status: LegacyPlaybackStatus) => {
    if (soundId !== activeSoundIdRef.current) return;
    if (!status.isLoaded) {
      if ("error" in status && status.error) {
        setPlaying(false);
      }
      return;
    }
    // 用户已暂停（wantPlaying=false）时，真机偶发迟到的 isPlaying=true，勿把 UI 拉回播放。
    const scriptureWantPlaying =
      playbackModeRef.current === "scripture" ? scriptureWantPlayingRef.current : true;
    const uiPlaying = scriptureWantPlaying ? status.isPlaying : false;
    if (playbackModeRef.current === "scripture") {
      setScripturePlaybackClockPlaying(
        uiPlaying,
        status.isLoaded && typeof status.rate === "number" && status.rate > 0 ? status.rate : 1,
      );
    }
    if (playbackModeRef.current === "scripture" && !scriptureWantPlaying) {
      setPlaying(false);
      if (status.isPlaying && soundRef.current) {
        void safePauseSound(soundRef.current);
      }
    } else {
      setPlaying(status.isPlaying);
    }
    const scriptureSec = status.positionMillis / 1000;
    if (playbackModeRef.current === "scripture") {
      noteScriptureListenProgress(scriptureSec, uiPlaying);
      const durationSec = status.durationMillis != null ? status.durationMillis / 1000 : 0;
      const shouldRefreshSession =
        !uiPlaying ||
        shouldEmitPlaybackSecUpdate(
          lastScriptureProgressSecRef,
          scriptureSec,
          SCRIPTURE_PROGRESS_UI_INTERVAL_SEC,
        );
      if (shouldRefreshSession) {
        refreshShellMediaSession({
          playing: uiPlaying,
          scriptureCurrentSec: scriptureSec,
          scriptureDurationSec: durationSec,
        });
      }
      publishScripturePlaybackSec(scriptureSec);
      if (shouldRefreshSession) {
        setScriptureCurrentSec(scriptureSec);
      }
      setScriptureDurationSec(durationSec);
    } else {
      publishScripturePlaybackSec(scriptureSec);
    }
    if (playbackModeRef.current !== "scripture") {
      setScriptureDurationSec(status.durationMillis != null ? status.durationMillis / 1000 : 0);
    }

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
