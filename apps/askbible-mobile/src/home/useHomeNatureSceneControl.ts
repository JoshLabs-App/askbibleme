import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InteractionManager, type ScrollView } from "react-native";
import {
  writeNatureActiveSceneId,
  writeNatureLoopAllScenesEnabled,
} from "../nature/natureActiveScenePrefs";
import {
  NATURE_SCENE_DEFAULT_AMBIENT,
  type NatureAmbientSceneSlotId,
} from "../nature/ambientSceneSlots";
import { writeNatureAmbientSceneSlotId } from "../nature/natureAmbientScenePrefs";
import {
  bumpNatureSceneUsage,
  sortNatureScenesByUsage,
  type NatureSceneUsageMap,
} from "../nature/natureSceneUsage";
import type { NatureSettingsV2 } from "../types/nature";
import { ensureNatureSceneVideoReady, hasBundledNatureSceneVideo, isNatureSceneVideoReady } from "../media/natureSceneReadiness";
import { homeSceneStripScrollX } from "./HomeSceneThumb";
import type { HomeNatureVideoPowerPolicy } from "./useHomeNatureVideoPowerPolicy";
import { useHomeNatureSceneVideoReadiness } from "./useHomeNatureSceneVideoReadiness";
import { useHomeNatureScenePlayback } from "./useHomeNatureScenePlayback";
import { useHomeNatureSceneAmbient } from "./useHomeNatureSceneAmbient";
import { HOME_SCENE_STRIP_EDGE_PAD, SCENE_LOOP_SWITCH_MS } from "./homeNatureScreenConstants";
import { ensureShellMediaSceneArtwork } from "../audio/shellMediaSceneArtwork";

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
  /** 静帧时用预烘焙柔焦海报 */
  preferSoftPoster?: boolean;
  videoPowerPolicy: HomeNatureVideoPowerPolicy;
  musicModeActive: boolean;
  scriptureModeActive: boolean;
  voiceActive: boolean;
  enabled?: boolean;
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
  preferSoftPoster = false,
  videoPowerPolicy,
  musicModeActive,
  scriptureModeActive,
  voiceActive,
  enabled = true,
}: Args) {
  const [sceneStripViewportWidth, setSceneStripViewportWidth] = useState(0);

  const sceneScrollRef = useRef<ScrollView>(null);
  const sceneStripViewportW = useRef(0);

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
    preferSoftPoster,
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
    enabled,
  });

  useHomeNatureSceneAmbient({
    settings,
    activeAmbientSlotId,
    setActiveAmbientSlotId,
    clampedRate,
    musicModeActive,
    scriptureModeActive,
    voiceActive,
    enabled,
  });

  useEffect(() => {
    if (!enabled) return;
    // 锁屏专辑图：随机 1:1 场景海报池，不绑定当前首页场景。
    ensureShellMediaSceneArtwork();
  }, [enabled]);

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
        const defaultAmbient = NATURE_SCENE_DEFAULT_AMBIENT[next];
        if (defaultAmbient) {
          setActiveAmbientSlotId(defaultAmbient);
          void writeNatureAmbientSceneSlotId(defaultAmbient);
        }
      }
      scrollSceneStripToId(next);
      void writeNatureActiveSceneId(next);

      if (forcePosterStage || !hasBundledNatureSceneVideo(next)) {
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
      setActiveAmbientSlotId,
      setLocalActiveId,
      setLoopAllScenesEnabled,
      setSceneUsageMap,
      clearSceneSwitchWait,
      beginSceneSwitchWait,
      preloadAdjacentWhenFocused,
    ],
  );

  useEffect(() => {
    if (!enabled) return;
    if (!sceneId || loading) return;
    const task = InteractionManager.runAfterInteractions(() => {
      scrollSceneStripToId(sceneId);
    });
    return () => task.cancel();
  }, [enabled, loading, sceneId, scrollSceneStripToId]);

  useEffect(() => {
    if (!enabled) return;
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
  }, [enabled, loopAllScenesEnabled, sceneId, sceneList, selectScene]);

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
