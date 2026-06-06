"use client";

import { useEffect, useRef } from "react";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import type { NatureAmbientSceneSlotId } from "@/lib/nature/ambient-scene-slots";

/** 壳层主音乐在播时，环境声乘子（对齐 App `HomeNatureScreen`） */
const AMBIENT_GAIN_WHEN_SHELL_MUSIC_PLAYING = 0.2;

type Props = {
  slotId: NatureAmbientSceneSlotId | "";
  src: string;
  playbackRate: number;
};

/** 首页底部环境音槽：单轨循环 MP3（来自 `nature-settings.json` `ambientClips`） */
export function NatureHomeAmbientSlotAudio({ slotId, src, playbackRate }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { playing: shellMusicPlaying } = useMusicShellPlayback();
  const normalizedSrc = src.trim();

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !slotId || !normalizedSrc) {
      if (a) a.pause();
      return;
    }

    const gain = shellMusicPlaying ? AMBIENT_GAIN_WHEN_SHELL_MUSIC_PLAYING : 1;
    a.loop = true;
    a.volume = Math.min(1, Math.max(0, gain));
    try {
      a.playbackRate = Math.min(2, Math.max(0.5, playbackRate));
    } catch {
      /* ignore */
    }
    void a.play().catch(() => {});
  }, [slotId, normalizedSrc, shellMusicPlaying, playbackRate]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  if (!slotId || !normalizedSrc) return null;

  return (
    <audio
      ref={audioRef}
      key={`${slotId}:${normalizedSrc}`}
      src={normalizedSrc}
      className="hidden"
      playsInline
      preload="metadata"
      aria-hidden
    />
  );
}
