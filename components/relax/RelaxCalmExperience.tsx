"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { useLandscapeNarrow } from "@/hooks/useLandscapeNarrow";
import type { RelaxSettingsV1 } from "@/lib/relax/types";
import { exitFullscreenCompat, requestFullscreenCompat } from "@/lib/dom/fullscreen";
import { isIosLikeUserAgent } from "@/lib/dom/ios";
import { landscapeNarrowMedia as ln } from "@/lib/ui/landscape-tailwind";
import {
  RELAX_EFFECT_TAB_I18N_KEY,
  RELAX_VISUAL_EFFECT_STORAGE_KEY,
} from "@/lib/relax/visual-effects";
import { LagoonBreatheOrb } from "@/components/calm/LagoonBreatheOrb";
import { HomeVerseRotator } from "@/components/home/HomeVerseRotator";
import { IconPause, IconPlay } from "@/components/ui/MediaPlaybackIcons";

/** 画面效果名在经文下轻提示的显示时长（毫秒） */
const RELAX_EFFECT_HINT_MS = 5000;

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Props = {
  initial: RelaxSettingsV1;
};

/**
 * 放松会话：仅「静湖」浅色天青底。底栏在外层对该路由隐藏。底部控件：进度 → 播放。
 */
export function RelaxCalmExperience({ initial }: Props) {
  const { t } = useLocale();
  const landscapeNarrow = useLandscapeNarrow();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoBroken, setVideoBroken] = useState(false);
  const [relaxEffectHintVisible, setRelaxEffectHintVisible] = useState(true);
  const relaxEffectHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { canPlay, playing, togglePlay, currentSec, durationSec, seekRatio } = useMusicShellPlayback();

  useEffect(() => {
    try {
      localStorage.setItem(RELAX_VISUAL_EFFECT_STORAGE_KEY, "lagoon");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setRelaxEffectHintVisible(true);
    if (relaxEffectHintTimerRef.current) clearTimeout(relaxEffectHintTimerRef.current);
    relaxEffectHintTimerRef.current = setTimeout(() => {
      relaxEffectHintTimerRef.current = null;
      setRelaxEffectHintVisible(false);
    }, RELAX_EFFECT_HINT_MS);
    return () => {
      if (relaxEffectHintTimerRef.current) clearTimeout(relaxEffectHintTimerRef.current);
    };
  }, []);

  const videoSrc = initial.videoSrc.trim();
  const poster = initial.posterSrc?.trim();
  const rate = initial.playbackRate;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoSrc || videoBroken) return;
    try {
      el.playbackRate = rate;
    } catch {
      /* ignore */
    }
  }, [rate, videoSrc, videoBroken]);

  useEffect(() => {
    setVideoBroken(false);
  }, [videoSrc]);

  const hasVideo = Boolean(videoSrc && !videoBroken);

  useEffect(() => {
    if (!landscapeNarrow) {
      document.documentElement.removeAttribute("data-landscape-immersive");
      return;
    }
    document.documentElement.setAttribute("data-landscape-immersive", "");
    return () => document.documentElement.removeAttribute("data-landscape-immersive");
  }, [landscapeNarrow]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    /** iOS：对 documentElement 自动全屏易触发系统回收 / 黑屏闪回（与自然页一致）。 */
    if (isIosLikeUserAgent()) {
      if (document.fullscreenElement === document.documentElement) {
        void exitFullscreenCompat();
      }
      return;
    }
    if (!landscapeNarrow) {
      if (document.fullscreenElement === document.documentElement) {
        void exitFullscreenCompat();
      }
      return;
    }
    void requestFullscreenCompat(document.documentElement).catch(() => {});
  }, [landscapeNarrow]);

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-1 flex-col supports-[height:100dvh]:min-h-[100dvh] bg-canvas text-ink">
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-sky-100 via-sky-50 to-cyan-100/90"
        aria-hidden
      />

      {videoSrc && !videoBroken ? (
        <video
          ref={videoRef}
          key={videoSrc}
          className="absolute inset-0 z-[1] h-full w-full border-0 object-cover outline-none"
          src={videoSrc}
          poster={poster || undefined}
          muted
          playsInline
          loop
          autoPlay
          preload="metadata"
          aria-hidden
          onError={() => setVideoBroken(true)}
        />
      ) : null}

      <div
        className={`pointer-events-none absolute inset-0 z-[5] ${
          hasVideo
            ? "bg-gradient-to-b from-white/55 via-sky-50/25 to-sky-200/45"
            : "bg-gradient-to-b from-sky-200/25 via-transparent to-cyan-100/35"
        }`}
        aria-hidden
      />

      <div
        className={`relative z-20 flex min-h-[100dvh] w-full flex-1 flex-col supports-[height:100dvh]:min-h-[100dvh] ${ln}:absolute ${ln}:inset-y-0 ${ln}:right-0 ${ln}:left-auto ${ln}:min-h-0 ${ln}:w-[min(44vw,20rem)] ${ln}:max-w-[48%] ${ln}:justify-between ${ln}:bg-gradient-to-l ${ln}:pl-5 ${ln}:backdrop-blur-md ${ln}:pt-[max(0.35rem,env(safe-area-inset-top))] ${ln}:pb-[max(0.35rem,env(safe-area-inset-bottom))] ${ln}:pr-[max(0.35rem,env(safe-area-inset-right))] ${ln}:from-sky-100/95 ${ln}:via-cyan-50/85 ${ln}:to-transparent`}
      >
        <header
          className={`relative z-20 mx-auto flex w-full max-w-xl shrink-0 items-center justify-between gap-4 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 sm:pt-[max(1rem,env(safe-area-inset-top))] ${ln}:mx-0 ${ln}:max-w-none ${ln}:px-0 ${ln}:pt-0 ${ln}:sm:px-0 ${ln}:sm:pt-0`}
        >
          <Link
            href="/music"
            aria-label={t("relax.back")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink/80 transition hover:bg-white/60 hover:text-ink"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-[1.35rem] w-[1.35rem]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M14 7l-5 5 5 5" />
            </svg>
          </Link>
          <span className="shrink-0 text-[10px] font-medium tracking-[0.28em] text-ink/45 sm:text-[11px] sm:tracking-[0.32em]">
            {t("relax.sessionLabel")}
          </span>
        </header>

        <main
          className={`relative z-10 mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col justify-center px-4 py-10 sm:px-5 sm:py-11 ${ln}:mx-0 ${ln}:max-w-none ${ln}:px-0 ${ln}:py-4 ${ln}:sm:px-0 ${ln}:sm:py-5`}
        >
          <div
            className={`flex flex-col items-center gap-y-11 sm:gap-y-14 ${ln}:gap-y-6 ${ln}:justify-center`}
          >
            <div
              className={`flex shrink-0 items-center justify-center ${ln}:scale-[0.88] motion-reduce:scale-100`}
            >
              <LagoonBreatheOrb />
            </div>
            <HomeVerseRotator
              variant="light"
              className={`min-h-[7rem] max-w-[19rem] sm:max-w-[21.5rem] ${ln}:min-h-[5.25rem] ${ln}:max-w-[min(100%,18rem)]`}
            />
            <p
              className={[
                "w-full max-w-[17rem] overflow-hidden text-center text-[9px] font-normal leading-snug tracking-[0.18em] transition-all duration-500 ease-out motion-reduce:duration-150 sm:max-w-[19rem] sm:text-[10px] sm:tracking-[0.2em]",
                "text-ink/25",
                relaxEffectHintVisible ? "mt-2 max-h-10 opacity-100 sm:mt-2.5" : "mt-0 max-h-0 opacity-0",
              ].join(" ")}
              aria-hidden
            >
              {t(RELAX_EFFECT_TAB_I18N_KEY.lagoon)}
            </p>
          </div>
        </main>

        <footer
          className={`relative z-20 mx-auto mt-auto flex w-full max-w-md shrink-0 flex-col gap-2.5 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pt-4 ${ln}:mx-0 ${ln}:max-w-none ${ln}:w-full ${ln}:gap-2 ${ln}:px-0 ${ln}:pb-[max(0.5rem,env(safe-area-inset-bottom))] ${ln}:pt-2 ${ln}:sm:px-0 ${ln}:sm:pb-[max(0.5rem,env(safe-area-inset-bottom))] ${ln}:sm:pt-2`}
        >
          {canPlay ? (
            <div className="flex items-center gap-3.5 text-[12px] tabular-nums text-ink/50 sm:text-[13px]">
              <span className="min-w-[2.75rem] shrink-0">{formatTime(currentSec)}</span>
              <button
                type="button"
                aria-label={t("music.home.progress")}
                className="group relative h-1 flex-1 overflow-hidden rounded-full bg-ink/10 sm:h-[5px]"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  seekRatio((e.clientX - r.left) / r.width);
                }}
              >
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-sand/90 transition-[width] duration-150 ease-out group-hover:bg-sand"
                  style={{
                    width: `${durationSec ? Math.min(100, (currentSec / durationSec) * 100) : 0}%`,
                  }}
                />
              </button>
              <span className="min-w-[2.75rem] shrink-0 text-right">{formatTime(durationSec)}</span>
            </div>
          ) : (
            <p className="text-center text-[12px] leading-relaxed text-muted sm:text-[13px]">
              {t("relax.noMusicHint")}
            </p>
          )}

          <div className={`flex justify-center pb-0.5 pt-0.5 ${ln}:pt-0`}>
            <button
              type="button"
              disabled={!canPlay}
              aria-label={
                !canPlay ? t("playback.noTrack") : playing ? t("playback.pauseMusic") : t("playback.playMusic")
              }
              onClick={() => togglePlay()}
              className={`music-reactive-play-btn flex h-[3.75rem] w-[3.75rem] items-center justify-center rounded-full border border-sky-300/80 bg-sky-600 text-white shadow-[0_10px_40px_-12px_rgba(15,60,90,0.35)] transition hover:bg-sky-700 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-35 sm:h-16 sm:w-16 ${ln}:h-14 ${ln}:w-14 ${ln}:sm:h-14 ${ln}:sm:w-14`}
            >
              {playing ? (
                <IconPause className="h-6 w-6 shrink-0 opacity-95 sm:h-[26px] sm:w-[26px]" />
              ) : (
                <IconPlay className="h-6 w-6 shrink-0 translate-x-[2px] opacity-95 sm:h-[26px] sm:w-[26px]" />
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
