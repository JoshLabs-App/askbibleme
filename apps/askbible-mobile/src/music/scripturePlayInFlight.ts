import type { MutableRefObject } from "react";
import { loadAndPlayScriptureSound } from "./scripturePlaySound";
import {
  beginScripturePlayAttempt,
  isScripturePlayAttemptCurrent,
} from "./scripturePlaybackExclusive";
import { resetScriptureChapterEndTracking } from "./scriptureChapterEnd";
import type {
  ReadChapterPlaybackRegistration,
  ScriptureAudioRepeatMode,
  ScriptureShellPlaybackBridge,
} from "./scripturePlaybackTypes";
import type { ScripturePlayEngineRefs } from "./useScripturePlayEngineRefs";

type Args = {
  src: string;
  bridge: ScriptureShellPlaybackBridge;
  readChapterRef: MutableRefObject<ReadChapterPlaybackRegistration | null>;
  scripturePlaybackRateRef: MutableRefObject<number>;
  scriptureAudioRepeatRef: MutableRefObject<ScriptureAudioRepeatMode>;
  lastScriptureProgressSecRef: MutableRefObject<number>;
  refs: Pick<
    ScripturePlayEngineRefs,
    | "scripturePlayInFlightRef"
    | "scriptureSrcRef"
    | "scriptureStopAtSecRef"
    | "scriptureStopAtOnEndedRef"
    | "autoPlayScriptureRef"
    | "scriptureWantPlayingRef"
    | "scriptureChapterEndHandledRef"
    | "scriptureChapterHandoffRef"
    | "scriptureLastProgressMsRef"
    | "scriptureLastProgressAtRef"
  >;
  setPlaying: (playing: boolean) => void;
  setScriptureCurrentSec: (sec: number) => void;
  setScriptureDurationSec: (sec: number) => void;
  setScripturePreparing: (preparing: boolean) => void;
  setPlaybackMode: (mode: "music" | "scripture") => void;
  unloadCurrent: () => Promise<void>;
};

export async function runScripturePlayInFlight(args: Args): Promise<void> {
  const {
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
  } = args;

  const trimmed = src.trim();
  if (!trimmed) return;

  const { scripturePlayInFlightRef, scriptureSrcRef, scriptureStopAtSecRef, scriptureStopAtOnEndedRef, autoPlayScriptureRef } =
    refs;

  const playSeq = beginScripturePlayAttempt();
  await unloadCurrent();

  const prev = scripturePlayInFlightRef.current;
  if (prev) {
    try {
      await prev;
    } catch {
      /* superseded */
    }
  }
  if (!isScripturePlayAttemptCurrent(playSeq)) return;

  const run = async () => {
    if (!isScripturePlayAttemptCurrent(playSeq)) return;
    resetScriptureChapterEndTracking(
      refs.scriptureChapterEndHandledRef,
      refs.scriptureLastProgressMsRef,
      refs.scriptureLastProgressAtRef,
    );
    scriptureSrcRef.current = trimmed;
    scriptureStopAtSecRef.current = null;
    scriptureStopAtOnEndedRef.current = null;
    const loaded = await loadAndPlayScriptureSound({
      bridge,
      src: trimmed,
      playSeq,
      readChapterRef,
      scripturePlaybackRateRef,
      scriptureAudioRepeatRef,
      lastScriptureProgressSecRef,
      scriptureStopAtSecRef,
      scriptureStopAtOnEndedRef,
      autoPlayScriptureRef: refs.autoPlayScriptureRef,
      scriptureWantPlayingRef: refs.scriptureWantPlayingRef,
      scripturePlayInFlightRef: refs.scripturePlayInFlightRef,
      scriptureChapterEndHandledRef: refs.scriptureChapterEndHandledRef,
      scriptureChapterHandoffRef: refs.scriptureChapterHandoffRef,
      scriptureLastProgressMsRef: refs.scriptureLastProgressMsRef,
      scriptureLastProgressAtRef: refs.scriptureLastProgressAtRef,
      scriptureSrcRef: refs.scriptureSrcRef,
      setPlaying,
      setScriptureCurrentSec,
      setScriptureDurationSec,
      setScripturePreparing,
      setPlaybackMode,
      unloadCurrent,
      skipInitialUnload: true,
    });
    if (!loaded.ok && !loaded.stale) {
      scriptureSrcRef.current = null;
    }
  };

  const op = run();
  scripturePlayInFlightRef.current = op;
  try {
    await op;
  } finally {
    if (scripturePlayInFlightRef.current === op) {
      scripturePlayInFlightRef.current = null;
    }
  }
}
