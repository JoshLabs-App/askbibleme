"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { useLandscapeNarrow } from "@/hooks/useLandscapeNarrow";
import { useShellBackgroundVideoCoordination } from "@/hooks/useShellBackgroundVideoCoordination";
import type { RelaxSettingsV1 } from "@/lib/relax/types";
import { exitFullscreenCompat, requestFullscreenCompat } from "@/lib/dom/fullscreen";
import { isIosLikeUserAgent } from "@/lib/dom/ios";
import { landscapeNarrowMedia as ln } from "@/lib/ui/landscape-tailwind";
import {
  RELAX_EFFECT_TAB_I18N_KEY,
  RELAX_VISUAL_EFFECT_STORAGE_KEY,
} from "@/lib/relax/visual-effects";
import { LagoonBreatheOrb } from "@/components/calm/LagoonBreatheOrb";
import { HomeVerseRotatorWithPrayerPool } from "@/components/home/HomeVerseRotatorWithPrayerPool";

/** 画面效果名在经文下轻提示的显示时长（毫秒） */
const RELAX_EFFECT_HINT_MS = 5000;
/** 进入放松页顶部引导小字：略短于效果名，避免抢主区 */
const RELAX_GUIDE_HINT_MS = 3200;

type Props = {
  initial: RelaxSettingsV1;
  /** 外层已包 `ShellTemplateChromeLayout` 时：用 flex 填满主区，不再占满整屏视口。 */
  layout?: "standalone" | "templateChrome";
};

/**
 * 放松会话：静湖浅色天青底 + 视频/渐变铺满；不在本页提供播放/进度控件（由音乐页或底栏等控制）。
 * `templateChrome`：无返回、无会话标题，主区全幅铺满（供 `/relax` 与壳模板同源）。
 */
