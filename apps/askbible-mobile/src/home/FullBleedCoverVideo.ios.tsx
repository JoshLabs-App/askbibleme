import { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, useWindowDimensions, View } from "react-native";
import { CoverVideoPosterBackdrop } from "./CoverVideoPosterBackdrop";
import type { ResolveNatureCoverPlayback } from "./natureCoverPlayback";
import { useCoverVideoCrossfade } from "./useCoverVideoCrossfade";
import { resolveNatureHomePortraitCoverLayout } from "./natureHomePortraitCoverLayout";
import { hasCoverVideoPosterAsset } from "./coverVideoPosterFallback";
import { IosCoverVideoSlot } from "./FullBleedCoverVideoSlots.ios";
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
  forcePosterMode?: boolean;
  rate?: number;
  layoutMode?: FullBleedCoverVideoLayoutMode;
  nativeFullCover?: boolean;
  /** 某场景首帧可播（用于区分「本机直切」与「首次载入」） */
  onSceneVideoReady?: (sceneId: string) => void;
  /** Tab 失焦时暂停解码，回到 Home 再续播 */
  playbackActive?: boolean;
  /** false：场景切换瞬时切，避免双路解码（省电 / 减发热） */
  crossfadeAnimated?: boolean;
};

/** iOS：包内 mp4 + 双槽交叉淡入（expo-video，避免 expo-av 在 iOS 16+ 上 KVO 崩溃） */
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
  const { width: winW, height: winH } = useWindowDimensions();
  const landscapeCover = layoutMode === "landscape-cover";
  const {
    slotAScene,
    slotBScene,
    opacityA,
    opacityB,
    onSlotAReady,
    onSlotBReady,
    allowInitialPoster,
  } = useCoverVideoCrossfade(trimmedScene, crossfadeAnimated && !landscapeCover);

  const layerFrame = useMemo(
    () =>
      landscapeCover
        ? resolveLandscapeCoverLayerFrame(winW, winH)
        : resolveNatureHomePortraitCoverLayout(winW, winH),
    [landscapeCover, winH, winW],
  );

  const [showInitialPoster, setShowInitialPoster] = useState(
    () => Boolean(trimmedPoster) && allowInitialPoster,
  );

  useEffect(() => {
    if (!allowInitialPoster) setShowInitialPoster(false);
  }, [allowInitialPoster]);

  const onSlotAReadyOnce = () => {
    onSlotAReady();
    setShowInitialPoster(false);
    if (slotAScene.trim()) onSceneVideoReady?.(slotAScene.trim());
  };

  const onSlotBReadyOnce = () => {
    onSlotBReady();
    setShowInitialPoster(false);
    if (slotBScene.trim()) onSceneVideoReady?.(slotBScene.trim());
  };

  if (!trimmedScene) return null;

  if (forcePosterMode) {
    return (
      <View style={styles.stage} pointerEvents="none">
        {hasPoster ? (
          <CoverVideoPosterBackdrop
            posterModule={posterModule}
            posterUri={trimmedPoster || undefined}
            portraitLayout={landscapeCover ? null : layerFrame}
            viewportWidth={winW}
            viewportHeight={winH}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.stage} pointerEvents="none">
      <IosCoverVideoSlot
        slotKey="cover-a"
        sceneId={slotAScene}
        resolveScenePlayback={resolveScenePlayback}
        rate={rate}
        layerFrame={layerFrame}
        opacity={opacityA}
        onReady={onSlotAReadyOnce}
        playbackActive={playbackActive}
      />
      <IosCoverVideoSlot
        slotKey="cover-b"
        sceneId={slotBScene}
        resolveScenePlayback={resolveScenePlayback}
        rate={rate}
        layerFrame={layerFrame}
        opacity={opacityB}
        onReady={onSlotBReadyOnce}
        playbackActive={playbackActive}
      />
      {showInitialPoster && trimmedPoster ? (
        <View style={styles.posterCover} pointerEvents="none">
          <Image
            source={{ uri: trimmedPoster }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
        </View>
      ) : null}
    </View>
  );
}
