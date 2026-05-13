"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLandscapeNarrow } from "@/hooks/useLandscapeNarrow";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useAppSkin } from "@/components/theme/AppSkinProvider";
import { AppShellTopBar } from "@/components/app-shell/AppShellTopBar";
import { DockChromeCollapse, useHomeDockChrome } from "@/components/home/HomeDockChromeContext";
import { ImmersiveAmbientClock } from "@/components/home/ImmersiveAmbientClock";
import { HomeMusicRelaxShortcuts } from "@/components/home/HomeMusicRelaxShortcuts";
import { HomeVerseRotator } from "@/components/home/HomeVerseRotator";
import { NatureAmbientMixAudio } from "@/components/nature/NatureAmbientMixAudio";
import { NatureSceneLayer } from "@/components/nature/NatureSceneLayer";
import type { AppLocale } from "@/lib/i18n/config";
import type { HomeVerseEntry } from "@/lib/i18n/home-verses";
import type { NatureSettingsV2 } from "@/lib/nature/types";
import { fetchNatureVideoFully } from "@/lib/nature/fetch-nature-video-fully";
import { resolveNaturePlayback } from "@/lib/nature/resolve-nature-playback";
import {
  NATURE_HOME_ROOT_THEME,
  NATURE_HOME_THEME_LOCK_DATASET_KEY,
  NATURE_HOME_THEME_LOCK_VALUE,
} from "@/lib/nature/root-theme";
import {
  NATURE_SOFT_FOCUS_DEFAULTS,
  readNatureSoftFocusPrefs,
  writeNatureSoftFocusPrefs,
} from "@/lib/nature/nature-soft-focus-prefs";
import { useShellChromeScrimVisuals } from "@/hooks/useShellChromeScrimVisuals";
import { shellTemplatePreviewThemeById } from "@/lib/shell/template-preview-themes";
import { exitFullscreenCompat, requestFullscreenCompat } from "@/lib/dom/fullscreen";
import { isIosLikeUserAgent } from "@/lib/dom/ios";

const NATURE_TOP_ICON_BTN =
  "touch-manipulation flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full transition active:scale-[0.97] text-white/[0.9] hover:bg-white/[0.1]";

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

function IconBgSoftFocus(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="6.5" stroke="currentColor" strokeWidth="1.35" strokeDasharray="2.2 3.4" opacity="0.85" />
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.2" strokeDasharray="1.8 4" opacity="0.55" />
    </svg>
  );
}

type Props = {
  initial: NatureSettingsV2;
  /** 顶/底压边与浅色壳同源，由 `useShellChromeScrimVisuals`（后台「壳层压边」+ 本机存储）统一计算 */
  brandChrome: { appLight: string; appDark: string };
  /** 由服务端从已导入译本解析的首页轮播经文（中英各一套） */
  homeVerseRotation?: Record<AppLocale, HomeVerseEntry[]>;
};

/** 背景视频槽：与滚动区 `canvas` 对齐；底栏用 `appDark`，与主区背景色系一致衔接 */
const NATURE_VIDEO_STAGE_FRAME =
  "relative z-[1] w-full shrink-0 overflow-hidden bg-canvas transform-gpu min-h-[12rem]";

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
 * 自然：背景视频限高在「视口 − 底栏」槽内；经文叠在视频上；场景与快捷入口在视频下方独立流式区域（与视频解耦）。
 */
