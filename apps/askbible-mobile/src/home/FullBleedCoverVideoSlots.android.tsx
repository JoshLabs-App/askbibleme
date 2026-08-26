import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState } from "react";
import { Animated, AppState, type AppStateStatus } from "react-native";
import {
  ensureNatureSceneVideoReady,
  getNatureSceneVideoFileUri,
} from "../media/natureSceneReadiness";
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
  source: string;
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
    const markReady = () => {
      if (!aliveRef.current || readyRef.current) return;
      readyRef.current = true;
      onReady();
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

function useAndroidCoverVideoSource(
  sceneId: string,
  resolveScenePlayback: ResolveNatureCoverPlayback,
  enabled: boolean,
): string | null {
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setSource(null);
      return;
    }
    const id = sceneId.trim();
    if (!id) {
      setSource(null);
      return;
    }
    let alive = true;
    void (async () => {
      try {
        await ensureNatureSceneVideoReady(id);
      } catch {
        if (!alive) return;
        setSource(null);
        return;
      }
      if (!alive) return;
      // 优先 readiness 缓存的 file URI（不二次 Asset.fromModule）。
      const cached = getNatureSceneVideoFileUri(id);
      if (cached) {
        setSource(cached);
        return;
      }
      const playback = resolveScenePlayback(id);
      const resolved = natureCoverVideoSource(playback);
      if (!alive) return;
      setSource(typeof resolved === "string" && resolved.trim() ? resolved.trim() : null);
    })();
    return () => {
      alive = false;
    };
  }, [enabled, sceneId, resolveScenePlayback]);

  return source;
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
  mounted = true,
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
  mounted?: boolean;
}) {
  const source = useAndroidCoverVideoSource(sceneId, resolveScenePlayback, mounted);
  const playback = source ? resolveScenePlayback(sceneId) : null;
  const [activityReady, setActivityReady] = useState(false);

  useEffect(() => {
    if (!mounted) {
      setActivityReady(false);
      return;
    }
    let cancelled = false;
    const arm = (state: AppStateStatus) => {
      if (cancelled) return;
      setActivityReady(state === "active");
    };
    const timer = setTimeout(() => arm(AppState.currentState), 80);
    const sub = AppState.addEventListener("change", arm);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      sub.remove();
    };
  }, [mounted, sceneId, source]);

  useEffect(() => {
    if (!mounted) return;
    if (playback && portraitMode) {
      onNaturalAspect(NATURE_HOME_VIDEO_LANDSCAPE_ASPECT);
    }
  }, [mounted, onNaturalAspect, playback, portraitMode, sceneId]);

  if (!mounted || !activityReady || !sceneId.trim() || !source) return null;

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
