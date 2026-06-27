import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InteractionManager, type ScrollView } from "react-native";
import {
  writeNatureActiveSceneId,
  writeNatureLoopAllScenesEnabled,
} from "../nature/natureActiveScenePrefs";
import type { NatureAmbientSceneSlotId } from "../nature/ambientSceneSlots";
import {
  bumpNatureSceneUsage,
  sortNatureScenesByUsage,
  type NatureSceneUsageMap,
} from "../nature/natureSceneUsage";
import type { NatureSettingsV2 } from "../types/nature";
import { ensureNatureSceneVideoReady, isNatureSceneVideoReady } from "../media/natureSceneReadiness";
import { trackTelemetry } from "../telemetry/client";
import { homeSceneStripScrollX } from "./HomeSceneThumb";
import type { HomeNatureVideoPowerPolicy } from "./useHomeNatureVideoPowerPolicy";
import { useHomeNatureSceneVideoReadiness } from "./useHomeNatureSceneVideoReadiness";
import { useHomeNatureScenePlayback } from "./useHomeNatureScenePlayback";
import { useHomeNatureSceneAmbient } from "./useHomeNatureSceneAmbient";
import { HOME_SCENE_STRIP_EDGE_PAD, SCENE_LOOP_SWITCH_MS } from "./homeNatureScreenConstants";

type Args = {
  baseUrl: string;
  homeFocused: boolean;
  homeFocusedRef: React.MutableRefObject<boolean>;
  naturePackRev: number;
  loading: boolean;
  error: string | null;
  settings: NatureSettingsV2 | null;
  localActiveId: string;
  setLocalActiveId: React.Dispatch<React.SetStateAction<string>>;
  loopAllScenesEnabled: boolean;
  setLoopAllScenesEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  sceneUsageMap: NatureSceneUsageMap;
  setSceneUsageMap: React.Dispatch<React.SetStateAction<NatureSceneUsageMap>>;
  activeAmbientSlotId: NatureAmbientSceneSlotId | "";
  setActiveAmbientSlotId: React.Dispatch<React.SetStateAction<NatureAmbientSceneSlotId | "">>;
  coverVideoPosterOnly: boolean;
  forcePosterStage: boolean;
  videoPowerPolicy: HomeNatureVideoPowerPolicy;
  musicModeActive: boolean;
  scriptureModeActive: boolean;
  voiceActive: boolean;
};

