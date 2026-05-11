"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLandscapeNarrow } from "@/hooks/useLandscapeNarrow";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { AppShellTopBar } from "@/components/app-shell/AppShellTopBar";
import { DockChromeCollapse, useHomeDockChrome } from "@/components/home/HomeDockChromeContext";
import { ImmersiveAmbientClock } from "@/components/home/ImmersiveAmbientClock";
import { HomeMusicRelaxShortcuts } from "@/components/home/HomeMusicRelaxShortcuts";
import { HomeVerseRotator } from "@/components/home/HomeVerseRotator";
import { NatureAmbientMixAudio } from "@/components/nature/NatureAmbientMixAudio";
import { NaturePreviewVideoWarmup } from "@/components/nature/NaturePreviewVideoWarmup";
import { NatureSceneLayer } from "@/components/nature/NatureSceneLayer";
import { NatureScenePreviewPanel } from "@/components/nature/NatureScenePreviewPanel";
import type { NatureSettingsV2 } from "@/lib/nature/types";
import { resolveNaturePlayback } from "@/lib/nature/resolve-nature-playback";
import { NATURE_HOME_ROOT_THEME } from "@/lib/nature/root-theme";
import { exitFullscreenCompat, requestFullscreenCompat } from "@/lib/dom/fullscreen";

const NATURE_TOP_ICON_BTN =
  "flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full transition active:scale-[0.97] text-white/[0.9] hover:bg-white/[0.1]";

