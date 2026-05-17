"use client";

import { useCallback, useEffect, type RefObject } from "react";
import { useMediaPlaybackCoordinator } from "@/components/media/MediaPlaybackCoordinatorProvider";

type Options = {
  enabled: boolean;
  surfaceId: string;
};

/**
 * 电视：壳层音乐在播时 `blockVideoDecoder`，露出静图；手机恒为 false。
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

  const blockVideoDecoder = policy === "tvCoexist" && shellAudioBlocksVideo;

  const handleVideoPlaying = useCallback(() => {
    onBackgroundVideoPlaying();
  }, [onBackgroundVideoPlaying]);

  return {
    blockVideoDecoder,
    shellAudioBlocksVideo: policy === "tvCoexist" && shellAudioBlocksVideo,
    onVideoPlaying: handleVideoPlaying,
    policy,
  };
}
