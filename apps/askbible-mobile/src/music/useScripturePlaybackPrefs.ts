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
import type { Audio } from "expo-av";

type Args = {
  soundRef: MutableRefObject<Audio.Sound | null>;
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
    if (isNativeMainTrackOs()) {
      syncShellMediaPlaybackRate(normalized);
    }
    const sound = soundRef.current;
    if (!sound || playbackModeRef.current !== "scripture") return;
    try {
      await sound.setRateAsync(normalized, true);
    } catch (err) {
      logShellSoundError("setScripturePlaybackRate", err);
    }
  }, [playbackModeRef, soundRef]);

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
