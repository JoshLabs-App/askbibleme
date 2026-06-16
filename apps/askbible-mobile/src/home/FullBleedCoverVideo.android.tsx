import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  AppState,
  StyleSheet,
  View,
  type AppStateStatus,
} from "react-native";
import { CoverVideoPosterBackdrop } from "./CoverVideoPosterBackdrop";
import {
  COVER_VIDEO_READY_TIMEOUT_MS,
  getCoverVideoPosterOnly,
  hasCoverVideoPosterAsset,
  markCoverVideoSessionPosterOnly,
} from "./coverVideoPosterFallback";
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
  /** Android: 模糊模式下直接用静帧，停用视频层 */
  forcePosterMode?: boolean;
  rate?: number;
  layoutMode?: FullBleedCoverVideoLayoutMode;
  nativeFullCover?: boolean;
  onSceneVideoReady?: (sceneId: string) => void;
  /** Tab 失焦时暂停解码，回到 Home 再续播 */
  playbackActive?: boolean;
};

function safePlayerCall(onReleased: () => void, fn: () => void) {
  try {
    fn();
  } catch {
    onReleased();
  }
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

function CoverVideoSlotInner({
  sceneId,
  source,
  rate,
  layerFrame,
  opacity,
  onReady,
  onPlaybackError,
  playbackActive,
}: {
  sceneId: string;
  source: string | number;
  rate: number;
  layerFrame: CoverLayerFrame;
  opacity: Animated.Value;
  onReady: () => void;
  onPlaybackError: () => void;
  playbackActive: boolean;
}) {
  const readyRef = useRef(false);
  const aliveRef = useRef(true);
  const clampedRate = Math.min(2, Math.max(0.5, rate));
  const onReleased = onPlaybackError;
  const layerWidth = layerFrame.width;

  const player = useVideoPlayer(source, (p) => {
    safePlayerCall(onReleased, () => {
      p.loop = true;
      p.muted = true;
      p.audioMixingMode = "mixWithOthers";
      p.playbackRate = clampedRate;
      p.play();
    });
  });

  useEffect(() => {
    aliveRef.current = true;
    readyRef.current = false;
    return () => {
      aliveRef.current = false;
    };
  }, [sceneId, source]);

  useEffect(() => {
    safePlayerCall(onReleased, () => {
      player.playbackRate = clampedRate;
    });
  }, [clampedRate, onReleased, player]);

  useEffect(() => {
    const sync = (state: AppStateStatus) => {
      if (!aliveRef.current) return;
      safePlayerCall(onReleased, () => {
        if (playbackActive && state === "active") player.play();
        else player.pause();
      });
    };
    sync(AppState.currentState);
    const sub = AppState.addEventListener("change", sync);
    return () => sub.remove();
  }, [onReleased, playbackActive, player]);

  useEffect(() => {
    if (!source) return;
    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    const clearStallTimer = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = null;
    };
    const markReady = () => {
      if (!aliveRef.current || readyRef.current) return;
      readyRef.current = true;
      onReady();
      clearStallTimer();
      stallTimer = setTimeout(() => {
        if (!aliveRef.current) return;
        safePlayerCall(onReleased, () => {
          if (player.currentTime < 0.05) onPlaybackError();
        });
      }, 2200);
    };
    const playingSub = player.addListener("playingChange", ({ isPlaying }) => {
      if (!aliveRef.current) return;
      if (isPlaying) markReady();
    });
    const statusSub = player.addListener("statusChange", ({ status, error }) => {
      if (!aliveRef.current) return;
      if (status === "readyToPlay") markReady();
      if (status === "error" || error) onPlaybackError();
    });
    return () => {
      clearStallTimer();
      playingSub.remove();
      statusSub.remove();
    };
  }, [onPlaybackError, onReady, onReleased, player, sceneId, source]);

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
  onNaturalAspect,
  onReady,
  onPlaybackError,
  playbackActive,
  portraitMode,
}: {
  slotKey: string;
  sceneId: string;
  resolveScenePlayback: ResolveNatureCoverPlayback;
  rate: number;
  layerFrame: CoverLayerFrame;
  opacity: Animated.Value;
  onNaturalAspect: (aspect: number) => void;
  onReady: () => void;
  onPlaybackError: () => void;
  playbackActive: boolean;
  portraitMode: boolean;
}) {
  const playback = resolveScenePlayback(sceneId);
  const source = natureCoverVideoSource(playback);

  useEffect(() => {
    if (playback && portraitMode) {
      onNaturalAspect(NATURE_HOME_VIDEO_LANDSCAPE_ASPECT);
    }
  }, [onNaturalAspect, playback, portraitMode, sceneId]);

  if (!sceneId.trim() || source == null) return null;

  return (
    <CoverVideoSlotInner
      key={`${slotKey}|${sceneId}`}
      sceneId={sceneId}
      source={source}
      rate={rate}
      layerFrame={layerFrame}
      opacity={opacity}
      onReady={onReady}
      onPlaybackError={onPlaybackError}
      playbackActive={playbackActive}
    />
  );
}

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
}: Props) {
  const trimmedScene = sceneId.trim();
  const trimmedPoster = posterUri?.trim() ?? "";
  const hasPoster = hasCoverVideoPosterAsset(posterModule, trimmedPoster);
  const frame = useShellFullBleedFrame();
  const winW = frame.width;
  const winH = frame.height;
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
  } = useCoverVideoCrossfade(trimmedScene, !landscapeCover);

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

  if (posterStageActive && hasPoster) {
    return (
      <View style={styles.stage} pointerEvents="none">
        <CoverVideoPosterBackdrop
          posterModule={posterModule}
          posterUri={trimmedPoster || undefined}
          portraitLayout={portraitLayout}
          viewportWidth={winW}
          viewportHeight={winH}
        />
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
        layerFrame={layerFrame}
        opacity={opacityA}
        portraitMode={portraitMode}
        onNaturalAspect={onNaturalAspect}
        onReady={onSlotAReadyOnce}
        onPlaybackError={handlePlaybackError}
        playbackActive={playbackActive}
      />
      <CoverVideoSlot
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

const styles = StyleSheet.create({
  stage: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    backgroundColor: STAGE_BACKDROP,
  },
  slot: {
    position: "absolute",
  },
});
