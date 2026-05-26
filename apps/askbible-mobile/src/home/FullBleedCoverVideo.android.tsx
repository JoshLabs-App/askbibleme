import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Image,
  StyleSheet,
  View,
  type AppStateStatus,
} from "react-native";
import {
  resolveNatureHomePortraitCoverLayout,
  type PortraitCoverLayout,
} from "./natureHomePortraitCoverLayout";
import { NATURE_HOME_VIDEO_LANDSCAPE_ASPECT } from "./nature-home-portrait-pan";
import { useShellFullBleedFrame } from "../shell/shellLayout";
import {
  natureCoverVideoSource,
  type ResolveNatureCoverPlayback,
} from "./natureCoverPlayback";
import { useCoverVideoCrossfade } from "./useCoverVideoCrossfade";
import { useNatureHomePortraitPan } from "./useNatureHomePortraitPan";
import { useNatureHomeFullscreenStepPan } from "./useNatureHomeFullscreenStepPan";
export type FullBleedCoverVideoLayoutMode = "portrait-cover" | "landscape-cover";

const STAGE_BACKDROP = "#14110e";
const VIDEO_OVERDRAW_PX = 2;
const FULLSCREEN_VIDEO_ASPECT = 16 / 9;

type Props = {
  sceneId: string;
  resolveScenePlayback: ResolveNatureCoverPlayback;
  posterUri?: string;
  /** Android: 模糊模式下直接用静帧，停用视频层 */
  forcePosterMode?: boolean;
  rate?: number;
  layoutMode?: FullBleedCoverVideoLayoutMode;
  nativeFullCover?: boolean;
  onSceneVideoReady?: (sceneId: string) => void;
};

function CoverVideoSlotInner({
  slotKey,
  sceneId,
  source,
  rate,
  layerWidth,
  layerHeight,
  layerTop,
  panX,
  panEnabled,
  opacity,
  onReady,
}: {
  slotKey: string;
  sceneId: string;
  source: string | number;
  rate: number;
  layerWidth: number;
  layerHeight: number;
  layerTop: number;
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
        {
          width: layerWidth,
          height: layerHeight,
          top: layerTop,
          opacity,
        },
        panEnabled ? { transform: [{ translateX: panX }] } : null,
      ]}
      pointerEvents="none"
      renderToHardwareTextureAndroid
    >
      <VideoView
        key={`${slotKey}|${sceneId}`}
        player={player}
        style={{
          width: layerWidth + VIDEO_OVERDRAW_PX * 2,
          height: layerHeight,
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
  portraitLayout,
  portraitMode,
  panX,
  panEnabled,
  opacity,
  viewportWidth,
  viewportHeight,
  onNaturalAspect,
  onReady,
}: {
  slotKey: string;
  sceneId: string;
  resolveScenePlayback: ResolveNatureCoverPlayback;
  rate: number;
  portraitLayout: PortraitCoverLayout | null;
  portraitMode: boolean;
  panX: Animated.Value;
  panEnabled: boolean;
  opacity: Animated.Value;
  viewportWidth: number;
  viewportHeight: number;
  onNaturalAspect: (aspect: number) => void;
  onReady: () => void;
}) {
  const playback = resolveScenePlayback(sceneId);
  const source = natureCoverVideoSource(playback);

  useEffect(() => {
    if (playback && portraitMode) {
      onNaturalAspect(NATURE_HOME_VIDEO_LANDSCAPE_ASPECT);
    }
  }, [onNaturalAspect, playback, portraitMode, sceneId]);

  if (!sceneId.trim() || source == null) return null;

  const layout = portraitLayout;
  const layerWidth = portraitMode && layout ? layout.width : Math.max(viewportWidth, Math.round(viewportHeight * FULLSCREEN_VIDEO_ASPECT));
  const layerHeight = portraitMode && layout ? layout.height : viewportHeight;
  const layerTop = portraitMode && layout ? layout.top : 0;

  const slot = (
    <CoverVideoSlotInner
      slotKey={slotKey}
      sceneId={sceneId}
      source={source}
      rate={rate}
      layerWidth={layerWidth}
      layerHeight={layerHeight}
      layerTop={layerTop}
      panX={panX}
      panEnabled={panEnabled}
      opacity={opacity}
      onReady={onReady}
    />
  );

  if (!panEnabled || !layout) return slot;

  return (
    <View
      style={[styles.clipViewport, { width: viewportWidth, height: viewportHeight }]}
      pointerEvents="none"
    >
      {slot}
    </View>
  );
}