export function useHomeNatureSceneControl({
  baseUrl,
  homeFocused,
  homeFocusedRef,
  naturePackRev,
  loading,
  error,
  settings,
  localActiveId,
  setLocalActiveId,
  loopAllScenesEnabled,
  setLoopAllScenesEnabled,
  sceneUsageMap,
  setSceneUsageMap,
  activeAmbientSlotId,
  setActiveAmbientSlotId,
  coverVideoPosterOnly,
  forcePosterStage,
  videoPowerPolicy,
  musicModeActive,
  scriptureModeActive,
  voiceActive,
}: Args) {
  const [sceneStripViewportWidth, setSceneStripViewportWidth] = useState(0);

  const sceneScrollRef = useRef<ScrollView>(null);
  const sceneStripViewportW = useRef(0);
  const prevSceneRef = useRef<string | null>(null);
  const sceneSessionStartRef = useRef(0);

  const {
    sceneId,
    playback,
    resolveScenePlayback,
    currentPlayback,
    posterUri,
    posterModule,
    clampedRate,
    hasVideoStage,
  } = useHomeNatureScenePlayback({
    baseUrl,
    naturePackRev,
    loading,
    error,
    settings,
    localActiveId,
    setLocalActiveId,
  });

  const sceneList = useMemo(() => {
    const videos = settings?.videos ?? [];
    return sortNatureScenesByUsage(videos, sceneUsageMap);
  }, [settings, sceneUsageMap]);

  const sceneIdList = useMemo(() => sceneList.map((v) => v.id), [sceneList]);

  const {
    waitingSceneId,
    showSceneLoader,
    handleSceneVideoReady,
    preloadAdjacentWhenFocused,
    beginSceneSwitchWait,
    clearSceneSwitchWait,
  } = useHomeNatureSceneVideoReadiness({
    homeFocused,
    homeFocusedRef,
    sceneId,
    sceneIdList,
    loading,
    coverVideoPosterOnly,
    forcePosterStage,
    videoPowerPolicy,
  });

  useHomeNatureSceneAmbient({
    homeFocused,
    settings,
    activeAmbientSlotId,
    setActiveAmbientSlotId,
    clampedRate,
    musicModeActive,
    scriptureModeActive,
    voiceActive,
  });

  const scrollSceneStripToId = useCallback(
    (id: string, animated = true) => {
      if (!id || sceneList.length < 2) return;
      const idx = sceneList.findIndex((v) => v.id === id);
      if (idx < 0) return;
      const vw = sceneStripViewportW.current;
      if (vw < 1) return;
      const target = homeSceneStripScrollX(idx + 1, vw, sceneList.length + 2, 0);
      sceneScrollRef.current?.scrollTo({ x: target, animated });
    },
    [sceneList],
  );

  const selectScene = useCallback(
    (id: string, opts?: { keepLoopMode?: boolean; source?: "user" | "auto" }) => {
      const next = id.trim();
      if (!next) return;
      if (!opts?.keepLoopMode) {
        setLoopAllScenesEnabled(false);
        void writeNatureLoopAllScenesEnabled(false);
      }
      if (next === sceneId) return;
      if (opts?.source !== "auto") {
        void bumpNatureSceneUsage(next).then(setSceneUsageMap);
      }
      scrollSceneStripToId(next);
      void writeNatureActiveSceneId(next);

      if (forcePosterStage) {
        clearSceneSwitchWait();
        setLocalActiveId(next);
        preloadAdjacentWhenFocused(sceneIdList, next);
        return;
      }

      if (isNatureSceneVideoReady(next)) {
        clearSceneSwitchWait();
        setLocalActiveId(next);
        preloadAdjacentWhenFocused(sceneIdList, next);
        return;
      }

      beginSceneSwitchWait(next);
      setLocalActiveId(next);
      void ensureNatureSceneVideoReady(next);
      preloadAdjacentWhenFocused(sceneIdList, next);
    },
    [
      forcePosterStage,
      sceneId,
      sceneIdList,
      scrollSceneStripToId,
      setLocalActiveId,
      setLoopAllScenesEnabled,
      setSceneUsageMap,
      clearSceneSwitchWait,
      beginSceneSwitchWait,
      preloadAdjacentWhenFocused,
    ],
  );

  useEffect(() => {
    if (!sceneId || loading) return;
    const task = InteractionManager.runAfterInteractions(() => {
      scrollSceneStripToId(sceneId);
    });
    return () => task.cancel();
  }, [loading, sceneId, scrollSceneStripToId]);

  useEffect(() => {
    if (!sceneId || loading) return;
    const task = InteractionManager.runAfterInteractions(() => {
      const prev = prevSceneRef.current;
      if (prev && prev !== sceneId) {
        trackTelemetry("scene_session", {
          scene_id: prev,
          duration_ms: Date.now() - sceneSessionStartRef.current,
        });
      }
      if (prev !== sceneId) {
        trackTelemetry("scene_view", { scene_id: sceneId });
        prevSceneRef.current = sceneId;
        sceneSessionStartRef.current = Date.now();
      }
    });
    return () => task.cancel();
  }, [sceneId, loading]);

  useEffect(() => {
    return () => {
      const prev = prevSceneRef.current;
      if (!prev) return;
      trackTelemetry("scene_session", {
        scene_id: prev,
        duration_ms: Date.now() - sceneSessionStartRef.current,
      });
      prevSceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!loopAllScenesEnabled) return;
    if (sceneList.length < 2) return;
    const timer = setInterval(() => {
      const idx = sceneList.findIndex((v) => v.id === sceneId);
      const nextIdx = idx >= 0 ? (idx + 1) % sceneList.length : 0;
      const nextId = sceneList[nextIdx]?.id;
      if (!nextId) return;
      selectScene(nextId, { keepLoopMode: true, source: "auto" });
    }, SCENE_LOOP_SWITCH_MS);
    return () => clearInterval(timer);
  }, [loopAllScenesEnabled, sceneId, sceneList, selectScene]);

  const onSceneStripLayout = useCallback((width: number) => {
    if (width > 0) {
      sceneStripViewportW.current = width;
      setSceneStripViewportWidth(width);
    }
  }, []);

  return {
    sceneId,
    playback,
    resolveScenePlayback,
    currentPlayback,
    posterUri,
    posterModule,
    clampedRate,
    sceneList,
    selectScene,
    waitingSceneId,
    showSceneLoader,
    handleSceneVideoReady,
    hasVideoStage,
    sceneScrollRef,
    sceneStripViewportWidth,
    onSceneStripLayout,
    scrollSceneStripToId,
  };
}
