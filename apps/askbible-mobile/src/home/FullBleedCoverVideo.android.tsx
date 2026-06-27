import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShellFullBleedFrame } from "../shell/shellLayout";
import { CoverVideoPosterBackdrop } from "./CoverVideoPosterBackdrop";
import {
  COVER_VIDEO_READY_TIMEOUT_MS,
  getCoverVideoPosterOnly,
  hasCoverVideoPosterAsset,
  markCoverVideoSessionPosterOnly,
} from "./coverVideoPosterFallback";
import { resolveNatureHomePortraitCoverLayout } from "./natureHomePortraitCoverLayout";
import { NATURE_HOME_VIDEO_LANDSCAPE_ASPECT } from "./nature-home-portrait-pan";

import type { ResolveNatureCoverPlayback } from "./natureCoverPlayback";
import { useCoverVideoCrossfade } from "./useCoverVideoCrossfade";
import { AndroidCoverVideoSlot } from "./FullBleedCoverVideoSlots.android";
import {
  fullBleedCoverVideoStyles as styles,
  resolveLandscapeCoverLayerFrame,
  type FullBleedCoverVideoLayoutMode,
} from "./fullBleedCoverVideoShared";

export type { FullBleedCoverVideoLayoutMode } from "./fullBleedCoverVideoShared";

type Props = {
  sceneId: string;
  resolveScenePlayback: ResolveNatureCoverPlayback;
  posterUri?: string;
  posterModule?: number | null;
  /** Android: 模糊模式下直接用静帧，停用视频层 */
  forcePosterMode?: boolean;
  rate?: number;
  layoutMode?: FullBleedCoverVideoLayoutMode;
  nativeFullCover?: boolean;
  onSceneVideoReady?: (sceneId: string) => void;
  /** Tab 失焦时暂停解码，回到 Home 再续播 */
  playbackActive?: boolean;
  /** false：场景切换瞬时切，避免双路解码（省电 / 减发热） */
  crossfadeAnimated?: boolean;
};

/** Android：包内 mp4 + 双槽交叉淡入（expo-video；避免 expo-av Video 与 native-driver 动画黑屏） */
export function FullBleedCoverVideo({
  sceneId,
  resolveScenePlayback,
  posterUri,
  posterModule = null,
  forcePosterMode = false,
  rate = 1,
  layoutMode = "portrait-cover",
  onSceneVideoReady,
  playbackActive = true,
  crossfadeAnimated = true,
}: Props) {
  const trimmedScene = sceneId.trim();
  const trimmedPoster = posterUri?.trim() ?? "";
  const hasPoster = hasCoverVideoPosterAsset(posterModule, trimmedPoster);
  const screenFrame = useShellFullBleedFrame();
  const insets = useSafeAreaInsets();
  const { width: windowW, height: windowH } = useWindowDimensions();
  const winW = Math.max(windowW, screenFrame.width);
  const winH = Math.max(windowH, screenFrame.height) + Math.max(insets.bottom, 0);
  const landscapeCover = layoutMode === "landscape-cover";
  const [mediaAspect, setMediaAspect] = useState(NATURE_HOME_VIDEO_LANDSCAPE_ASPECT);
  const videoReadyRef = useRef(false);
  const {
    slotAScene,
    slotBScene,
    opacityA,
    opacityB,
    onSlotAReady,
    onSlotBReady,
    allowInitialPoster,
  } = useCoverVideoCrossfade(trimmedScene, crossfadeAnimated && !landscapeCover);

  const portraitLayout = useMemo(
    () => (landscapeCover ? null : resolveNatureHomePortraitCoverLayout(winW, winH, mediaAspect)),
    [landscapeCover, winW, winH, mediaAspect],
  );
  const portraitMode = !landscapeCover;
  const layerFrame = useMemo(
    () =>
      portraitLayout
        ? portraitLayout
        : resolveLandscapeCoverLayerFrame(winW, winH),
    [portraitLayout, winH, winW],
  );
  const [showInitialPoster, setShowInitialPoster] = useState(
    () => hasPoster && allowInitialPoster,
  );

  const activatePosterFallback = useCallback(() => {
    if (!hasPoster || getCoverVideoPosterOnly()) return;
    markCoverVideoSessionPosterOnly();
    if (trimmedScene) onSceneVideoReady?.(trimmedScene);
  }, [hasPoster, onSceneVideoReady, trimmedScene]);

  const onNaturalAspect = useCallback((aspect: number) => {
    if (!Number.isFinite(aspect) || aspect <= 0) return;
    setMediaAspect((prev) => (Math.abs(prev - aspect) < 0.01 ? prev : aspect));
  }, []);

  useEffect(() => {
    if (!allowInitialPoster) setShowInitialPoster(false);
  }, [allowInitialPoster]);

  useEffect(() => {
    videoReadyRef.current = false;
    if (forcePosterMode || getCoverVideoPosterOnly() || !trimmedScene || !hasPoster) return;

    const timer = setTimeout(() => {
      if (videoReadyRef.current || getCoverVideoPosterOnly()) return;
      activatePosterFallback();
    }, COVER_VIDEO_READY_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [activatePosterFallback, forcePosterMode, hasPoster, trimmedScene]);

  const onSlotAReadyOnce = () => {
    videoReadyRef.current = true;
    onSlotAReady();
    setShowInitialPoster(false);
    if (slotAScene.trim()) onSceneVideoReady?.(slotAScene.trim());
  };

  const onSlotBReadyOnce = () => {
    onSlotBReady();
    setShowInitialPoster(false);
    if (slotBScene.trim()) onSceneVideoReady?.(slotBScene.trim());
  };

  const handlePlaybackError = useCallback(() => {
    activatePosterFallback();
  }, [activatePosterFallback]);

  if (!trimmedScene) return null;

  const posterStageActive = forcePosterMode || getCoverVideoPosterOnly();

  if (posterStageActive) {
    return (
      <View style={styles.stage} pointerEvents="none">
        {hasPoster ? (
          <CoverVideoPosterBackdrop
            posterModule={posterModule}
            posterUri={trimmedPoster || undefined}
            portraitLayout={portraitLayout}
            viewportWidth={winW}
            viewportHeight={winH}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.stage} pointerEvents="none">
      <AndroidCoverVideoSlot
        slotKey="cover-a"
        sceneId={slotAScene}
        resolveScenePlayback={resolveScenePlayback}
        rate={rate}
        layerFrame={layerFrame}
        opacity={opacityA}
        portraitMode={portraitMode}
        onNaturalAspect={onNaturalAspect}
        onReady={onSlotAReadyOnce}
        onPlaybackError={handlePlaybackError}
        playbackActive={playbackActive}
      />
      <AndroidCoverVideoSlot
        slotKey="cover-b"
        sceneId={slotBScene}
        resolveScenePlayback={resolveScenePlayback}
        rate={rate}
        layerFrame={layerFrame}
        opacity={opacityB}
        portraitMode={portraitMode}
        onNaturalAspect={onNaturalAspect}
        onReady={onSlotBReadyOnce}
        onPlaybackError={handlePlaybackError}
        playbackActive={playbackActive}
      />
      {showInitialPoster && hasPoster ? (
        <CoverVideoPosterBackdrop
          posterModule={posterModule}
          posterUri={trimmedPoster || undefined}
          portraitLayout={portraitLayout}
          viewportWidth={winW}
          viewportHeight={winH}
        />
      ) : null}
    </View>
  );
}
