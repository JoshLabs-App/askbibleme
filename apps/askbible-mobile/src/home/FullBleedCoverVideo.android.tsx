import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ensureNatureSceneVideoReady,
  hasBundledNatureSceneVideo,
  isNatureSceneVideoReady,
} from "../media/natureSceneReadiness";
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
  nativeFullCover = false,
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
  /** 本场景曾成功出帧；金句临时静帧结束后勿重开超时锁。 */
  const sceneEverReadyRef = useRef(false);
  const [unpackEpoch, setUnpackEpoch] = useState(0);
  const {
    slotAScene,
    slotBScene,
    slotAMounted,
    slotBMounted,
    opacityA,
    opacityB,
    onSlotAReady,
    onSlotBReady,
    allowInitialPoster,
  } = useCoverVideoCrossfade(trimmedScene, crossfadeAnimated && !landscapeCover);

  const hasBundledVideo = hasBundledNatureSceneVideo(trimmedScene);
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
    // 仅换场景时清 ready；金句朗读 forcePoster 勿清，否则恢复后超时会误锁整会话静帧。
    videoReadyRef.current = false;
    sceneEverReadyRef.current = false;
  }, [hasPoster, trimmedScene]);

  // 解压完成后再开始解码超时；避免冷启动抢磁盘时误锁整会话静帧。
  useEffect(() => {
    if (forcePosterMode || !trimmedScene || !hasBundledVideo) return;
    let alive = true;
    void ensureNatureSceneVideoReady(trimmedScene).finally(() => {
      if (alive) setUnpackEpoch((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, [forcePosterMode, hasBundledVideo, trimmedScene]);

  useEffect(() => {
    if (!trimmedScene || hasBundledVideo) return;
    onSceneVideoReady?.(trimmedScene);
  }, [hasBundledVideo, onSceneVideoReady, trimmedScene]);

  // 从偏好静帧切回视频：需要新的就绪窗口。金句临时静帧结束且本场景已出过帧：保持 ready。
  useEffect(() => {
    if (forcePosterMode) return;
    if (sceneEverReadyRef.current) {
      videoReadyRef.current = true;
      return;
    }
    videoReadyRef.current = false;
  }, [forcePosterMode]);

  useEffect(() => {
    if (forcePosterMode || getCoverVideoPosterOnly() || !trimmedScene || !hasPoster) return;
    if (!hasBundledVideo) return;
    if (!playbackActive) return;
    if (videoReadyRef.current || sceneEverReadyRef.current) return;
    // 包内 mp4 尚未解压完：只显示海报，不要判整会话失败。
    if (!isNatureSceneVideoReady(trimmedScene)) return;

    const timer = setTimeout(() => {
      if (videoReadyRef.current || sceneEverReadyRef.current || getCoverVideoPosterOnly()) return;
      activatePosterFallback();
    }, COVER_VIDEO_READY_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [
    activatePosterFallback,
    forcePosterMode,
    hasBundledVideo,
    hasPoster,
    playbackActive,
    trimmedScene,
    unpackEpoch,
  ]);

  const markSlotReady = (id: string) => {
    videoReadyRef.current = true;
    sceneEverReadyRef.current = true;
    setShowInitialPoster(false);
    if (id) onSceneVideoReady?.(id);
  };

  const onSlotAReadyOnce = () => {
    onSlotAReady();
    markSlotReady(slotAScene.trim());
  };

  const onSlotBReadyOnce = () => {
    onSlotBReady();
    markSlotReady(slotBScene.trim());
  };

  const handlePlaybackError = useCallback(() => {
    activatePosterFallback();
  }, [activatePosterFallback]);

  if (!trimmedScene) return null;

  const posterStageActive = forcePosterMode || getCoverVideoPosterOnly() || !hasBundledVideo;
  // 静帧时不挂视频槽：安卓 expo-video 即使 muted 也会抢会话，打断读经。
  if (posterStageActive) {
    if (!hasPoster) return null;
    return (
      <View style={styles.stage} pointerEvents="none">
        <CoverVideoPosterBackdrop
          posterModule={posterModule}
          posterUri={trimmedPoster || undefined}
          portraitLayout={layerFrame}
          viewportWidth={winW}
          viewportHeight={winH}
        />
      </View>
    );
  }

  // 静帧叠在视频上，不拆层；静帧时暂停解码，避免切换露白跳闪。
  const videoPlaybackActive = playbackActive;
  const showPosterOverlay = showInitialPoster;

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
        playbackActive={videoPlaybackActive}
        mounted={slotAMounted}
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
        playbackActive={videoPlaybackActive}
        mounted={slotBMounted}
      />
      {showPosterOverlay && hasPoster ? (
        <CoverVideoPosterBackdrop
          posterModule={posterModule}
          posterUri={trimmedPoster || undefined}
          portraitLayout={layerFrame}
          viewportWidth={winW}
          viewportHeight={winH}
        />
      ) : null}
    </View>
  );
}
