"use client";

import { useCallback, useEffect, type RefObject } from "react";
import { useMediaPlaybackCoordinator } from "@/components/media/MediaPlaybackCoordinatorProvider";

type Options = {
  /** 当前页面确有背景视频逻辑时传 true */
  enabled: boolean;
  /** 稳定 surface 标识，用于注册/注销 */
  surfaceId: string;
};

/**
 * 背景静音视频与壳层音乐的协调（仅电视 `strictExclusive` 生效）。
 * `blockVideoDecoder` 在手机上恒为 false。
 */
export function useShellBackgroundVideoCoordination(
  videoRef: RefObject<HTMLVideoElement | null>,
  { enabled, surfaceId }: Options,
) {
  const { policy, shellAudioBlocksVideo, registerBackgroundVideo, onBackgroundVideoPlaying } =
    useMediaPlaybackCoordinator();

  useEffect(() => {
    if (!enabled) return;
    return registerBackgroundVideo(surfaceId, () => videoRef.current);
  }, [enabled, surfaceId, registerBackgroundVideo, videoRef]);

  const blockVideoDecoder = policy === "strictExclusive" && shellAudioBlocksVideo;

  const handleVideoPlaying = useCallback(() => {
    onBackgroundVideoPlaying();
  }, [onBackgroundVideoPlaying]);

  return { blockVideoDecoder, onVideoPlaying: handleVideoPlaying, policy };
}
