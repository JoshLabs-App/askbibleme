import { InteractionManager } from "react-native";
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { isNativeMainTrackOs } from "../audio/shellNativeAudioTakeover";
import { logShellSoundError } from "../audio/safeShellSound";
import { syncShellMediaPlaybackRate } from "../audio/shellMediaControls";
import { registerPlanFlowEntryCallback } from "../read/read-plan-flow-autoplay";
import {
  normalizeScripturePlaybackRate,
  readScripturePlaybackRate,
  writeScripturePlaybackRate,
} from "./music-playback-prefs";
import type { MusicPlaybackMode } from "./musicPlaybackTypes";
import type { ScriptureAudioRepeatMode } from "./scripturePlaybackTypes";
import type { AudioPlayer } from "expo-audio";

type Args = {
  soundRef: MutableRefObject<AudioPlayer | null>;
  playbackModeRef: MutableRefObject<MusicPlaybackMode>;
};

export function useScripturePlaybackPrefs({ soundRef, playbackModeRef }: Args) {
  const [scriptureAudioRepeatMode, setScriptureAudioRepeatModeState] =
    useState<ScriptureAudioRepeatMode>("off");
  const [scripturePlaybackRate, setScripturePlaybackRateState] = useState(1);
  const scriptureAudioRepeatRef = useRef<ScriptureAudioRepeatMode>("off");
  const scripturePlaybackRateRef = useRef(1);

  scriptureAudioRepeatRef.current = scriptureAudioRepeatMode;
  scripturePlaybackRateRef.current = scripturePlaybackRate;

  const setScriptureAudioRepeatMode = useCallback((mode: ScriptureAudioRepeatMode) => {
    scriptureAudioRepeatRef.current = mode;
    setScriptureAudioRepeatModeState(mode);
  }, []);

  const setScripturePlaybackRate = useCallback(async (rate: number) => {
    const normalized = normalizeScripturePlaybackRate(rate);
    scripturePlaybackRateRef.current = normalized;
    setScripturePlaybackRateState(normalized);
    try {
      await writeScripturePlaybackRate(normalized);
    } catch {
      /* ignore local storage write failures */
    }
    /** 语速写到原生播放器；expo-av 回退已删。 */
    syncShellMediaPlaybackRate(normalized);
  }, []);

  useEffect(() => {
    registerPlanFlowEntryCallback(() => {
      setScriptureAudioRepeatMode("off");
    });
    return () => registerPlanFlowEntryCallback(null);
  }, [setScriptureAudioRepeatMode]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      void readScripturePlaybackRate().then((rate) => {
        const normalized = normalizeScripturePlaybackRate(rate);
        scripturePlaybackRateRef.current = normalized;
        setScripturePlaybackRateState(normalized);
      });
    });
    return () => task.cancel();
  }, []);

  return {
    scriptureAudioRepeatMode,
    scripturePlaybackRate,
    scriptureAudioRepeatRef,
    scripturePlaybackRateRef,
    setScriptureAudioRepeatMode,
    setScripturePlaybackRate,
  };
}
