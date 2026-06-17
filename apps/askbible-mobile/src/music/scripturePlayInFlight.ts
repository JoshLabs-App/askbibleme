import type { MutableRefObject } from "react";
import { loadAndPlayScriptureSound } from "./scripturePlaySound";
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
    "scripturePlayInFlightRef" | "scriptureSrcRef" | "scriptureStopAtSecRef" | "scriptureStopAtOnEndedRef" | "autoPlayScriptureRef"
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

  const prev = scripturePlayInFlightRef.current;
  if (prev) {
    try {
      await prev;
    } catch {
      /* superseded */
    }
  }

  const run = async () => {
    scriptureSrcRef.current = trimmed;
    scriptureStopAtSecRef.current = null;
    scriptureStopAtOnEndedRef.current = null;
    const loaded = await loadAndPlayScriptureSound({
      bridge,
      src: trimmed,
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
      setScripturePreparing,
      setPlaybackMode,
      unloadCurrent,
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
