import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef } from "react";
import { Animated, AppState, type AppStateStatus } from "react-native";
import {
  natureCoverVideoSource,
  type ResolveNatureCoverPlayback,
} from "./natureCoverPlayback";
import { NATURE_HOME_VIDEO_LANDSCAPE_ASPECT } from "./nature-home-portrait-pan";
import {
  FULL_BLEED_VIDEO_OVERDRAW_PX,
  fullBleedCoverVideoStyles as styles,
  type CoverLayerFrame,
} from "./fullBleedCoverVideoShared";

function safePlayerCall(onReleased: () => void, fn: () => void) {
  try {
    fn();
  } catch {
    onReleased();
  }
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
          width: layerWidth + FULL_BLEED_VIDEO_OVERDRAW_PX * 2,
          height: layerFrame.height,
          marginLeft: -FULL_BLEED_VIDEO_OVERDRAW_PX,
        }}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
    </Animated.View>
  );
}

export function AndroidCoverVideoSlot({
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
