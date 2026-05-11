"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";

type Layer = { layerId: string; src: string; volume: number };

function SyncLoopAmbient({
  src,
  volume,
  ambientMuted,
  playbackRate,
  videoRef,
  setAudioEl,
}: {
  src: string;
  volume: number;
  ambientMuted: boolean;
  playbackRate: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  setAudioEl: (el: HTMLAudioElement | null) => void;
}) {
  const aRef = useRef<HTMLAudioElement | null>(null);

  const bindRef = (el: HTMLAudioElement | null) => {
    aRef.current = el;
    setAudioEl(el);
  };

  useEffect(() => {
    const a = aRef.current;
    const v = videoRef.current;
    if (!a || !v) return;
    a.volume = ambientMuted ? 0 : volume;
    a.loop = true;
    try {
      a.playbackRate = playbackRate;
    } catch {
      /* ignore */
    }
    const onPlay = () => {
      void a.play().catch(() => {});
    };
    const onPause = () => {
      a.pause();
    };
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    if (!v.paused) void a.play().catch(() => {});
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      a.pause();
    };
  }, [ambientMuted, src, volume, playbackRate, videoRef]);

  return <audio ref={bindRef} src={src} className="hidden" playsInline preload="auto" aria-hidden />;
}

/**
 * 与背景静音视频同步播放的多轨循环环境声（配置来自后台混音）。
 */
export function NatureAmbientMixAudio({
  layers,
  videoRef,
  playbackRate,
  ambientMuted = false,
}: {
  layers: Layer[];
  videoRef: React.RefObject<HTMLVideoElement | null>;
  playbackRate: number;
  /** 用户顶栏静音：音量为 0，仍与视频同步播放/暂停以便恢复 */
  ambientMuted?: boolean;
}) {
  const { registerSleepPauseHandler } = useMusicShellPlayback();
  const ambientByLayerRef = useRef(new Map<string, HTMLAudioElement>());

  const setLayerAudioEl = useCallback((layerId: string, el: HTMLAudioElement | null) => {
    if (el) ambientByLayerRef.current.set(layerId, el);
    else ambientByLayerRef.current.delete(layerId);
  }, []);

  useEffect(() => {
    return registerSleepPauseHandler(() => {
      for (const [, a] of ambientByLayerRef.current) {
        try {
          a.pause();
        } catch {
          /* ignore */
        }
      }
    });
  }, [registerSleepPauseHandler]);

  if (!layers.length) return null;
  return (
    <div className="pointer-events-none absolute h-0 w-0 overflow-hidden" aria-hidden>
      {layers.map((l) => (
        <SyncLoopAmbient
          key={l.layerId}
          src={l.src}
          volume={l.volume}
          ambientMuted={ambientMuted}
          playbackRate={playbackRate}
          videoRef={videoRef}
          setAudioEl={(el) => setLayerAudioEl(l.layerId, el)}
        />
      ))}
    </div>
  );
}
