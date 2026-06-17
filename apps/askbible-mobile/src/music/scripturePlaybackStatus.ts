import type { AVPlaybackStatus } from "expo-av";
import type { MutableRefObject } from "react";
import { SCRIPTURE_PROGRESS_UI_INTERVAL_SEC, shouldEmitPlaybackSecUpdate } from "./musicPlaybackProgress";
import { handleScriptureDidJustFinish } from "./scripturePlaybackFinish";
import { handleScriptureStopAtStatus } from "./scripturePlaybackStopAt";
import { publishScripturePlaybackSec } from "./scripturePlaybackSec";
import type {
  ReadChapterPlaybackRegistration,
  ScriptureAudioRepeatMode,
  ScriptureShellPlaybackBridge,
} from "./scripturePlaybackTypes";

type StatusHandlerArgs = ScriptureShellPlaybackBridge & {
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
};

export function createScripturePlaybackStatusHandler(
  args: StatusHandlerArgs,
): (status: AVPlaybackStatus) => void {
  const {
    soundId,
    activeSoundIdRef,
    soundRef,
    setPlaying,
    lastScriptureProgressSecRef,
    setScriptureCurrentSec,
    setScriptureDurationSec,
    scriptureStopAtSecRef,
    scriptureStopAtOnEndedRef,
    scriptureAudioRepeatRef,
    readChapterRef,
    autoPlayScriptureRef,
  } = args;

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

    if (status.didJustFinish) {
      handleScriptureDidJustFinish({
        soundRef,
        scriptureAudioRepeatRef,
        readChapterRef,
        autoPlayScriptureRef,
        setPlaying,
      });
    }
  };
}
