"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { useMediaPlaybackPolicy } from "@/hooks/useMediaPlaybackPolicy";
import type { MediaPlaybackPolicyTier } from "@/lib/media/media-playback-policy";

type VideoGetter = () => HTMLVideoElement | null;

export type MediaPlaybackCoordinatorValue = {
  policy: MediaPlaybackPolicyTier;
  /** 电视 + 壳层音乐在播/将播：背景改静图，卸载视频解码器 */
  shellAudioBlocksVideo: boolean;
  registerBackgroundVideo: (id: string, getEl: VideoGetter) => () => void;
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
 * 电视：起播音乐前暂停视频；音乐在播时保持静图（不恢复解码，避免黑屏占满）。
 * 音乐暂停后恢复静音视频。手机：`normal`，无协调。
 */
export function MediaPlaybackCoordinatorProvider({ children }: { children: ReactNode }) {
  const policy = useMediaPlaybackPolicy();
  const { playing, registerBeforeShellPlayHandler } = useMusicShellPlayback();
  const videosRef = useRef(new Map<string, VideoGetter>());
  const [shellAudioReserved, setShellAudioReserved] = useState(false);

  useEffect(() => {
    if (playing) return;
    setShellAudioReserved(false);
  }, [playing]);

  const shellAudioBlocksVideo =
    policy === "tvCoexist" && (playing || shellAudioReserved);

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
    if (policy !== "tvCoexist") return;
    return registerBeforeShellPlayHandler(async () => {
      setShellAudioReserved(true);
      pauseRegisteredVideos();
      await waitTwoAnimationFrames();
    });
  }, [policy, registerBeforeShellPlayHandler, pauseRegisteredVideos]);

  useEffect(() => {
    if (policy !== "tvCoexist") return;
    if (shellAudioBlocksVideo) {
      pauseRegisteredVideos();
      return;
    }
    void waitTwoAnimationFrames().then(() => resumeRegisteredVideosMuted());
  }, [policy, shellAudioBlocksVideo, pauseRegisteredVideos, resumeRegisteredVideosMuted]);

  const onBackgroundVideoPlaying = useCallback(() => {
    /* 音乐在播时不因视频 onPlaying 掐断音乐 */
  }, []);

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
