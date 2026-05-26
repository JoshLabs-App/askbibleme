import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Image,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import {
  natureCoverVideoSource,
  type ResolveNatureCoverPlayback,
} from "./natureCoverPlayback";
import { useCoverVideoCrossfade } from "./useCoverVideoCrossfade";
import {
  natureHomePortraitScaledWidth,
  useNatureHomePortraitPan,
} from "./useNatureHomePortraitPan";
import { useNatureHomeFullscreenStepPan } from "./useNatureHomeFullscreenStepPan";
export type FullBleedCoverVideoLayoutMode = "portrait-cover" | "landscape-cover";

const STAGE_BACKDROP = "#14110e";
const VIDEO_OVERDRAW_PX = 2;
const FULLSCREEN_VIDEO_ASPECT = 16 / 9;

type Props = {
  sceneId: string;
  resolveScenePlayback: ResolveNatureCoverPlayback;
  posterUri?: string;
  forcePosterMode?: boolean;
  rate?: number;
  layoutMode?: FullBleedCoverVideoLayoutMode;
  nativeFullCover?: boolean;
  /** 某场景首帧可播（用于区分「本机直切」与「首次载入」） */
  onSceneVideoReady?: (sceneId: string) => void;
};

function CoverVideoSlotInner({
  slotKey,
  sceneId,
  source,
  rate,
  scaledWidth,
  panX,
  panEnabled,
  opacity,
  onReady,
}: {
  slotKey: string;
  sceneId: string;
  source: string | number;
  rate: number;
  scaledWidth: number;
  panX: Animated.Value;
  panEnabled: boolean;
  opacity: Animated.Value;
  onReady: () => void;
}) {
  const readyRef = useRef(false);
  const clampedRate = Math.min(2, Math.max(0.5, rate));

  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.audioMixingMode = "mixWithOthers";
    p.playbackRate = clampedRate;
    p.play();
  });

  useEffect(() => {
    readyRef.current = false;
  }, [sceneId]);

  useEffect(() => {
    player.playbackRate = clampedRate;
  }, [clampedRate, player]);

  useEffect(() => {
    if (!source) return;
    const markReady = () => {
      if (readyRef.current) return;
      readyRef.current = true;
      onReady();
    };
    const playingSub = player.addListener("playingChange", ({ isPlaying }) => {
      if (isPlaying) markReady();
    });
    const statusSub = player.addListener("statusChange", ({ status }) => {
      if (status === "readyToPlay") markReady();
    });
    return () => {
      playingSub.remove();
      statusSub.remove();
    };
  }, [onReady, player, sceneId, source]);

  return (
    <Animated.View
      style={[
        styles.slot,
        { width: scaledWidth, opacity },
        panEnabled ? { transform: [{ translateX: panX }] } : null,
      ]}
      pointerEvents="none"
    >
      <VideoView
        key={`${slotKey}|${sceneId}`}
        player={player}
        style={{
          width: scaledWidth + VIDEO_OVERDRAW_PX * 2,
          height: "100%",
          marginLeft: -VIDEO_OVERDRAW_PX,
        }}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
    </Animated.View>
  );
}

function CoverVideoSlot({
  slotKey,
  sceneId,
  resolveScenePlayback,
  rate,
  scaledWidth,
  panX,
  panEnabled,
  opacity,
  onReady,
}: {
  slotKey: string;
  sceneId: string;
  resolveScenePlayback: ResolveNatureCoverPlayback;
  rate: number;
  scaledWidth: number;
  panX: Animated.Value;
  panEnabled: boolean;
  opacity: Animated.Value;
  onReady: () => void;
}) {
  if (!sceneId.trim()) return null;
  const source = natureCoverVideoSource(resolveScenePlayback(sceneId));
  if (source == null) return null;
  return (
    <CoverVideoSlotInner
      slotKey={slotKey}
      sceneId={sceneId}
      source={source}
      rate={rate}
      scaledWidth={scaledWidth}
      panX={panX}
      panEnabled={panEnabled}
      opacity={opacity}
      onReady={onReady}
    />
  );
}

/** iOS：包内 mp4 + 双槽交叉淡入（expo-video，避免 expo-av 在 iOS 16+ 上 KVO 崩溃） */
export function FullBleedCoverVideo({
  sceneId,
  resolveScenePlayback,
  posterUri,
  forcePosterMode: _forcePosterMode = false,
  rate = 1,
  layoutMode = "portrait-cover",
  onSceneVideoReady,
}: Props) {
  const trimmedScene = sceneId.trim();
  const trimmedPoster = posterUri?.trim() ?? "";
  const { width: winW, height: winH } = useWindowDimensions();
  const landscapeCover = layoutMode === "landscape-cover";
  const [reduceMotion, setReduceMotion] = useState(false);
  const {
    slotAScene,
    slotBScene,
    opacityA,
    opacityB,
    onSlotAReady,
    onSlotBReady,
    allowInitialPoster,
  } = useCoverVideoCrossfade(trimmedScene, !landscapeCover);

  const scaledWidth = landscapeCover
    ? Math.max(winW, Math.round(winH * FULLSCREEN_VIDEO_ASPECT))
    : natureHomePortraitScaledWidth(winW, winH);
  // Keep iOS home background stable: disable auto pan.
  const panEnabled = false;
  const portraitPanX = useNatureHomePortraitPan(panEnabled, scaledWidth, winW, trimmedScene);
  const fullscreenPanX = useNatureHomeFullscreenStepPan(
    landscapeCover && panEnabled,
    scaledWidth,
    winW,
    `${trimmedScene}|${layoutMode}`,
  );
  const panX = landscapeCover ? fullscreenPanX : portraitPanX;

  const [showInitialPoster, setShowInitialPoster] = useState(
    () => Boolean(trimmedPoster) && allowInitialPoster,
  );

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub.remove();
  }, []);

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

  return (
    <View style={styles.stage} pointerEvents="none">
      <CoverVideoSlot
        slotKey="cover-a"
        sceneId={slotAScene}
        resolveScenePlayback={resolveScenePlayback}
        rate={rate}
        scaledWidth={scaledWidth}
        panX={panX}
        panEnabled={panEnabled}
        opacity={opacityA}
        onReady={onSlotAReadyOnce}
      />
      <CoverVideoSlot
        slotKey="cover-b"
        sceneId={slotBScene}
        resolveScenePlayback={resolveScenePlayback}
        rate={rate}
        scaledWidth={scaledWidth}
        panX={panX}
        panEnabled={panEnabled}
        opacity={opacityB}
        onReady={onSlotBReadyOnce}
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

const styles = StyleSheet.create({
  stage: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    backgroundColor: STAGE_BACKDROP,
  },
  slot: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
  },
  posterCover: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
    backgroundColor: STAGE_BACKDROP,
  },
});
