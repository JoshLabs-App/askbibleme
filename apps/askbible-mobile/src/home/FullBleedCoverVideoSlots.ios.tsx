import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState } from "react";
import { Animated, AppState, type AppStateStatus } from "react-native";
import { ensureNatureSceneVideoReady } from "../media/natureSceneReadiness";
import {
  natureCoverVideoSource,
  type ResolveNatureCoverPlayback,
} from "./natureCoverPlayback";
import {
  FULL_BLEED_VIDEO_OVERDRAW_PX,
  fullBleedCoverVideoStyles as styles,
  type CoverLayerFrame,
} from "./fullBleedCoverVideoShared";

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
    // 静音封面：用 mixWithOthers 以免打断前台音乐；锁屏前父组件必须卸掉本槽，
    // 并由 AskBibleMusicService 抢回 longFormAudio（否则 moviePlayback+mix 约 60s 挂起）。
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
        // 关屏一律 pause；音乐在播时额外 replace nil，避免第二路 AVPlayer 扰会话。
        if (state === "active") {
          if (playbackActive) player.play();
          else player.pause();
          return;
        }
        player.pause();
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

function useIosCoverVideoSource(
  sceneId: string,
  resolveScenePlayback: ResolveNatureCoverPlayback,
): string | number | null {
  const [source, setSource] = useState<string | number | null>(null);

  useEffect(() => {
    const id = sceneId.trim();
    if (!id) {
      setSource(null);
      return;
    }
    let alive = true;
    void (async () => {
      await ensureNatureSceneVideoReady(id);
      if (!alive) return;
      setSource(natureCoverVideoSource(resolveScenePlayback(id)));
    })();
    return () => {
      alive = false;
    };
  }, [sceneId, resolveScenePlayback]);

  return source;
}

export function IosCoverVideoSlot({
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
  const source = useIosCoverVideoSource(sceneId, resolveScenePlayback);
  if (!sceneId.trim() || source == null) return null;
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
