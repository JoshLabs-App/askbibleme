"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { useMediaPlaybackPolicy } from "@/hooks/useMediaPlaybackPolicy";
import type { MediaPlaybackPolicyTier } from "@/lib/media/media-playback-policy";

type VideoGetter = () => HTMLVideoElement | null;

export type MediaPlaybackCoordinatorValue = {
  policy: MediaPlaybackPolicyTier;
  /** 恒为 false（不再卸载背景视频；电视走短暂暂停后共存） */
  shellAudioBlocksVideo: boolean;
  registerBackgroundVideo: (id: string, getEl: VideoGetter) => () => void;
  /** 背景视频开始播放；`tvCoexist` 下不掐断壳层音乐 */
  onBackgroundVideoPlaying: () => void;
};

const MediaPlaybackCoordinatorContext = createContext<MediaPlaybackCoordinatorValue | null>(null);

export function useMediaPlaybackCoordinator(): MediaPlaybackCoordinatorValue {
  const ctx = useContext(MediaPlaybackCoordinatorContext);
  if (!ctx) {
    throw new Error("useMediaPlaybackCoordinator must be used within MediaPlaybackCoordinatorProvider");
  }
  return ctx;
}

function waitTwoAnimationFrames(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/**
 * 电视：`play()` 前短暂暂停背景视频，成功后恢复静音播放，尽量同时保留画面与音乐。
 * 手机：`normal`，无协调。
 */
export function MediaPlaybackCoordinatorProvider({ children }: { children: ReactNode }) {
  const policy = useMediaPlaybackPolicy();
  const { registerBeforeShellPlayHandler, registerAfterShellPlayHandler } = useMusicShellPlayback();
  const videosRef = useRef(new Map<string, VideoGetter>());

  const registerBackgroundVideo = useCallback((id: string, getEl: VideoGetter) => {
    videosRef.current.set(id, getEl);
    return () => {
      videosRef.current.delete(id);
    };
  }, []);

  const pauseRegisteredVideos = useCallback(() => {
    for (const getEl of videosRef.current.values()) {
      const v = getEl();
      if (!v) continue;
      try {
        if (!v.paused) v.pause();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const resumeRegisteredVideosMuted = useCallback(() => {
    for (const getEl of videosRef.current.values()) {
      const v = getEl();
      if (!v) continue;
      try {
        v.muted = true;
        if (v.paused) void v.play().catch(() => {});
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    return registerBeforeShellPlayHandler(async () => {
      if (policy !== "tvCoexist") return;
      pauseRegisteredVideos();
      await waitTwoAnimationFrames();
    });
  }, [policy, registerBeforeShellPlayHandler, pauseRegisteredVideos]);

  useEffect(() => {
    return registerAfterShellPlayHandler(async () => {
      if (policy !== "tvCoexist") return;
      await waitTwoAnimationFrames();
      resumeRegisteredVideosMuted();
    });
  }, [policy, registerAfterShellPlayHandler, resumeRegisteredVideosMuted]);

  const onBackgroundVideoPlaying = useCallback(() => {
    /* tvCoexist：视频恢复播放时不暂停壳层音乐 */
  }, []);

  const value = useMemo<MediaPlaybackCoordinatorValue>(
    () => ({
      policy,
      shellAudioBlocksVideo: false,
      registerBackgroundVideo,
      onBackgroundVideoPlaying,
    }),
    [policy, registerBackgroundVideo, onBackgroundVideoPlaying],
  );

  return (
    <MediaPlaybackCoordinatorContext.Provider value={value}>{children}</MediaPlaybackCoordinatorContext.Provider>
  );
}
