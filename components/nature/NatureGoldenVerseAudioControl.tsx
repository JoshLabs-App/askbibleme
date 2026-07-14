"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ShellMaterialIcon } from "@/components/shell/ShellMaterialIcon";
import { SHELL_CHROME_HIT_PX, SHELL_MENU_ICON_SIZE_PX } from "@/lib/shell/shell-chrome-icons";
import { buildGoldenVerseAudioSrc } from "@/lib/bible/golden-verse-audio";

const PLAY_BTN =
  "touch-manipulation inline-flex shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-white transition active:scale-[0.97]";

function normalizeAudioSrc(src: string): string {
  try {
    return new URL(src, window.location.href).href;
  } catch {
    return src.trim();
  }
}

type Props = {
  verseKey?: string | null;
};

/**
 * 首页右上：当前金句音频播放按钮。
 * 仅播放当前可见金句，对应 `/audio/golden-verses/*-32kbps.mp3`。
 */
export function NatureGoldenVerseAudioControl({ verseKey }: Props) {
  const { locale } = useLocale();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);

  const src = useMemo(() => (verseKey ? buildGoldenVerseAudioSrc(verseKey) : null), [verseKey]);
  const zh = locale === "zh-CN" || locale === "zh-TW";

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!src) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      setPlaying(false);
      return;
    }

    const currentSrc = (audio.currentSrc || audio.src || "").trim();
    if (normalizeAudioSrc(currentSrc) !== normalizeAudioSrc(src)) {
      audio.pause();
      audio.src = src;
      audio.load();
      if (playing) setPlaying(false);
    }
  }, [src, playing]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    const onError = () => setPlaying(false);

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("error", onError);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio?.pause();
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio || !src) return;

    if (playing && !audio.paused) {
      audio.pause();
      setPlaying(false);
      return;
    }

    if (normalizeAudioSrc(audio.currentSrc || audio.src || "") !== normalizeAudioSrc(src)) {
      audio.src = src;
      audio.load();
    }

    audio.currentTime = 0;
    void audio.play().catch(() => setPlaying(false));
  };

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={!src}
        aria-pressed={playing}
        aria-label={
          src
            ? playing
              ? zh
                ? "暂停金句音频"
                : "Pause verse audio"
              : zh
                ? "播放金句音频"
                : "Play verse audio"
            : zh
              ? "当前没有可播放的金句音频"
              : "No verse audio available"
        }
        className={PLAY_BTN}
        style={{
          width: SHELL_CHROME_HIT_PX,
          height: SHELL_CHROME_HIT_PX,
          opacity: ready && src ? (playing ? 0.82 : 0.56) : 0.26,
        }}
      >
        <ShellMaterialIcon
          name={playing ? "pause" : "play_arrow"}
          size={SHELL_MENU_ICON_SIZE_PX}
          color="#FFFFFF"
          legibilityShadow
        />
      </button>

      <audio
        ref={audioRef}
        src={src ?? undefined}
        className="hidden"
        playsInline
        preload="metadata"
        aria-hidden
      />
    </>
  );
}
