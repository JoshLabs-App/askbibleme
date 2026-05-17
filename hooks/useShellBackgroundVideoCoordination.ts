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
 * 注册背景视频供电视协调器短暂暂停/恢复；不再卸载 `<video>`。
 * `blockVideoDecoder` 恒为 false。
 */
export function useShellBackgroundVideoCoordination(
  videoRef: RefObject<HTMLVideoElement | null>,
  { enabled, surfaceId }: Options,
) {
  const { policy, registerBackgroundVideo, onBackgroundVideoPlaying } = useMediaPlaybackCoordinator();

  useEffect(() => {
    if (!enabled) return;
    return registerBackgroundVideo(surfaceId, () => videoRef.current);
  }, [enabled, surfaceId, registerBackgroundVideo, videoRef]);

  const handleVideoPlaying = useCallback(() => {
    onBackgroundVideoPlaying();
  }, [onBackgroundVideoPlaying]);

  return { blockVideoDecoder: false, onVideoPlaying: handleVideoPlaying, policy };
}
