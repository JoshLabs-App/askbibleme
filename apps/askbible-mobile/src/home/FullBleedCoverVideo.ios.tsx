import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Image,
  StyleSheet,
  useWindowDimensions,
  View,
  type AppStateStatus,
} from "react-native";
import {
  natureCoverVideoSource,
  type ResolveNatureCoverPlayback,
} from "./natureCoverPlayback";
import { useCoverVideoCrossfade } from "./useCoverVideoCrossfade";
import { resolveNatureHomePortraitCoverLayout } from "./natureHomePortraitCoverLayout";
export type FullBleedCoverVideoLayoutMode = "portrait-cover" | "landscape-cover";

const STAGE_BACKDROP = "#14110e";
const VIDEO_OVERDRAW_PX = 2;
const FULLSCREEN_VIDEO_ASPECT = 16 / 9;

type CoverLayerFrame = {
  left: number;
  top: number;
  width: number;
  height: number;
};

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
};

function CoverVideoSlotInner({
  slotKey,
  sceneId,
  source,
  rate,
  layerFrame,
  opacity,
  onReady,
  playbackActive,
}: {
  slotKey: string;
  sceneId: string;
  source: string | number;
  rate: number;
  layerFrame: CoverLayerFrame;
  opacity: Animated.Value;
  onReady: () => void;
  playbackActive: boolean;
}) {
  const readyRef = useRef(false);
  const clampedRate = Math.min(2, Math.max(0.5, rate));
  const layerWidth = layerFrame.width;

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
    const sync = (state: AppStateStatus) => {
      try {
        if (playbackActive && state === "active") player.play();
        else player.pause();
      } catch {
        /* ignore */
      }
    };
    sync(AppState.currentState);
    const sub = AppState.addEventListener("change", sync);
    return () => sub.remove();
  }, [playbackActive, player]);

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
        {
          left: layerFrame.left,
          top: layerFrame.top,
          width: layerWidth,
          height: layerFrame.height,
          opacity,
        },
      ]}
      pointerEvents="none"
    >
      <VideoView
        key={`${slotKey}|${sceneId}`}
        player={player}
        style={{
          width: layerWidth + VIDEO_OVERDRAW_PX * 2,
          height: layerFrame.height,
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
  layerFrame,
  opacity,
  onReady,
  playbackActive,
}: {
  slotKey: string;
  sceneId: string;
  resolveScenePlayback: ResolveNatureCoverPlayback;
  rate: number;
  layerFrame: CoverLayerFrame;
  opacity: Animated.Value;
  onReady: () => void;
  playbackActive: boolean;
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
      layerFrame={layerFrame}
      opacity={opacity}
      onReady={onReady}
      playbackActive={playbackActive}
    />
  );
}

function resolveLandscapeCoverLayerFrame(viewportWidth: number, viewportHeight: number): CoverLayerFrame {
  const width = Math.max(viewportWidth, Math.round(viewportHeight * FULLSCREEN_VIDEO_ASPECT));
  return {
    left: (viewportWidth - width) / 2,
    top: 0,
    width,
    height: viewportHeight,
  };
}

/** iOS：包内 mp4 + 双槽交叉淡入（expo-video，避免 expo-av 在 iOS 16+ 上 KVO 崩溃） */
export function FullBleedCoverVideo({
  sceneId,
  resolveScenePlayback,
  posterUri,
  posterModule: _posterModule = null,
  forcePosterMode: _forcePosterMode = false,
  rate = 1,
  layoutMode = "portrait-cover",
  onSceneVideoReady,
  playbackActive = true,
}: Props) {
  const trimmedScene = sceneId.trim();
  const trimmedPoster = posterUri?.trim() ?? "";
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
  } = useCoverVideoCrossfade(trimmedScene, !landscapeCover);

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

  return (
    <View style={styles.stage} pointerEvents="none">
      <CoverVideoSlot
        slotKey="cover-a"
        sceneId={slotAScene}
        resolveScenePlayback={resolveScenePlayback}
        rate={rate}
        layerFrame={layerFrame}
        opacity={opacityA}
        onReady={onSlotAReadyOnce}
        playbackActive={playbackActive}
      />
      <CoverVideoSlot
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

const styles = StyleSheet.create({
  stage: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    backgroundColor: STAGE_BACKDROP,
  },
  slot: {
    position: "absolute",
  },
  posterCover: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
    backgroundColor: STAGE_BACKDROP,
  },
});