export function NatureVideoExperience({ initial, brandChrome, homeVerseRotation }: Props) {
  const { t } = useLocale();
  const { shellTemplateBrand } = useAppSkin();
  const { dockChromeVisible, setDockChromeVisible, toggleDockChrome } = useHomeDockChrome();
  const videoRef = useRef<HTMLVideoElement>(null);
  const prepareAbortRef = useRef<AbortController | null>(null);
  const prepareGenRef = useRef(0);
  const prepareTargetIdRef = useRef<string | null>(null);
  const introRevealGuardRef = useRef(false);
  const playbackWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 与量高逻辑配合：忽略 ±12px 内抖动，减轻 iOS 周期性闪屏 */
  const videoStageHeightCommitRef = useRef(0);

  const [ambientMuted, setAmbientMuted] = useState(false);
  const [natureBgSoftFocus, setNatureBgSoftFocus] = useState(false);
  const [natureSoftFocusPanelOpen, setNatureSoftFocusPanelOpen] = useState(false);
  const [natureSoftFocusOverlayOpacity, setNatureSoftFocusOverlayOpacity] = useState(
    NATURE_SOFT_FOCUS_DEFAULTS.overlayOpacity,
  );
  const [natureSoftFocusBlurPx, setNatureSoftFocusBlurPx] = useState(NATURE_SOFT_FOCUS_DEFAULTS.blurPx);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const softFocusPersistTimerRef = useRef<number | null>(null);
  const [videoBroken, setVideoBroken] = useState(false);
  /** 主壳滚动区可视高度（px），与底栏 flex 分配同源，避免 `100dvh` 与实高偏差 */
  const [videoStageHeightPx, setVideoStageHeightPx] = useState(0);
  /** 场景小图：整段影片拉取中；progress null 表示无 Content-Length */
  const [scenePrepare, setScenePrepare] = useState<{ id: string; progress: number | null } | null>(null);
  const [activeVideoId, setActiveVideoId] = useState(
    () => initial.activeVideoId.trim() || initial.videos[0]?.id || "",
  );
  const landscapeNarrow = useLandscapeNarrow();

  const scrimBrandChrome = useMemo(() => {
    if (shellTemplateBrand) {
      const c = shellTemplatePreviewThemeById(shellTemplateBrand).colors;
      return { appLight: c.appLight, appDark: c.appDark };
    }
    return brandChrome;
  }, [shellTemplateBrand, brandChrome]);

  const { topLayerStyle, bottomLayerStyleNatureVideoStage } = useShellChromeScrimVisuals(
    scrimBrandChrome.appLight,
    scrimBrandChrome.appDark,
  );

  useEffect(() => {
    const next = initial.activeVideoId.trim() || initial.videos[0]?.id || "";
    setActiveVideoId(next);
  }, [initial]);

  useLayoutEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-app-shell-scroll]");
    if (!root) return;

    /** iOS：visualViewport `scroll` 会高频触发；与 RO 叠加时 `clientHeight` 常在 ±1px 抖动，整槽高度重算会像周期性闪屏。仅采纳明显变化（≥12px），并短防抖。 */
    let debounceId: number | null = null;

    const applyHeight = () => {
      const h = Math.round(root.clientHeight);
      if (h <= 0) return;
      const prev = videoStageHeightCommitRef.current;
      if (prev !== 0 && Math.abs(h - prev) < 12) return;
      videoStageHeightCommitRef.current = h;
      setVideoStageHeightPx(h);
    };

    const schedule = () => {
      if (debounceId != null) window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        debounceId = null;
        applyHeight();
      }, 140);
    };

    applyHeight();
    requestAnimationFrame(() => applyHeight());

    const ro = new ResizeObserver(() => schedule());
    ro.observe(root);
    const onWin = () => schedule();
    window.addEventListener("resize", onWin);
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", onWin);
    }
    return () => {
      if (debounceId != null) window.clearTimeout(debounceId);
      ro.disconnect();
      window.removeEventListener("resize", onWin);
      if (vv) {
        vv.removeEventListener("resize", onWin);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      prepareAbortRef.current?.abort();
      prepareGenRef.current += 1;
      prepareTargetIdRef.current = null;
      setScenePrepare(null);
    };
  }, []);

  const playbackSettings = useMemo(
    () => ({
      ...initial,
      activeVideoId: activeVideoId.trim() || initial.activeVideoId.trim() || initial.videos[0]?.id || "",
    }),
    [initial, activeVideoId],
  );

  const selectVideoAndImmersive = useCallback((id: string) => {
    setActiveVideoId(id);
    setDockChromeVisible(false);
  }, [setDockChromeVisible]);

  /** 点场景小图：整段影片下载完成后再切主背景；换选或离开页会中止 */
  const onSceneCardPress = useCallback(
    (id: string) => {
      const next = id.trim();
      if (!next || next === activeVideoId.trim()) return;
      if (prepareTargetIdRef.current === next) return;

      prepareAbortRef.current?.abort();
      const ac = new AbortController();
      prepareAbortRef.current = ac;
      prepareGenRef.current += 1;
      const gen = prepareGenRef.current;
      prepareTargetIdRef.current = next;
      setScenePrepare({ id: next, progress: 0 });

      void (async () => {
        try {
          const { videoSrc } = resolveNaturePlayback({
            ...initial,
            activeVideoId: next,
          });
          const url = videoSrc.trim();
          if (!url) throw new Error("empty video src");
          await fetchNatureVideoFully(url, ac.signal, (received, totalBytes) => {
            if (prepareGenRef.current !== gen) return;
            if (totalBytes != null && totalBytes > 0) {
              setScenePrepare({ id: next, progress: Math.min(1, received / totalBytes) });
            } else {
              setScenePrepare({ id: next, progress: null });
            }
          });
        } catch {
          if (prepareGenRef.current === gen && !ac.signal.aborted) {
            prepareTargetIdRef.current = null;
            setScenePrepare(null);
          }
          return;
        }

        if (ac.signal.aborted || prepareGenRef.current !== gen) return;
        prepareTargetIdRef.current = null;
        setScenePrepare(null);
        selectVideoAndImmersive(next);
      })();
    },
    [activeVideoId, initial, selectVideoAndImmersive],
  );

  const { videoSrc, posterSrc, ambientLayers } = useMemo(
    () => resolveNaturePlayback(playbackSettings),
    [playbackSettings],
  );
  const hasMainVideo = Boolean(videoSrc.trim()) && !videoBroken;
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

  const landscapeImmersive = landscapeNarrow && hasMainVideo;

  const videoStageShellStyle: CSSProperties = useMemo(
    () => ({
      height:
        videoStageHeightPx > 0 ? `${videoStageHeightPx}px` : "calc(100dvh - var(--home-bottom-nav-slot))",
    }),
    [videoStageHeightPx],
  );

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
    /** iOS / iPadOS：对 `documentElement` 自动全屏易导致系统退出、手势与误触（含底栏「首页」）；仅桌面系横屏窄窗使用。 */
    if (isIosLikeUserAgent()) {
      if (document.fullscreenElement === document.documentElement) {
        void exitFullscreenCompat();
      }
      return;
    }
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
    /** iOS 主屏 Web：升 preload + `load()` 易拉高解码缓冲，加重内存压力 → 更易被系统整页杀掉后白屏重载 */
    if (isIosLikeUserAgent()) return;
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

  useLayoutEffect(() => {
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
    html.dataset[NATURE_HOME_THEME_LOCK_DATASET_KEY] = NATURE_HOME_THEME_LOCK_VALUE;
    const prevHtmlBg = html.style.backgroundColor;
    const prevBodyBg = body.style.backgroundColor;
    const prevColorScheme = html.style.colorScheme;
    html.style.backgroundColor = NATURE_HOME_ROOT_THEME;
    body.style.backgroundColor = NATURE_HOME_ROOT_THEME;
    html.style.colorScheme = "dark";
    return () => {
      Reflect.deleteProperty(html.dataset, NATURE_HOME_THEME_LOCK_DATASET_KEY);
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
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPrefersReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const p = readNatureSoftFocusPrefs();
    setNatureSoftFocusOverlayOpacity(p.overlayOpacity);
    setNatureSoftFocusBlurPx(p.blurPx);
  }, []);

  useEffect(() => {
    return () => {
      if (softFocusPersistTimerRef.current != null) {
        window.clearTimeout(softFocusPersistTimerRef.current);
      }
    };
  }, []);

  const scheduleNatureSoftFocusPersist = useCallback((overlayOpacity: number, blurPx: number) => {
    if (softFocusPersistTimerRef.current != null) {
      window.clearTimeout(softFocusPersistTimerRef.current);
    }
    softFocusPersistTimerRef.current = window.setTimeout(() => {
      softFocusPersistTimerRef.current = null;
      writeNatureSoftFocusPrefs({ overlayOpacity, blurPx });
    }, 220);
  }, []);

  const onNatureSoftFocusIconClick = useCallback(() => {
    if (natureBgSoftFocus && natureSoftFocusPanelOpen) {
      writeNatureSoftFocusPrefs({
        overlayOpacity: natureSoftFocusOverlayOpacity,
        blurPx: natureSoftFocusBlurPx,
      });
      setNatureBgSoftFocus(false);
      setNatureSoftFocusPanelOpen(false);
      return;
    }
    if (natureBgSoftFocus && !natureSoftFocusPanelOpen) {
      setNatureSoftFocusPanelOpen(true);
      return;
    }
    const p = readNatureSoftFocusPrefs();
    setNatureSoftFocusOverlayOpacity(p.overlayOpacity);
    setNatureSoftFocusBlurPx(p.blurPx);
    setNatureBgSoftFocus(true);
    setNatureSoftFocusPanelOpen(true);
  }, [
    natureBgSoftFocus,
    natureSoftFocusBlurPx,
    natureSoftFocusOverlayOpacity,
    natureSoftFocusPanelOpen,
  ]);

  const effectiveNatureSoftFocusBlurPx = prefersReducedMotion
    ? Math.min(natureSoftFocusBlurPx, 10)
    : natureSoftFocusBlurPx;

  const natureSoftFocusTriggerAria =
    natureBgSoftFocus && natureSoftFocusPanelOpen
      ? t("nature.bgSoftFocusCloseAria")
      : natureBgSoftFocus && !natureSoftFocusPanelOpen
        ? t("nature.bgSoftFocusOpenPanelAria")
        : t("nature.bgSoftFocusStartAria");

  return (
    <div className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden bg-canvas text-white [color-scheme:dark]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[6] w-full"
        style={topLayerStyle}
        aria-hidden
      />

      <AppShellTopBar
        tone="onDark"
        landscapeImmersive={false}
        rightAccessory={
          <div className="flex flex-col items-end gap-2">
            {hasAmbientAudio && hasMainVideo ? (
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
            ) : null}
            {hasMainVideo ? (
              <div className="relative isolate">
                {natureSoftFocusPanelOpen ? (
                  <div
                    id="nature-soft-focus-panel"
                    role="region"
                    aria-label={t("nature.bgSoftFocusPanelTitle")}
                    className="pointer-events-auto absolute right-full top-1/2 z-[60] mr-2 w-[min(13.75rem,calc(100vw-5rem))] -translate-y-1/2 rounded-2xl border border-white/18 bg-black/55 px-3 py-2.5 text-left shadow-[0_8px_36px_-8px_rgba(0,0,0,0.5)] backdrop-blur-xl"
                  >
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                      {t("nature.bgSoftFocusPanelTitle")}
                    </p>
                    <label className="block text-[12px] text-white/78" htmlFor="nature-soft-focus-overlay">
                      {t("nature.bgSoftFocusOverlayLabel")}
                    </label>
                    <input
                      id="nature-soft-focus-overlay"
                      type="range"
                      min={0.08}
                      max={0.82}
                      step={0.01}
                      value={natureSoftFocusOverlayOpacity}
                      className="mb-2.5 mt-1 w-full accent-white"
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        setNatureSoftFocusOverlayOpacity(v);
                        scheduleNatureSoftFocusPersist(v, natureSoftFocusBlurPx);
                      }}
                    />
                    <label className="block text-[12px] text-white/78" htmlFor="nature-soft-focus-blur">
                      {t("nature.bgSoftFocusBlurLabel")}
                    </label>
                    <input
                      id="nature-soft-focus-blur"
                      type="range"
                      min={2}
                      max={48}
                      step={1}
                      value={natureSoftFocusBlurPx}
                      className="mt-1 w-full accent-white"
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        const b = Math.round(v);
                        setNatureSoftFocusBlurPx(b);
                        scheduleNatureSoftFocusPersist(natureSoftFocusOverlayOpacity, b);
                      }}
                    />
                    <button
                      type="button"
                      className="mt-2.5 w-full border-0 bg-transparent p-0 text-left text-[12px] text-white/55 underline decoration-white/25 underline-offset-2 transition hover:text-white/80"
                      onClick={() => setNatureSoftFocusPanelOpen(false)}
                    >
                      {t("nature.bgSoftFocusHidePanel")}
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={onNatureSoftFocusIconClick}
                  aria-expanded={natureSoftFocusPanelOpen}
                  aria-controls={natureSoftFocusPanelOpen ? "nature-soft-focus-panel" : undefined}
                  aria-pressed={natureBgSoftFocus}
                  aria-label={natureSoftFocusTriggerAria}
                  className={NATURE_TOP_ICON_BTN}
                >
                  <IconBgSoftFocus
                    className={
                      natureBgSoftFocus
                        ? "h-[1.25rem] w-[1.25rem] text-white [filter:drop-shadow(0_0_6px_rgba(255,255,255,0.95))_drop-shadow(0_0_18px_rgba(200,225,255,0.55))]"
                        : "h-[1.25rem] w-[1.25rem] opacity-90"
                    }
                  />
                </button>
              </div>
            ) : null}
          </div>
        }
      />

      <ImmersiveAmbientClock visible={landscapeImmersive} />

      {hasMainVideo ? (
        <div className={NATURE_VIDEO_STAGE_FRAME} style={videoStageShellStyle}>
          <div
            className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-sky-300/25 via-teal-950/15 to-transparent"
            aria-hidden
          />
          <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden bg-canvas">
            <video
              ref={videoRef}
              key={videoSrc}
              className={[
                NATURE_BG_COVER_MEDIA,
                "z-[1] border-0 outline-none",
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
          </div>
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] w-full"
            style={bottomLayerStyleNatureVideoStage}
            aria-hidden
          />
          {natureBgSoftFocus ? (
            <div
              className="pointer-events-none absolute inset-0 z-[8]"
              style={
                {
                  backgroundColor: `rgba(0,0,0,${natureSoftFocusOverlayOpacity})`,
                  backdropFilter: `blur(${effectiveNatureSoftFocusBlurPx}px)`,
                  WebkitBackdropFilter: `blur(${effectiveNatureSoftFocusBlurPx}px)`,
                } satisfies CSSProperties
              }
              aria-hidden
            />
          ) : null}
          {(showSlowIntroHint || showPlaybackWaitHint) && (
            <p
              className="pointer-events-none absolute bottom-4 left-3 right-3 z-[3] text-center text-[12px] leading-snug text-white/50 sm:bottom-5 sm:text-[13px] sm:left-6 sm:right-6"
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
          <button
            type="button"
            className="absolute inset-0 z-[7] cursor-default border-0 bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
            aria-expanded={dockChromeVisible}
            aria-label={t("nature.toggleDockChrome")}
            onClick={() => toggleDockChrome()}
          />
          <p className="sr-only">{t("nature.videoBgAnnounced")}</p>
          <div className="pointer-events-none absolute inset-x-0 top-[38.2%] z-[12] flex -translate-y-1/2 justify-center px-5 sm:px-6 [@media(max-height:500px)_and_(orientation:portrait)]:top-[32%]">
            <div className="w-full max-w-lg sm:max-w-xl">
              <HomeVerseRotator
                entriesByLocale={homeVerseRotation}
                variant="dark"
                prominence="nature"
                className="w-full min-h-[6.5rem] sm:min-h-[7.5rem] landscape:min-h-0 [@media(max-height:500px)_and_(orientation:portrait)]:min-h-[4rem] [@media(max-height:500px)_and_(orientation:portrait)]:sm:min-h-[4.25rem]"
              />
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[14] flex max-h-[min(48dvh,58svh)] min-h-0 flex-col justify-end px-4 pb-2 pt-1 sm:px-6 sm:pb-3 md:px-8 xl:px-10">
            <div
              className={[
                "mx-auto w-full min-h-0 max-w-lg px-3 pb-1 pt-2 sm:max-w-xl sm:px-4 sm:pb-2 sm:pt-2.5 md:max-w-3xl lg:max-w-none lg:px-5",
                dockChromeVisible ? "pointer-events-auto" : "pointer-events-none",
              ].join(" ")}
            >
              <DockChromeCollapse>
                <HomeMusicRelaxShortcuts className="mx-auto w-full max-w-md shrink-0 lg:max-w-none" />
                <NatureSceneLayer
                  className="mt-2 shrink-0 sm:mt-2.5 [@media(max-height:500px)]:mt-1.5 [@media(max-height:500px)]:sm:mt-2"
                  settings={initial}
                  activeVideoId={playbackSettings.activeVideoId}
                  prepareSceneId={scenePrepare?.id ?? null}
                  prepareProgress={scenePrepare?.progress ?? null}
                  onSceneCardPress={onSceneCardPress}
                />
              </DockChromeCollapse>
            </div>
          </div>
        </div>
      ) : (
        <div className={NATURE_VIDEO_STAGE_FRAME} style={videoStageShellStyle}>
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-sky-300/20 via-canvas to-canvas"
            aria-hidden
          />
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
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[14] flex max-h-[min(40dvh,50svh)] min-h-0 flex-col justify-end px-4 pb-2 sm:px-6 sm:pb-3 md:px-8 xl:px-10">
              <div
              className={[
                "mx-auto w-full min-h-0 max-w-lg px-3 pb-1 pt-2 sm:max-w-xl sm:px-4 sm:pb-2 sm:pt-2.5 md:max-w-3xl lg:max-w-none lg:px-5",
                dockChromeVisible ? "pointer-events-auto" : "pointer-events-none",
              ].join(" ")}
            >
                <DockChromeCollapse>
                  <HomeMusicRelaxShortcuts className="mx-auto w-full max-w-md shrink-0 lg:max-w-none" />
                </DockChromeCollapse>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
