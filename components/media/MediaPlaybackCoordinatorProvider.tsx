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
  /** strict + 壳层音乐在播：背景视频应停解码（仅电视等） */
  shellAudioBlocksVideo: boolean;
  registerBackgroundVideo: (id: string, getEl: VideoGetter) => () => void;
  /** 背景视频开始播放（strict：暂停壳层音乐） */
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

/**
 * 方案 A：壳层 `<audio>` 与背景 `<video>` 互斥（仅 `strictExclusive`）。
 * 方案 B：策略由 UA 判定；手机恒为 `normal`，行为与改前一致。
 */
export function MediaPlaybackCoordinatorProvider({ children }: { children: ReactNode }) {
  const policy = useMediaPlaybackPolicy();
  const { playing, pausePlayback } = useMusicShellPlayback();
  const videosRef = useRef(new Map<string, VideoGetter>());
  const pauseShellRef = useRef(pausePlayback);

  useEffect(() => {
    pauseShellRef.current = pausePlayback;
  }, [pausePlayback]);

  const shellAudioBlocksVideo = policy === "strictExclusive" && playing;

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

  useEffect(() => {
    if (!shellAudioBlocksVideo) return;
    pauseRegisteredVideos();
  }, [shellAudioBlocksVideo, pauseRegisteredVideos]);

  const onBackgroundVideoPlaying = useCallback(() => {
    if (policy !== "strictExclusive") return;
    if (!playing) return;
    pauseShellRef.current();
  }, [policy, playing]);

  const value = useMemo<MediaPlaybackCoordinatorValue>(
    () => ({
      policy,
      shellAudioBlocksVideo,
      registerBackgroundVideo,
      onBackgroundVideoPlaying,
    }),
    [policy, shellAudioBlocksVideo, registerBackgroundVideo, onBackgroundVideoPlaying],
  );

  return (
    <MediaPlaybackCoordinatorContext.Provider value={value}>{children}</MediaPlaybackCoordinatorContext.Provider>
  );
}
