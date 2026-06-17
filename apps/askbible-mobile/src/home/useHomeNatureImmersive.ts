import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EdgeInsets } from "react-native-safe-area-context";
import { useShellSwipeAction } from "../shell/useShellSwipeAction";
import type { NatureSettingsV2 } from "../types/nature";
import { setHomeAutoHideChrome, setHomeLandscapeImmersive } from "./homeLandscapeImmersive";
import { SHELL_TAB_BAR_CLEARANCE, shellFullBleedBackdropStyle } from "../shell/shellLayout";
import { useLandscapeNarrow } from "./useLandscapeNarrow";
import { homeNatureScreenStyles as styles } from "./homeNatureScreenStyles";
import { AUTO_IMMERSIVE_DELAY_MS } from "./homeNatureScreenConstants";

type Args = {
  insets: EdgeInsets;
  fullBleedFrame: { width: number; height: number };
  hasVideoStage: boolean;
  loading: boolean;
  error: string | null;
  settingsOpen: boolean;
  setSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showSceneLoader: boolean;
  playing: boolean;
  togglePlayMusic: () => void | Promise<void>;
  sceneId: string;
  sceneList: NatureSettingsV2["videos"];
  selectScene: (id: string, opts?: { keepLoopMode?: boolean; source?: "user" | "auto" }) => void;
  scrollSceneStripToId: (id: string, animated?: boolean) => void;
};

export function useHomeNatureImmersive({
  insets,
  fullBleedFrame,
  hasVideoStage,
  loading,
  error,
  settingsOpen,
  setSettingsOpen,
  showSceneLoader,
  playing,
  togglePlayMusic,
  sceneId,
  sceneList,
  selectScene,
  scrollSceneStripToId,
}: Args) {
  const landscapeNarrow = useLandscapeNarrow();
  const [landscapeScenePickerOpen, setLandscapeScenePickerOpen] = useState(false);
  const [autoImmersiveActive, setAutoImmersiveActive] = useState(false);
  const [hasHomeInteraction, setHasHomeInteraction] = useState(false);
  const autoImmersiveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const landscapeImmersive = landscapeNarrow;
  const showLandscapeVideo = landscapeImmersive && hasVideoStage;
  const canArmAutoImmersive =
    hasVideoStage &&
    !loading &&
    !error &&
    !settingsOpen &&
    !landscapeScenePickerOpen &&
    !showSceneLoader;
  const showAutoImmersive = autoImmersiveActive && canArmAutoImmersive;
  const showFullscreenVideo = showLandscapeVideo;

  const videoBackdropStyle = useMemo(
    () => (showFullscreenVideo ? styles.fullBleedBackdropFill : shellFullBleedBackdropStyle(fullBleedFrame)),
    [fullBleedFrame, showFullscreenVideo],
  );

  useEffect(() => {
    setHomeLandscapeImmersive(landscapeImmersive);
    return () => setHomeLandscapeImmersive(false);
  }, [landscapeImmersive]);

  useEffect(() => {
    setHomeAutoHideChrome(showAutoImmersive);
    return () => setHomeAutoHideChrome(false);
  }, [showAutoImmersive]);

  useEffect(() => {
    if (!showLandscapeVideo) setLandscapeScenePickerOpen(false);
  }, [showLandscapeVideo]);

  const clearAutoImmersiveTimer = useCallback(() => {
    if (!autoImmersiveTimerRef.current) return;
    clearTimeout(autoImmersiveTimerRef.current);
    autoImmersiveTimerRef.current = null;
  }, []);

  const armAutoImmersiveTimer = useCallback(() => {
    clearAutoImmersiveTimer();
    if (!canArmAutoImmersive) return;
    autoImmersiveTimerRef.current = setTimeout(() => {
      setAutoImmersiveActive(true);
    }, AUTO_IMMERSIVE_DELAY_MS);
  }, [canArmAutoImmersive, clearAutoImmersiveTimer]);

  const markHomeInteraction = useCallback(() => {
    if (!hasHomeInteraction) setHasHomeInteraction(true);
    if (autoImmersiveActive) setAutoImmersiveActive(false);
    armAutoImmersiveTimer();
  }, [hasHomeInteraction, autoImmersiveActive, armAutoImmersiveTimer]);

  useEffect(() => {
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
  }, [hasHomeInteraction, autoImmersiveActive, showAutoImmersive, armAutoImmersiveTimer, clearAutoImmersiveTimer]);

  useEffect(() => {
    if (!landscapeScenePickerOpen || !sceneId) return;
    scrollSceneStripToId(sceneId);
  }, [landscapeScenePickerOpen, sceneId, scrollSceneStripToId]);

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

  useShellSwipeAction(
    !showAutoImmersive &&
      !loading &&
      !error &&
      sceneList.length > 1 &&
      (!showLandscapeVideo || !landscapeScenePickerOpen),
    onSceneSwipe,
  );

  const onLandscapeSceneSelect = useCallback(
    (id: string) => {
      if (id.trim() !== sceneId) selectScene(id);
      setLandscapeScenePickerOpen(false);
    },
    [sceneId, selectScene],
  );

  const onLandscapeBackdropPress = useCallback(() => {
    if (settingsOpen) {
      setSettingsOpen(false);
      return;
    }
    if (landscapeScenePickerOpen) {
      setLandscapeScenePickerOpen(false);
      return;
    }
    if (playing) void togglePlayMusic();
    setLandscapeScenePickerOpen(true);
  }, [settingsOpen, landscapeScenePickerOpen, playing, togglePlayMusic, setSettingsOpen]);

  const onPortraitBackdropPress = useCallback(() => {
    if (settingsOpen) {
      setSettingsOpen(false);
      return;
    }
    if (showAutoImmersive) {
      markHomeInteraction();
      return;
    }
    setAutoImmersiveActive(true);
  }, [settingsOpen, showAutoImmersive, markHomeInteraction, setSettingsOpen]);

  const showSceneStrip = !showLandscapeVideo || landscapeScenePickerOpen;
  const bottomNavSlot = SHELL_TAB_BAR_CLEARANCE + insets.bottom;

  return {
    landscapeScenePickerOpen,
    showLandscapeVideo,
    showAutoImmersive,
    showSceneStrip,
    videoBackdropStyle,
    markHomeInteraction,
    onLandscapeSceneSelect,
    onLandscapeBackdropPress,
    onPortraitBackdropPress,
    bottomNavSlot,
  };
}