export function RelaxCalmExperience({ initial, layout = "standalone" }: Props) {
  const { t } = useLocale();
  const landscapeNarrow = useLandscapeNarrow();
  const inTemplateChrome = layout === "templateChrome";
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoBroken, setVideoBroken] = useState(false);
  const [relaxEffectHintVisible, setRelaxEffectHintVisible] = useState(true);
  const relaxEffectHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [relaxGuideVisible, setRelaxGuideVisible] = useState(true);
  const relaxGuideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { canPlay } = useMusicShellPlayback();

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

  useEffect(() => {
    setRelaxGuideVisible(true);
    if (relaxGuideTimerRef.current) clearTimeout(relaxGuideTimerRef.current);
    relaxGuideTimerRef.current = setTimeout(() => {
      relaxGuideTimerRef.current = null;
      setRelaxGuideVisible(false);
    }, RELAX_GUIDE_HINT_MS);
    return () => {
      if (relaxGuideTimerRef.current) clearTimeout(relaxGuideTimerRef.current);
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
  const { blockVideoDecoder, onVideoPlaying } = useShellBackgroundVideoCoordination(videoRef, {
    enabled: hasVideo,
    surfaceId: "relax-calm",
  });
  const showVideoDecoder = hasVideo && !blockVideoDecoder;

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
    <div
      className={
        inTemplateChrome
          ? "absolute inset-0 z-0 flex flex-col overflow-hidden text-ink"
          : "relative flex min-h-[100dvh] w-full flex-1 flex-col supports-[height:100dvh]:min-h-[100dvh] bg-canvas text-ink"
      }
    >
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-sky-100 via-sky-50 to-cyan-100/90"
        aria-hidden
      />

      {showVideoDecoder ? (
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
          onPlaying={() => onVideoPlaying()}
          onError={() => setVideoBroken(true)}
        />
      ) : null}

      <div
        className={`pointer-events-none absolute inset-0 z-[5] ${
          showVideoDecoder
            ? "bg-gradient-to-b from-white/55 via-sky-50/25 to-sky-200/45"
            : "bg-gradient-to-b from-sky-200/25 via-transparent to-cyan-100/35"
        }`}
        aria-hidden
      />

      <div
        className={
          inTemplateChrome
            ? "relative z-20 flex min-h-0 w-full flex-1 flex-col overflow-hidden"
            : `relative z-20 flex w-full flex-1 flex-col min-h-[100dvh] supports-[height:100dvh]:min-h-[100dvh] ${ln}:absolute ${ln}:inset-y-0 ${ln}:right-0 ${ln}:left-auto ${ln}:min-h-0 ${ln}:w-[min(44vw,20rem)] ${ln}:max-w-[48%] ${ln}:justify-between ${ln}:bg-gradient-to-l ${ln}:pl-5 ${ln}:backdrop-blur-md ${ln}:pt-[max(0.35rem,env(safe-area-inset-top))] ${ln}:pb-[max(0.35rem,env(safe-area-inset-bottom))] ${ln}:pr-[max(0.35rem,env(safe-area-inset-right))] ${ln}:from-sky-100/95 ${ln}:via-cyan-50/85 ${ln}:to-transparent`
        }
      >
        {!inTemplateChrome ? (
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
        ) : null}

        <div
          role="main"
          className={
            inTemplateChrome
              ? "relative z-10 flex min-h-0 w-full flex-1 flex-col justify-center px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:px-5 landscape:min-h-0 landscape:justify-start landscape:pt-[max(0.35rem,env(safe-area-inset-top))]"
              : `relative z-10 mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col justify-center px-4 py-10 sm:px-5 sm:py-11 ${ln}:mx-0 ${ln}:max-w-none ${ln}:px-0 ${ln}:py-4 ${ln}:sm:px-0 ${ln}:sm:py-5 landscape:min-h-0 landscape:justify-start landscape:py-4 landscape:sm:py-5`
          }
        >
          <div
            className={`flex min-h-0 w-full flex-col items-center gap-y-11 sm:gap-y-14 ${ln}:gap-y-6 ${ln}:justify-center landscape:flex-1 landscape:gap-y-3 landscape:pb-[max(3.25rem,calc(env(safe-area-inset-bottom,0px)+2.5rem))] landscape:sm:gap-y-3`}
          >
            <div
              className={`relative flex shrink-0 flex-col items-center justify-center ${ln}:scale-[0.88] motion-reduce:scale-100 landscape:min-h-0 landscape:w-full landscape:grow landscape:shrink landscape:basis-0 landscape:justify-center`}
            >
              <p
                role="status"
                aria-live="polite"
                className={[
                  "pointer-events-none absolute bottom-full left-1/2 z-[1] mb-2 w-[min(100%,19rem)] -translate-x-1/2 px-2 text-center text-[10px] font-normal leading-snug text-ink/42 transition-opacity duration-700 ease-out motion-reduce:transition-none sm:mb-2.5 sm:max-w-[21rem] sm:text-[11px] sm:leading-relaxed sm:text-ink/38",
                  relaxGuideVisible ? "opacity-100" : "opacity-0",
                ].join(" ")}
              >
                {t("relax.guideHint")}
              </p>
              <LagoonBreatheOrb />
            </div>
            <HomeVerseRotatorWithPrayerPool
              variant="light"
              className="min-h-[7rem] max-w-[19rem] sm:max-w-[21.5rem] landscape:hidden"
            />
            <p
              className={[
                "w-full max-w-[17rem] shrink-0 overflow-hidden text-center text-[9px] font-normal leading-snug tracking-[0.18em] transition-all duration-500 ease-out motion-reduce:duration-150 sm:max-w-[19rem] sm:text-[10px] sm:tracking-[0.2em]",
                "text-ink/25",
                relaxEffectHintVisible ? "mt-2 max-h-10 opacity-100 sm:mt-2.5 landscape:mt-0" : "mt-0 max-h-0 opacity-0",
              ].join(" ")}
              aria-hidden
            >
              {t(RELAX_EFFECT_TAB_I18N_KEY.lagoon)}
            </p>
            {!canPlay ? (
              <p className="mt-6 max-w-[19rem] shrink-0 text-center text-[12px] leading-relaxed text-muted sm:text-[13px] landscape:mt-3">
                {t("relax.noMusicHint")}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
