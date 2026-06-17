import { useCallback, useRef, type MutableRefObject } from "react";
import { getActiveReadChapterPlayback } from "../read/read-chapter-playback-store";
import {
  playScriptureChapterAt,
  registerReadChapterPlayback,
  toggleScripturePlayback,
  type PlayScriptureChapterFn,
} from "./scriptureChapterPlayback";
import { useScripturePlayEngine } from "./useScripturePlayEngine";
import type {
  ReadChapterPlaybackRegistration,
  ScriptureAudioRepeatMode,
  ScriptureShellPlaybackBridge,
} from "./scripturePlaybackTypes";

type Args = {
  bridge: ScriptureShellPlaybackBridge;
  readChapter: ReadChapterPlaybackRegistration | null;
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

export function useScriptureShellPlayback(args: Args) {
  const readChapterRef = useRef<ReadChapterPlaybackRegistration | null>(null);
  readChapterRef.current = args.readChapter;

  const engine = useScripturePlayEngine({ ...args, readChapterRef });

  const chapterCtxRef = useRef({
    ...args.bridge,
    readChapter: args.readChapter,
    readChapterRef,
    lastScriptureProgressSecRef: args.lastScriptureProgressSecRef,
    setReadChapter: args.setReadChapter,
    setPlaying: args.setPlaying,
    setScriptureCurrentSec: args.setScriptureCurrentSec,
    autoPlayScriptureRef: engine.autoPlayScriptureRef,
    scripturePlayInFlightRef: engine.scripturePlayInFlightRef,
    scriptureSrcRef: engine.scriptureSrcRef,
    scriptureStopAtSecRef: engine.scriptureStopAtSecRef,
    scriptureStopAtOnEndedRef: engine.scriptureStopAtOnEndedRef,
    patchReadChapterSrc: engine.patchReadChapterSrc,
    tryPlayScriptureWithFallback: engine.tryPlayScriptureWithFallback,
    playScripture: engine.playScripture,
    isStarted: engine.isStarted,
    stopScripturePlayback: engine.stopScripturePlayback,
  });
  chapterCtxRef.current = {
    ...args.bridge,
    readChapter: args.readChapter,
    readChapterRef,
    lastScriptureProgressSecRef: args.lastScriptureProgressSecRef,
    setReadChapter: args.setReadChapter,
    setPlaying: args.setPlaying,
    setScriptureCurrentSec: args.setScriptureCurrentSec,
    autoPlayScriptureRef: engine.autoPlayScriptureRef,
    scripturePlayInFlightRef: engine.scripturePlayInFlightRef,
    scriptureSrcRef: engine.scriptureSrcRef,
    scriptureStopAtSecRef: engine.scriptureStopAtSecRef,
    scriptureStopAtOnEndedRef: engine.scriptureStopAtOnEndedRef,
    patchReadChapterSrc: engine.patchReadChapterSrc,
    tryPlayScriptureWithFallback: engine.tryPlayScriptureWithFallback,
    playScripture: engine.playScripture,
    isStarted: engine.isStarted,
    stopScripturePlayback: engine.stopScripturePlayback,
  };

  const playScriptureChapterRef = useRef<PlayScriptureChapterFn>(async () => false);
  playScriptureChapterRef.current = (chapterArgs, opts) =>
    playScriptureChapterAt(chapterCtxRef.current, chapterArgs, opts, playScriptureChapterRef.current);

  const playScriptureChapter = useCallback<PlayScriptureChapterFn>(
    (chapterArgs, opts) => playScriptureChapterRef.current(chapterArgs, opts),
    [],
  );

  const resolveActiveReadChapter = useCallback((): ReadChapterPlaybackRegistration | null => {
    return getActiveReadChapterPlayback() ?? readChapterRef.current ?? args.readChapter;
  }, [args.readChapter]);

  const registerReadChapter = useCallback((reg: ReadChapterPlaybackRegistration | null) => {
    registerReadChapterPlayback(chapterCtxRef.current, reg);
  }, []);

  const togglePlayScripture = useCallback(async () => {
    await toggleScripturePlayback(chapterCtxRef.current);
  }, []);

  return {
    readChapterRef,
    scriptureSrcRef: engine.scriptureSrcRef,
    stopScripturePlayback: engine.stopScripturePlayback,
    registerReadChapter,
    resolveActiveReadChapter,
    playScriptureChapter,
    togglePlayScripture,
  };
}

export { resolveReadChapterAudioRegistration } from "./scriptureReadChapterRegistration";
export type { ReadChapterPlaybackRegistration, ScriptureAudioRepeatMode } from "./scripturePlaybackTypes";
