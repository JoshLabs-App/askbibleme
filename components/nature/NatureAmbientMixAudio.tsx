"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";

type Layer = { layerId: string; src: string; volume: number };

/** 底部壳层主音乐在播时，环境声乘子（避免与自然混音抢听感） */
const AMBIENT_GAIN_WHEN_SHELL_MUSIC_PLAYING = 0.22;

function SyncLoopAmbient({
  src,
  volume,
  ambientMuted,
  playbackRate,
  videoRef,
  setAudioEl,
  ambientLead,
  underShellMusicGain,
}: {
  src: string;
  volume: number;
  ambientMuted: boolean;
  playbackRate: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  setAudioEl: (el: HTMLAudioElement | null) => void;
  /** 为 true：挂载后即尝试播放，且不随视频 pause 而暂停（首页「先声后画」阶段） */
  ambientLead: boolean;
  /** 与 `volume` 相乘；壳层音乐在播时为 `AMBIENT_GAIN_WHEN_SHELL_MUSIC_PLAYING` */
  underShellMusicGain: number;
}) {
  const aRef = useRef<HTMLAudioElement | null>(null);

  const bindRef = (el: HTMLAudioElement | null) => {
    aRef.current = el;
    setAudioEl(el);
  };

  useEffect(() => {
    const a = aRef.current;
    if (!a) return;
    const g = Math.max(0, Math.min(1, underShellMusicGain));
    a.volume = ambientMuted ? 0 : Math.min(1, volume * g);
  }, [ambientMuted, volume, underShellMusicGain, src]);

  useEffect(() => {
    const a = aRef.current;
    if (!a) return;
    a.loop = true;
    try {
      a.playbackRate = playbackRate;
    } catch {
      /* ignore */
    }

    if (ambientLead) {
      void a.play().catch(() => {});
    }

    const v = videoRef.current;
    if (!v) {
      return () => {
        a.pause();
      };
    }

    const onPlay = () => {
      void a.play().catch(() => {});
    };
    const onPause = () => {
      if (!ambientLead) a.pause();
    };
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    if (!ambientLead && !v.paused) void a.play().catch(() => {});
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      a.pause();
    };
  }, [src, playbackRate, videoRef, ambientLead]);

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
  ambientLead = false,
}: {
  layers: Layer[];
  videoRef: React.RefObject<HTMLVideoElement | null>;
  playbackRate: number;
  /** 用户顶栏静音：音量为 0，仍与视频同步播放/暂停以便恢复 */
  ambientMuted?: boolean;
  /** 静图开场阶段：环境声先起，不随视频 pause 被掐断；揭晓后与视频同步 */
  ambientLead?: boolean;
}) {
  const { registerSleepPauseHandler, playing } = useMusicShellPlayback();
  const underShellMusicGain = playing ? AMBIENT_GAIN_WHEN_SHELL_MUSIC_PLAYING : 1;
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
          ambientLead={ambientLead}
          underShellMusicGain={underShellMusicGain}
        />
      ))}
    </div>
  );
}
