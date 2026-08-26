import { useCallback, useEffect, useState } from "react";
import type { EdgeInsets } from "react-native-safe-area-context";
import { useShellSwipeAction } from "../shell/useShellSwipeAction";
import type { NatureSettingsV2 } from "../types/nature";
import { setHomeAutoHideChrome, setHomeLandscapeImmersive } from "./homeLandscapeImmersive";
import { HOME_LANDSCAPE_PLAY_BAR_AUTO_HIDE_MS } from "./homeNatureScreenConstants";
import { SHELL_TAB_BAR_CLEARANCE } from "../shell/shellLayout";
import { useLandscapeNarrow } from "./useLandscapeNarrow";

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
  /** 底栏有操作时递增，横屏播放栏自动隐藏计时重来 */
  idleEpoch?: number;
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
  idleEpoch = 0,
}: Args) {
  const landscapeNarrow = useLandscapeNarrow();
  /** true = 藏控件；横屏同时收起播放栏 */
  const [hideChrome, setHideChrome] = useState(false);

  const showLandscapeVideo = landscapeNarrow && hasVideoStage;
  const canHideChromePortrait =
    enabled && hasVideoStage && !loading && !error && !settingsOpen && !showSceneLoader;

  /**
   * 横屏：闲置后 hideChrome，收起播放栏只留经文。
   * 竖屏：保持原沉浸条件。
   */
  const showAutoImmersive = landscapeNarrow
    ? hideChrome && enabled && !error && !settingsOpen
    : hideChrome && canHideChromePortrait;

  useEffect(() => {
    if (!enabled) return;
    setHomeLandscapeImmersive(showLandscapeVideo);
    return () => setHomeLandscapeImmersive(false);
  }, [enabled, showLandscapeVideo]);

  /** 进出横屏都先露出播放栏；横屏闲置后再收。 */
  useEffect(() => {
    if (!enabled) return;
    setHideChrome(false);
  }, [enabled, landscapeNarrow]);

  useEffect(() => {
    if (!enabled || !landscapeNarrow || hideChrome || Boolean(error) || settingsOpen) return;
    const id = setTimeout(() => setHideChrome(true), HOME_LANDSCAPE_PLAY_BAR_AUTO_HIDE_MS);
    return () => clearTimeout(id);
  }, [enabled, error, hideChrome, idleEpoch, landscapeNarrow, settingsOpen]);

  useEffect(() => {
    if (!enabled) return;
    setHomeAutoHideChrome(showAutoImmersive);
    return () => setHomeAutoHideChrome(false);
  }, [enabled, showAutoImmersive]);

  useEffect(() => {
    if (settingsOpen || loading || error || showSceneLoader) {
      if (!landscapeNarrow) {
        setHideChrome(false);
      }
    }
  }, [settingsOpen, loading, error, showSceneLoader, landscapeNarrow]);

  /** 点空白：横屏显隐播放栏；竖屏显隐顶栏 / Tab。 */
  const toggleHomeChrome = useCallback(() => {
    if (landscapeNarrow) {
      if (!enabled || Boolean(error) || settingsOpen) return;
      setHideChrome((prev) => !prev);
      return;
    }
    if (!canHideChromePortrait && !hideChrome) return;
    setHideChrome((prev) => !prev);
  }, [landscapeNarrow, enabled, error, settingsOpen, canHideChromePortrait, hideChrome]);

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
    toggleHomeChrome,
    /** 竖屏始终按 Tab 占位留白，点空白藏图标时播放行不跟着下移 */
    bottomNavSlot: showLandscapeVideo
      ? Math.max(insets.bottom, 2)
      : SHELL_TAB_BAR_CLEARANCE + insets.bottom,
  };
}
