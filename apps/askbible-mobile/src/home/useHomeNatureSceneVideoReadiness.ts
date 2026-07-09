import { useCallback, useEffect, useState } from "react";
import { InteractionManager, Platform } from "react-native";
import {
  ensureNatureSceneVideoReady,
  isNatureSceneVideoReady,
  markNatureSceneVideoReady,
} from "../media/natureSceneReadiness";
import { preloadAdjacentNatureSceneVideos } from "../media/bundledNatureMedia";
import type { HomeNatureVideoPowerPolicy } from "./useHomeNatureVideoPowerPolicy";

type Args = {
  homeFocused: boolean;
  homeFocusedRef: React.MutableRefObject<boolean>;
  sceneId: string;
  sceneIdList: string[];
  loading: boolean;
  coverVideoPosterOnly: boolean;
  forcePosterStage: boolean;
  videoPowerPolicy: HomeNatureVideoPowerPolicy;
  enabled?: boolean;
};

export function useHomeNatureSceneVideoReadiness({
  homeFocused,
  homeFocusedRef,
  sceneId,
  sceneIdList,
  loading,
  coverVideoPosterOnly,
  forcePosterStage,
  videoPowerPolicy,
  enabled = true,
}: Args) {
  const [waitingSceneId, setWaitingSceneId] = useState<string | null>(null);
  const [showSceneLoader, setShowSceneLoader] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (!homeFocused || !sceneId || loading || !sceneIdList.length) return;
    if (videoPowerPolicy.skipAdjacentPreload) return;
    let task: { cancel: () => void } | null = null;
    const timer = setTimeout(() => {
      task = InteractionManager.runAfterInteractions(() => {
        void ensureNatureSceneVideoReady(sceneId);
        void preloadAdjacentNatureSceneVideos(sceneIdList, sceneId);
      });
    }, 1800);
    return () => {
      clearTimeout(timer);
      task?.cancel();
    };
  }, [enabled, homeFocused, sceneId, sceneIdList, loading, videoPowerPolicy.skipAdjacentPreload]);

  useEffect(() => {
    if (!enabled) return;
    if (coverVideoPosterOnly) {
      setWaitingSceneId(null);
      setShowSceneLoader(false);
    }
  }, [coverVideoPosterOnly]);

  useEffect(() => {
    if (!enabled) return;
    if (!waitingSceneId) {
      setShowSceneLoader(false);
      return;
    }
    if (coverVideoPosterOnly || forcePosterStage) {
      setWaitingSceneId(null);
      setShowSceneLoader(false);
      return;
    }
    if (isNatureSceneVideoReady(waitingSceneId)) {
      setWaitingSceneId(null);
      return;
    }
    const timer = setTimeout(() => setShowSceneLoader(true), 220);
    return () => clearTimeout(timer);
  }, [enabled, coverVideoPosterOnly, forcePosterStage, waitingSceneId]);

  useEffect(() => {
    if (!enabled) return;
    if (!homeFocused) return;
    if (Platform.OS !== "android") return;
    if (coverVideoPosterOnly || forcePosterStage) return;
    const current = sceneId.trim();
    if (!current) return;
    if (isNatureSceneVideoReady(current)) {
      setWaitingSceneId(null);
      return;
    }
    setWaitingSceneId(current);
    let task: { cancel: () => void } | null = null;
    const timer = setTimeout(() => {
      task = InteractionManager.runAfterInteractions(() => {
        void ensureNatureSceneVideoReady(current);
      });
    }, 900);
    return () => {
      clearTimeout(timer);
      task?.cancel();
    };
  }, [enabled, coverVideoPosterOnly, forcePosterStage, homeFocused, sceneId]);

  const handleSceneVideoReady = useCallback((id: string) => {
    markNatureSceneVideoReady(id);
    setWaitingSceneId((pending) => (pending === id ? null : pending));
  }, []);

  const preloadAdjacentWhenFocused = useCallback(
    (list: readonly string[], activeId: string) => {
      if (!homeFocusedRef.current || videoPowerPolicy.skipAdjacentPreload) return;
      InteractionManager.runAfterInteractions(() => {
        void preloadAdjacentNatureSceneVideos(list, activeId);
      });
    },
    [homeFocusedRef, videoPowerPolicy.skipAdjacentPreload],
  );

  const beginSceneSwitchWait = useCallback((nextId: string) => {
    setWaitingSceneId(nextId);
  }, []);

  const clearSceneSwitchWait = useCallback(() => {
    setWaitingSceneId(null);
    setShowSceneLoader(false);
  }, []);

  return {
    waitingSceneId,
    showSceneLoader,
    handleSceneVideoReady,
    preloadAdjacentWhenFocused,
    beginSceneSwitchWait,
    clearSceneSwitchWait,
  };
}
