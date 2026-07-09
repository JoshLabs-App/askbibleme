import { useCallback, useEffect, useRef, useState } from "react";
import type { EdgeInsets } from "react-native-safe-area-context";
import { useShellSwipeAction } from "../shell/useShellSwipeAction";
import type { NatureSettingsV2 } from "../types/nature";
import { setHomeAutoHideChrome, setHomeLandscapeImmersive } from "./homeLandscapeImmersive";
import { SHELL_TAB_BAR_CLEARANCE } from "../shell/shellLayout";
import { useLandscapeNarrow } from "./useLandscapeNarrow";
import { AUTO_IMMERSIVE_DELAY_MS, AUTO_IMMERSIVE_LANDSCAPE_DELAY_MS } from "./homeNatureScreenConstants";

type Args = {
  insets: EdgeInsets;
  hasVideoStage: boolean;
  loading: boolean;
  error: string | null;
  settingsOpen: boolean;
  showSceneLoader: boolean;
  sceneId: string;
  sceneList: NatureSettingsV2["videos"];
  selectScene: (id: string, opts?: { keepLoopMode?: boolean; source?: "user" | "auto" }) => void;
  enabled?: boolean;
};

export function useHomeNatureImmersive({
  insets,
  hasVideoStage,
  loading,
  error,
  settingsOpen,
  showSceneLoader,
  sceneId,
  sceneList,
  selectScene,
  enabled = true,
}: Args) {
  const landscapeNarrow = useLandscapeNarrow();
  const [autoImmersiveActive, setAutoImmersiveActive] = useState(false);
  const [hasHomeInteraction, setHasHomeInteraction] = useState(false);
  const autoImmersiveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showLandscapeVideo = landscapeNarrow && hasVideoStage;
  const canArmAutoImmersive =
    hasVideoStage && !loading && !error && !settingsOpen && !showSceneLoader;
  const showAutoImmersive = autoImmersiveActive && canArmAutoImmersive;

  useEffect(() => {
    if (!enabled) return;
    setHomeLandscapeImmersive(showLandscapeVideo);
    return () => setHomeLandscapeImmersive(false);
  }, [enabled, showLandscapeVideo]);

  useEffect(() => {
    if (!enabled) return;
    setHomeAutoHideChrome(showAutoImmersive);
    return () => setHomeAutoHideChrome(false);
  }, [enabled, showAutoImmersive]);

  const clearAutoImmersiveTimer = useCallback(() => {
    if (!autoImmersiveTimerRef.current) return;
    clearTimeout(autoImmersiveTimerRef.current);
    autoImmersiveTimerRef.current = null;
  }, []);

  const armAutoImmersiveTimer = useCallback(() => {
    clearAutoImmersiveTimer();
    if (!canArmAutoImmersive) return;
    const delayMs = showLandscapeVideo ? AUTO_IMMERSIVE_LANDSCAPE_DELAY_MS : AUTO_IMMERSIVE_DELAY_MS;
    autoImmersiveTimerRef.current = setTimeout(() => {
      setAutoImmersiveActive(true);
    }, delayMs);
  }, [canArmAutoImmersive, clearAutoImmersiveTimer, showLandscapeVideo]);

  const markHomeInteraction = useCallback(() => {
    if (!hasHomeInteraction) setHasHomeInteraction(true);
    if (autoImmersiveActive) setAutoImmersiveActive(false);
    armAutoImmersiveTimer();
  }, [hasHomeInteraction, autoImmersiveActive, armAutoImmersiveTimer]);

  useEffect(() => {
    if (!enabled) return;
    if (!hasHomeInteraction) {
      clearAutoImmersiveTimer();
      if (autoImmersiveActive) setAutoImmersiveActive(false);
      return;
    }
    if (showAutoImmersive) {
      clearAutoImmersiveTimer();
      return;
    }
    armAutoImmersiveTimer();
    return clearAutoImmersiveTimer;
  }, [enabled, hasHomeInteraction, autoImmersiveActive, showAutoImmersive, armAutoImmersiveTimer, clearAutoImmersiveTimer]);

  const onSceneSwipe = useCallback(
    (direction: "left" | "right") => {
      if (sceneList.length < 2) return;
      const idx = sceneList.findIndex((v) => v.id === sceneId);
      if (idx < 0) return;
      const nextIdx = idx + (direction === "left" ? -1 : 1);
      if (nextIdx < 0 || nextIdx >= sceneList.length) return;
      selectScene(sceneList[nextIdx]!.id);
    },
    [sceneList, sceneId, selectScene],
  );

  useShellSwipeAction(enabled && !showAutoImmersive && !loading && !error && sceneList.length > 1, onSceneSwipe);

  return {
    showLandscapeVideo,
    showAutoImmersive,
    markHomeInteraction,
    /** 横屏沉浸时底栏隐藏，场景条仅留安全区；竖屏仍避让浮层 Tab */
    bottomNavSlot: showLandscapeVideo
      ? Math.max(insets.bottom, 2)
      : SHELL_TAB_BAR_CLEARANCE + insets.bottom,
  };
}