function IconBell(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M12 3a5 5 0 0 0-5 5v2.09l-.78 1.56A1 1 0 0 0 7 13h10a1 1 0 0 0 .89-1.45L17 10.09V8a5 5 0 0 0-5-5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10 20a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconBellMuted(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M4 4 20 20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8.5 8.5V8a3.5 3.5 0 0 1 6.24-2.17M13 13v.09l.78 1.56A1 1 0 0 1 12.9 16H7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 20a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Props = {
  initial: NatureSettingsV2;
};

/** 与背景 `<video>` 同定位，静图叠层与之对齐以免切换时「跳一下」 */
const NATURE_BG_COVER_MEDIA =
  "absolute left-0 top-1/2 h-full min-h-full w-full min-w-full -translate-y-1/2 object-cover object-left sm:left-1/2 sm:-translate-x-1/2 sm:object-center";

/** 有首图时若迟迟不可播，超时仍淡出静图，避免永久卡在静图 */
const INTRO_REVEAL_FALLBACK_MS = 12_000;

/**
 * 揭晓前要求「当前时间点之后」已缓冲够长（秒），利用单 video 渐进下载，减少揭晓后立刻卡顿。
 * 后面边下边播由浏览器接管，用户无感。
 */
const MIN_BUFFER_AHEAD_SEC = 2.4;

function bufferedSecondsAhead(v: HTMLVideoElement): number {
  const t = v.currentTime;
  try {
    const ranges = v.buffered;
    for (let i = 0; i < ranges.length; i++) {
      const start = ranges.start(i);
      const end = ranges.end(i);
      if (t >= start && t < end) {
        return end - t;
      }
    }
  } catch {
    return 0;
  }
  return 0;
}

function hasEnoughBufferedAhead(v: HTMLVideoElement, minBufferAheadSec: number): boolean {
  if (v.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return false;
  const ahead = bufferedSecondsAhead(v);
  const dur = v.duration;
  if (!Number.isFinite(dur) || dur <= 0) {
    return ahead >= Math.min(0.9, 0.25 + minBufferAheadSec * 0.2);
  }
  const remaining = Math.max(0, dur - v.currentTime);
  const need = Math.min(minBufferAheadSec, Math.max(0.12, remaining - 0.05));
  return ahead >= need;
}

/** 静图阶段稍候再出现，避免一打开就提示 */
const SLOW_INTRO_HINT_DELAY_MS = 3800;
/** 播放中 rebuffer 稍候再提示，避免闪一下 */
const PLAYBACK_WAIT_HINT_DELAY_MS = 2800;

/**
 * 自然：全屏静音循环影像 + 轮播经文（视口 ≈38.2dvh 黄金线）+ 第二层场景卡；顶栏 `AppShellTopBar`。
 */
export function NatureVideoExperience({ initial }: Props) {
  const { t } = useLocale();
  const { dockChromeVisible, toggleDockChrome, setDockChromeVisible } = useHomeDockChrome();
  const videoRef = useRef<HTMLVideoElement>(null);
  const introRevealGuardRef = useRef(false);
  const playbackWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [ambientMuted, setAmbientMuted] = useState(false);
  const [videoBroken, setVideoBroken] = useState(false);
  const [previewVideoId, setPreviewVideoId] = useState<string | null>(null);
  const [previewSlideOpen, setPreviewSlideOpen] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState(
    () => initial.activeVideoId.trim() || initial.videos[0]?.id || "",
  );
  const landscapeNarrow = useLandscapeNarrow();

  useEffect(() => {
    const next = initial.activeVideoId.trim() || initial.videos[0]?.id || "";
    setActiveVideoId(next);
  }, [initial]);

  const playbackSettings = useMemo(
    () => ({
      ...initial,
      activeVideoId: activeVideoId.trim() || initial.activeVideoId.trim() || initial.videos[0]?.id || "",
    }),
    [initial, activeVideoId],
  );

  const selectVideoAndImmersive = useCallback(
    (id: string) => {
      setActiveVideoId(id);
      setDockChromeVisible(false);
      setPreviewSlideOpen(false);
      setPreviewVideoId(null);
    },
    [setDockChromeVisible],
  );

  const confirmPreviewFullScreen = useCallback(() => {
    if (!previewVideoId) return;
    selectVideoAndImmersive(previewVideoId);
  }, [previewVideoId, selectVideoAndImmersive]);

  /** 点卡片打开/切换预览；再点同一张则向下滑出收起 */
  const onSceneCardPress = useCallback((id: string) => {
    setPreviewVideoId((prev) => {
      if (prev === id) {
        queueMicrotask(() => {
          const reduce =
            typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          if (reduce) {
            setPreviewSlideOpen(false);
            setPreviewVideoId(null);
          } else {
            setPreviewSlideOpen(false);
          }
        });
        return prev;
      }
      return id;
    });
  }, []);

  const handlePreviewSlideTransitionEnd = useCallback((e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.propertyName !== "transform") return;
    if (!previewSlideOpen) {
      setPreviewVideoId(null);
    }
  }, [previewSlideOpen]);

  const { videoSrc, posterSrc, ambientLayers } = useMemo(
    () => resolveNaturePlayback(playbackSettings),
    [playbackSettings],
  );
  const hasAmbientAudio = ambientLayers.length > 0;
  const poster = posterSrc?.trim();
  const posterUrl = poster ?? "";
  const hasStillIntro = posterUrl.length > 0;
  const rate = initial.playbackRate;

  const [introRevealed, setIntroRevealed] = useState(!hasStillIntro);
  const lastBufferRevealPollRef = useRef(0);
  const [showSlowIntroHint, setShowSlowIntroHint] = useState(false);
  const [showPlaybackWaitHint, setShowPlaybackWaitHint] = useState(false);

  const bufferAheadThreshold = useMemo(() => {
    if (typeof navigator === "undefined") return MIN_BUFFER_AHEAD_SEC;
    const conn = (navigator as Navigator & {
      connection?: { effectiveType?: string; saveData?: boolean };
    }).connection;
    if (conn?.saveData) return MIN_BUFFER_AHEAD_SEC + 0.8;
    const et = conn?.effectiveType;
    if (et === "slow-2g") return MIN_BUFFER_AHEAD_SEC + 1.2;
    if (et === "2g") return MIN_BUFFER_AHEAD_SEC + 1.8;
    return MIN_BUFFER_AHEAD_SEC;
  }, []);

  const clearPlaybackWaitHint = useCallback(() => {
    if (playbackWaitTimerRef.current) {
      clearTimeout(playbackWaitTimerRef.current);
      playbackWaitTimerRef.current = null;
    }
    setShowPlaybackWaitHint(false);
  }, []);

  const schedulePlaybackWaitHint = useCallback(() => {
    if (playbackWaitTimerRef.current) clearTimeout(playbackWaitTimerRef.current);
    playbackWaitTimerRef.current = setTimeout(() => {
      playbackWaitTimerRef.current = null;
      setShowPlaybackWaitHint(true);
    }, PLAYBACK_WAIT_HINT_DELAY_MS);
  }, []);

  const commitIntroReveal = useCallback(() => {
    if (!posterUrl) return;
    if (introRevealGuardRef.current) return;
    introRevealGuardRef.current = true;
    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setIntroRevealed(true);
    } else {
      requestAnimationFrame(() => setIntroRevealed(true));
    }
  }, [posterUrl]);

  const maybeRevealIntroFromBuffer = useCallback(() => {
    if (!posterUrl) return;
    if (introRevealGuardRef.current) return;
    const v = videoRef.current;
    if (!v || !hasEnoughBufferedAhead(v, bufferAheadThreshold)) return;
    commitIntroReveal();
  }, [posterUrl, commitIntroReveal, bufferAheadThreshold]);

  const onTimeUpdatePollIntroReveal = useCallback(() => {
    const now = performance.now();
    if (now - lastBufferRevealPollRef.current < 220) return;
    lastBufferRevealPollRef.current = now;
    maybeRevealIntroFromBuffer();
  }, [maybeRevealIntroFromBuffer]);

  const previewWarmupSrc = useMemo(() => {
    const id = previewVideoId?.trim();
    if (!id) return "";
    return resolveNaturePlayback({ ...initial, activeVideoId: id }).videoSrc.trim();
  }, [initial, previewVideoId]);

  /** 仅当「预览中的片」与主画面 URL 不同时离屏暖机，避免与主 `<video>` 重复拉同一条 */
  const offscreenWarmupSrc = useMemo(() => {
    const p = previewWarmupSrc.trim();
    if (!p) return "";
    const m = videoSrc.trim();
    if (p === m) return "";
    return p;
  }, [previewWarmupSrc, videoSrc]);

  const landscapeImmersive = landscapeNarrow && !!videoSrc.trim() && !videoBroken;

  useEffect(() => {
    if (!landscapeImmersive) {
      document.documentElement.removeAttribute("data-nature-landscape-immersive");
      return;
    }
    document.documentElement.setAttribute("data-nature-landscape-immersive", "");
    return () => document.documentElement.removeAttribute("data-nature-landscape-immersive");
  }, [landscapeImmersive]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!landscapeNarrow || !videoSrc.trim() || videoBroken) {
      if (document.fullscreenElement === document.documentElement) {
        void exitFullscreenCompat();
      }
      return;
    }
    void requestFullscreenCompat(document.documentElement).catch(() => {});
  }, [landscapeNarrow, videoSrc, videoBroken]);

  useEffect(() => {
    introRevealGuardRef.current = false;
    lastBufferRevealPollRef.current = 0;
    setShowSlowIntroHint(false);
    clearPlaybackWaitHint();
    const p = posterSrc?.trim() ?? "";
    setIntroRevealed(p.length === 0);
  }, [videoSrc, posterSrc, clearPlaybackWaitHint]);

  useEffect(() => {
    if (!posterUrl || introRevealed) return;
    const id = window.setTimeout(() => {
      if (introRevealGuardRef.current) return;
      introRevealGuardRef.current = true;
      setIntroRevealed(true);
    }, INTRO_REVEAL_FALLBACK_MS);
    return () => clearTimeout(id);
  }, [posterUrl, introRevealed, videoSrc]);

  useEffect(() => {
    if (!hasStillIntro || introRevealed || !posterUrl) {
      setShowSlowIntroHint(false);
      return;
    }
    const id = window.setTimeout(() => setShowSlowIntroHint(true), SLOW_INTRO_HINT_DELAY_MS);
    return () => {
      clearTimeout(id);
      setShowSlowIntroHint(false);
    };
  }, [hasStillIntro, introRevealed, posterUrl, videoSrc]);

  useEffect(() => {
    return () => clearPlaybackWaitHint();
  }, [clearPlaybackWaitHint]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoSrc || videoBroken) return;
    el.muted = true;
    try {
      el.playbackRate = rate;
    } catch {
      /* ignore */
    }
  }, [rate, videoSrc, videoBroken]);

  /** 首访或未开预览时主画面已在播，仅 metadata 缓冲偏少；空闲后再升 preload=auto（省流模式跳过）。有静图开场时已用 preload=auto，跳过重复升级 */
  useEffect(() => {
    if (hasStillIntro) return;
    const el = videoRef.current;
    if (!el || !videoSrc || videoBroken) return;
    if (typeof navigator !== "undefined") {
      const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
      if (c?.saveData) return;
    }

    let cancelled = false;
    let idleHandle: number | null = null;
    let kickTimeout: ReturnType<typeof setTimeout> | null = null;

    const kick = () => {
      if (cancelled) return;
      const v = videoRef.current;
      if (!v || !videoSrc) return;
      v.preload = "auto";
      try {
        v.load();
      } catch {
        /* ignore */
      }
    };

    if (typeof requestIdleCallback !== "undefined") {
      idleHandle = requestIdleCallback(
        () => {
          idleHandle = null;
          kick();
        },
        { timeout: 900 },
      );
    } else {
      kickTimeout = setTimeout(() => {
        kickTimeout = null;
        kick();
      }, 32);
    }

    return () => {
      cancelled = true;
      if (idleHandle != null && typeof cancelIdleCallback !== "undefined") {
        cancelIdleCallback(idleHandle);
      }
      if (kickTimeout != null) clearTimeout(kickTimeout);
    };
  }, [videoSrc, videoBroken, hasStillIntro]);

  useEffect(() => {
    setVideoBroken(false);
  }, [videoSrc]);

  useEffect(() => {
    const metas = [...document.querySelectorAll('meta[name="theme-color"]')] as HTMLMetaElement[];
    const snapshot = metas.map((el) => ({
      el,
      content: el.getAttribute("content"),
      media: el.getAttribute("media"),
    }));
    for (const m of metas) {
      m.setAttribute("content", NATURE_HOME_ROOT_THEME);
    }
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlBg = html.style.backgroundColor;
    const prevBodyBg = body.style.backgroundColor;
    const prevColorScheme = html.style.colorScheme;
    html.style.backgroundColor = NATURE_HOME_ROOT_THEME;
    body.style.backgroundColor = NATURE_HOME_ROOT_THEME;
    html.style.colorScheme = "dark";
    return () => {
      for (const { el, content, media } of snapshot) {
        if (content != null) el.setAttribute("content", content);
        else el.removeAttribute("content");
        if (media != null) el.setAttribute("media", media);
        else el.removeAttribute("media");
      }
      html.style.backgroundColor = prevHtmlBg;
      body.style.backgroundColor = prevBodyBg;
      html.style.colorScheme = prevColorScheme;
    };
  }, []);

  useEffect(() => {
    if (!previewVideoId) {
      setPreviewSlideOpen(false);
      return;
    }
    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setPreviewSlideOpen(true);
      return;
    }
    const id = requestAnimationFrame(() => setPreviewSlideOpen(true));
    return () => cancelAnimationFrame(id);
  }, [previewVideoId]);

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-slate-950 text-white [color-scheme:dark]">
      {/* 顶缘略向上盖：减轻 Android 全屏 / WebView 亚像素缝露出壳层浅色底或 theme 色带 */}
      {/* 天青轻雾，压暗底部，便于读白字 */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 top-[calc(-1*var(--app-viewport-bleed-top))] z-0 bg-gradient-to-b from-sky-300/25 via-teal-950/15 to-slate-950/88"
        aria-hidden
      />

      <NaturePreviewVideoWarmup videoSrc={offscreenWarmupSrc} playbackRate={rate} />

      {videoSrc && !videoBroken ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[calc(-1*var(--app-viewport-bleed-top))] z-[1] overflow-hidden bg-slate-950 transform-gpu">
          <video
            ref={videoRef}
            key={videoSrc}
            className={[
              NATURE_BG_COVER_MEDIA,
              "z-[1] border-0 outline-none motion-reduce:animate-none",
              introRevealed ? "max-sm:animate-nature-widescreen-pan" : "",
              "transition-opacity duration-700 ease-out motion-reduce:transition-none",
              introRevealed ? "opacity-100" : "opacity-0",
            ].join(" ")}
            style={{ maxWidth: "none" }}
            src={videoSrc}
            poster={hasStillIntro ? undefined : poster || undefined}
            muted
            playsInline
            loop
            autoPlay
            preload={hasStillIntro ? "auto" : "metadata"}
            aria-hidden
            onCanPlay={maybeRevealIntroFromBuffer}
            onLoadedData={maybeRevealIntroFromBuffer}
            onProgress={maybeRevealIntroFromBuffer}
            onPlaying={() => {
              clearPlaybackWaitHint();
              maybeRevealIntroFromBuffer();
            }}
            onTimeUpdate={onTimeUpdatePollIntroReveal}
            onWaiting={() => {
              if (introRevealed) schedulePlaybackWaitHint();
            }}
            onStalled={() => {
              if (introRevealed) schedulePlaybackWaitHint();
            }}
            onError={() => setVideoBroken(true)}
          />
          {hasStillIntro ? (
            // eslint-disable-next-line @next/next/no-img-element -- 与视频同构图的静图叠层，需原生解码与缓存
            <img
              src={posterUrl}
              alt=""
              decoding="async"
              fetchPriority="high"
              className={[
                NATURE_BG_COVER_MEDIA,
                "z-[2] pointer-events-none transition-opacity duration-700 ease-out motion-reduce:transition-none",
                introRevealed ? "opacity-0" : "opacity-100",
              ].join(" ")}
              style={{ maxWidth: "none" }}
              aria-hidden
            />
          ) : null}
          {(showSlowIntroHint || showPlaybackWaitHint) && (
            <p
              className="pointer-events-none absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 right-3 z-[3] text-center text-[12px] leading-snug text-white/50 sm:text-[13px] sm:left-6 sm:right-6"
              aria-live="polite"
            >
              {showSlowIntroHint && !introRevealed ? t("nature.slowVisualHint") : t("nature.playbackBufferingHint")}
            </p>
          )}
          <NatureAmbientMixAudio
            layers={ambientLayers}
            videoRef={videoRef}
            playbackRate={rate}
            ambientMuted={ambientMuted}
            ambientLead={hasStillIntro && !introRevealed}
          />
        </div>
      ) : null}

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 top-[calc(-1*var(--app-viewport-bleed-top))] z-[5] bg-gradient-to-b from-slate-950/25 via-transparent to-slate-950/60"
        aria-hidden
      />

      <AppShellTopBar
        tone="onDark"
        landscapeImmersive={false}
        rightAccessory={
          hasAmbientAudio && videoSrc && !videoBroken ? (
            <button
              type="button"
              onClick={() => setAmbientMuted((m) => !m)}
              aria-pressed={ambientMuted}
              aria-label={ambientMuted ? t("chrome.unmuteAmbient") : t("chrome.muteAmbient")}
              className={NATURE_TOP_ICON_BTN}
            >
              {ambientMuted ? (
                <IconBellMuted className="h-[1.25rem] w-[1.25rem] opacity-90" />
              ) : (
                <IconBell className="h-[1.25rem] w-[1.25rem] opacity-90" />
              )}
            </button>
          ) : null
        }
      />

      <ImmersiveAmbientClock visible={landscapeImmersive} />

      <main
        className="relative z-10 mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,calc(env(safe-area-inset-top)+3.5rem))] sm:max-w-xl sm:px-6 sm:pb-[max(2rem,env(safe-area-inset-bottom))] [@media(max-height:500px)]:pb-3 [@media(max-height:500px)_and_(orientation:portrait)]:pt-[max(0.5rem,calc(env(safe-area-inset-top)+2.25rem))] [@media(max-height:500px)]:sm:pb-4"
      >
        {!videoSrc || videoBroken ? (
          <>
            <div className="relative flex min-h-0 flex-1 flex-col">
              <button
                type="button"
                className="absolute inset-0 z-0 cursor-default border-0 bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
                aria-expanded={dockChromeVisible}
                aria-label={t("nature.toggleDockChrome")}
                onClick={() => toggleDockChrome()}
              />
              <div className="relative z-10 flex min-h-0 flex-1 flex-col pointer-events-none">
                <div className="mx-auto mt-6 max-w-sm rounded-3xl bg-white/[0.14] px-5 py-6 text-center ring-1 ring-white/[0.22] backdrop-blur-2xl sm:mt-8">
                  <p className="text-[15px] font-medium leading-snug text-white/90 sm:text-[16px]">{t("nature.emptyTitle")}</p>
                  <p className="mt-3 text-[12px] leading-relaxed text-white/55 sm:text-[13px]">{t("nature.emptyHint")}</p>
                </div>
              </div>
            </div>
            <DockChromeCollapse>
              <HomeMusicRelaxShortcuts className="mx-auto mt-6 shrink-0 sm:mt-8 [@media(max-height:500px)]:mt-3" />
            </DockChromeCollapse>
          </>
        ) : (
          <>
            <p className="sr-only">{t("nature.videoBgAnnounced")}</p>
            <div className="pointer-events-none fixed inset-x-0 top-[38.2dvh] z-[12] flex -translate-y-1/2 justify-center px-5 sm:px-6 [@media(max-height:500px)_and_(orientation:portrait)]:top-[20dvh]">
              <div className="w-full max-w-lg sm:max-w-xl">
                <HomeVerseRotator
                  variant="dark"
                  prominence="nature"
                  className="w-full min-h-[6.5rem] sm:min-h-[7.5rem] landscape:min-h-0 [@media(max-height:500px)_and_(orientation:portrait)]:min-h-[4rem] [@media(max-height:500px)_and_(orientation:portrait)]:sm:min-h-[4.25rem]"
                />
              </div>
            </div>
            <div className="relative flex min-h-0 flex-1 flex-col">
              <button
                type="button"
                className="absolute inset-0 z-0 cursor-default border-0 bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
                aria-expanded={dockChromeVisible}
                aria-label={t("nature.toggleDockChrome")}
                onClick={() => toggleDockChrome()}
              />
            </div>
            <DockChromeCollapse>
              <HomeMusicRelaxShortcuts className="mx-auto mt-6 w-full max-w-md shrink-0 sm:mt-7 [@media(max-height:500px)]:mt-2 [@media(max-height:500px)]:sm:mt-2.5" />
              <div
                className={`w-full shrink-0 transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
                  previewVideoId ? "grid grid-rows-[1fr]" : "grid grid-rows-[0fr]"
                }`}
              >
                <div className="min-h-0 overflow-hidden">
                  {previewVideoId ? (
                    <div
                      onTransitionEnd={handlePreviewSlideTransitionEnd}
                      className={[
                        "will-change-transform transition-transform duration-300 ease-out motion-reduce:translate-y-0 motion-reduce:transition-none",
                        previewSlideOpen ? "translate-y-0" : "translate-y-full",
                      ].join(" ")}
                    >
                      <NatureScenePreviewPanel
                        settings={initial}
                        previewVideoId={previewVideoId}
                        playbackRate={rate}
                        onEnterImmersive={confirmPreviewFullScreen}
                        onPreviewVideoError={() => {
                          setPreviewSlideOpen(false);
                          setPreviewVideoId(null);
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
              <NatureSceneLayer
                className="mt-5 shrink-0 sm:mt-6 [@media(max-height:500px)]:mt-2 [@media(max-height:500px)]:sm:mt-2.5"
                settings={initial}
                activeVideoId={playbackSettings.activeVideoId}
                previewVideoId={previewVideoId}
                onSceneCardPress={onSceneCardPress}
              />
            </DockChromeCollapse>
          </>
        )}
      </main>
    </div>
  );
}