/** Android：包内 mp4 + 双槽交叉淡入（expo-video；避免 expo-av Video 与 native-driver 动画黑屏） */
export function FullBleedCoverVideo({
  sceneId,
  resolveScenePlayback,
  posterUri,
  forcePosterMode = false,
  rate = 1,
  layoutMode = "portrait-cover",
  onSceneVideoReady,
}: Props) {
  const trimmedScene = sceneId.trim();
  const trimmedPoster = posterUri?.trim() ?? "";
  const frame = useShellFullBleedFrame();
  const winW = frame.width;
  const winH = frame.height;
  const landscapeCover = layoutMode === "landscape-cover";
  const [reduceMotion, setReduceMotion] = useState(false);
  const [mediaAspect, setMediaAspect] = useState(NATURE_HOME_VIDEO_LANDSCAPE_ASPECT);
  const {
    slotAScene,
    slotBScene,
    opacityA,
    opacityB,
    onSlotAReady,
    onSlotBReady,
    allowInitialPoster,
  } = useCoverVideoCrossfade(trimmedScene, !landscapeCover);

  const portraitLayout = useMemo(
    () => (landscapeCover ? null : resolveNatureHomePortraitCoverLayout(winW, winH, mediaAspect)),
    [landscapeCover, winW, winH, mediaAspect],
  );
  const portraitMode = !landscapeCover;
  const fullscreenSweepWidth = Math.max(winW, Math.round(winH * FULLSCREEN_VIDEO_ASPECT));
  // Android home should stay visually stable during testing: disable auto pan.
  const panEnabled = false;
  const portraitPanX = useNatureHomePortraitPan(
    panEnabled,
    portraitLayout?.width ?? fullscreenSweepWidth,
    winW,
    trimmedScene,
  );
  const fullscreenPanX = useNatureHomeFullscreenStepPan(
    landscapeCover && panEnabled,
    fullscreenSweepWidth,
    winW,
    `${trimmedScene}|${layoutMode}`,
  );
  const panX = landscapeCover ? fullscreenPanX : portraitPanX;
  const [showInitialPoster, setShowInitialPoster] = useState(
    () => Boolean(trimmedPoster) && allowInitialPoster,
  );

  const onNaturalAspect = useCallback((aspect: number) => {
    if (!Number.isFinite(aspect) || aspect <= 0) return;
    setMediaAspect((prev) => (Math.abs(prev - aspect) < 0.01 ? prev : aspect));
  }, []);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!allowInitialPoster) setShowInitialPoster(false);
  }, [allowInitialPoster]);

  useEffect(() => {
    const resume = (state: AppStateStatus) => {
      if (state !== "active" || !trimmedScene) return;
    };
    const sub = AppState.addEventListener("change", resume);
    return () => sub.remove();
  }, [trimmedScene]);

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

  if (forcePosterMode && trimmedPoster) {
    return (
      <View style={styles.stage} pointerEvents="none">
        <View style={styles.posterCover} pointerEvents="none">
          <Image source={{ uri: trimmedPoster }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.stage} pointerEvents="none">
      <CoverVideoSlot
        slotKey="cover-a"
        sceneId={slotAScene}
        resolveScenePlayback={resolveScenePlayback}
        rate={rate}
        portraitLayout={portraitLayout}
        portraitMode={portraitMode}
        panX={panX}
        panEnabled={panEnabled}
        opacity={opacityA}
        viewportWidth={winW}
        viewportHeight={winH}
        onNaturalAspect={onNaturalAspect}
        onReady={onSlotAReadyOnce}
      />
      <CoverVideoSlot
        slotKey="cover-b"
        sceneId={slotBScene}
        resolveScenePlayback={resolveScenePlayback}
        rate={rate}
        portraitLayout={portraitLayout}
        portraitMode={portraitMode}
        panX={panX}
        panEnabled={panEnabled}
        opacity={opacityB}
        viewportWidth={winW}
        viewportHeight={winH}
        onNaturalAspect={onNaturalAspect}
        onReady={onSlotBReadyOnce}
      />
      {showInitialPoster && trimmedPoster ? (
        portraitLayout ? (
          <View
            style={[styles.clipViewport, styles.posterCover, { width: winW, height: winH }]}
            pointerEvents="none"
          >
            <Animated.View
              style={[
                styles.posterPan,
                {
                  width: portraitLayout.width,
                  height: portraitLayout.height,
                  top: portraitLayout.top,
                },
                panEnabled ? { transform: [{ translateX: panX }] } : null,
              ]}
            >
              <Image
                source={{ uri: trimmedPoster }}
                style={{ width: portraitLayout.width, height: portraitLayout.height }}
                resizeMode="cover"
              />
            </Animated.View>
          </View>
        ) : (
          <View style={styles.posterCover} pointerEvents="none">
            <Image source={{ uri: trimmedPoster }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          </View>
        )
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
  clipViewport: {
    position: "absolute",
    left: 0,
    top: 0,
    overflow: "hidden",
  },
  slot: {
    position: "absolute",
    left: 0,
  },
  posterPan: {
    position: "absolute",
    left: 0,
    overflow: "hidden",
  },
  posterCover: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
    backgroundColor: STAGE_BACKDROP,
  },
});
