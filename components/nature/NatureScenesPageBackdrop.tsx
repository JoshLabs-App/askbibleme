"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "./nature-home-portrait-pan.css";
import { useShellBackgroundVideoCoordination } from "@/hooks/useShellBackgroundVideoCoordination";
import { resolveScenesPagePlayback } from "@/lib/nature/resolve-scenes-page-playback";
import type { NatureSettingsV2 } from "@/lib/nature/types";

const BG_MEDIA =
  "nature-bg-cover-media absolute top-1/2 h-full min-h-full w-full min-w-full object-cover";

type Props = { settings: NatureSettingsV2 };

/**
 * `/scenes` 全屏背景：静音循环影片 + 首帧/封面；压暗渐变保证方卡可读。
 */
export function NatureScenesPageBackdrop({ settings }: Props) {
  const playback = useMemo(() => resolveScenesPagePlayback(settings, { prefer1080: true }), [settings]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoBroken, setVideoBroken] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  const { videoSrc, posterSrc } = playback;
  const showVideo = Boolean(videoSrc.trim()) && !videoBroken;
  const { blockVideoDecoder, onVideoPlaying, shellAudioBlocksVideo } = useShellBackgroundVideoCoordination(
    videoRef,
    {
      enabled: showVideo,
      surfaceId: "scenes-backdrop",
    },
  );
  const showVideoDecoder = showVideo && !blockVideoDecoder;

  useEffect(() => {
    setVideoBroken(false);
    setVideoReady(false);
  }, [videoSrc]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !showVideoDecoder) return;
    v.playbackRate = settings.playbackRate;
    void v.play().catch(() => {});
  }, [showVideoDecoder, settings.playbackRate, videoSrc]);

  if (!showVideo && !posterSrc) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-canvas" aria-hidden>
      {showVideoDecoder ? (
        <video
          ref={videoRef}
          key={videoSrc}
          className={`${BG_MEDIA} z-[1] border-0 opacity-100 outline-none`}
          src={videoSrc}
          muted
          playsInline
          loop
          autoPlay
          preload="metadata"
          onLoadedData={() => setVideoReady(true)}
          onCanPlay={() => setVideoReady(true)}
          onPlaying={() => {
            onVideoPlaying();
            setVideoReady(true);
          }}
          onError={() => setVideoBroken(true)}
        />
      ) : null}
      {posterSrc ? (
        <img
          src={posterSrc}
          alt=""
          className={[
            BG_MEDIA,
            "z-[2] transition-opacity duration-700 ease-out motion-reduce:transition-none",
            showVideoDecoder && videoReady && !shellAudioBlocksVideo ? "opacity-0" : "opacity-100",
          ].join(" ")}
        />
      ) : null}
      <div
        className="pointer-events-none absolute inset-0 z-[3] bg-gradient-to-b from-sky-950/45 via-slate-950/35 to-slate-950/72"
        aria-hidden
      />
    </div>
  );
}
