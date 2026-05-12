"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject, type RefObject } from "react";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { isIosLikeUserAgent } from "@/lib/dom/ios";

type Layer = { layerId: string; src: string; volume: number };

/** 底部壳层主音乐在播时，环境声乘子（主页自然视频背景声降至约一成，让音乐主导） */
const AMBIENT_GAIN_WHEN_SHELL_MUSIC_PLAYING = 0.1;

function SyncLoopAmbient({
  src,
  volume,
  ambientMuted,
  ambientMutedRef,
  playbackRate,
  videoRef,
  setAudioEl,
  ambientLead,
  underShellMusicGain,
  mediaPreload,
}: {
  src: string;
  volume: number;
  ambientMuted: boolean;
  ambientMutedRef: MutableRefObject<boolean>;
  playbackRate: number;
  videoRef: RefObject<HTMLVideoElement | null>;
  setAudioEl: (el: HTMLAudioElement | null) => void;
  /** 为 true：挂载后即尝试播放，且不随视频 pause 而暂停（首页「先声后画」阶段） */
  ambientLead: boolean;
  /** 与 `volume` 相乘；壳层音乐在播时为 `AMBIENT_GAIN_WHEN_SHELL_MUSIC_PLAYING` */
  underShellMusicGain: number;
  mediaPreload: "auto" | "metadata";
}) {
  const aRef = useRef<HTMLAudioElement | null>(null);

  const bindRef = (el: HTMLAudioElement | null) => {
    aRef.current = el;
    setAudioEl(el);
  };

  /** iOS 等：`volume` 不可靠；顶栏静音用 `muted` + `pause()`，恢复时再 `play()`。 */
  useEffect(() => {
    const a = aRef.current;
    if (!a) return;
    const g = Math.max(0, Math.min(1, underShellMusicGain));
    const targetVol = Math.min(1, volume * g);
    a.muted = ambientMuted;
    a.volume = targetVol;
    if (ambientMuted) {
      a.pause();
      return;
    }
    const v = videoRef.current;
    if (ambientLead || (v && !v.paused)) {
      void a.play().catch(() => {});
    }
  }, [ambientMuted, volume, underShellMusicGain, src, ambientLead, videoRef]);

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
      if (!ambientMutedRef.current) void a.play().catch(() => {});
    }

    const v = videoRef.current;
    if (!v) {
      return () => {
        a.pause();
      };
    }

    const onPlay = () => {
      if (ambientMutedRef.current) return;
      void a.play().catch(() => {});
    };
    const onPause = () => {
      if (!ambientLead) a.pause();
    };
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    if (!ambientLead && !v.paused && !ambientMutedRef.current) void a.play().catch(() => {});
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      a.pause();
    };
  }, [src, playbackRate, videoRef, ambientLead, ambientMutedRef]);

  return (
    <audio ref={bindRef} src={src} className="hidden" playsInline preload={mediaPreload} aria-hidden />
  );
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
  videoRef: RefObject<HTMLVideoElement | null>;
  playbackRate: number;
  /** 用户顶栏静音：iOS 下须 muted/pause，不能仅靠 volume */
  ambientMuted?: boolean;
  /** 静图开场阶段：环境声先起，不随视频 pause 被掐断；揭晓后与视频同步 */
  ambientLead?: boolean;
}) {
  const { registerSleepPauseHandler, playing } = useMusicShellPlayback();
  const underShellMusicGain = playing ? AMBIENT_GAIN_WHEN_SHELL_MUSIC_PLAYING : 1;
  const ambientByLayerRef = useRef(new Map<string, HTMLAudioElement>());
  const ambientMutedRef = useRef(ambientMuted);
  ambientMutedRef.current = ambientMuted;

  /** 与 SSR 首帧一致为 auto，挂载后再在 iOS 降为 metadata，减轻主屏 Web 内存压力、降低整页被系统回收概率 */
  const [mediaPreload, setMediaPreload] = useState<"auto" | "metadata">("auto");
  useEffect(() => {
    if (isIosLikeUserAgent()) setMediaPreload("metadata");
  }, []);

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
          ambientMutedRef={ambientMutedRef}
          playbackRate={playbackRate}
          videoRef={videoRef}
          setAudioEl={(el) => setLayerAudioEl(l.layerId, el)}
          ambientLead={ambientLead}
          underShellMusicGain={underShellMusicGain}
          mediaPreload={mediaPreload}
        />
      ))}
    </div>
  );
}
