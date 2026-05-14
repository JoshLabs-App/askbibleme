"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";
import { useLandscapeNarrow } from "@/hooks/useLandscapeNarrow";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { AppShellTopBar } from "@/components/app-shell/AppShellTopBar";
import { DockChromeCollapse, useHomeDockChrome } from "@/components/home/HomeDockChromeContext";
import { HomeSleepTimerControl } from "@/components/home/HomeSleepTimerControl";
import { HomeVerseRotator } from "@/components/home/HomeVerseRotator";
import { NatureSceneLayer } from "@/components/nature/NatureSceneLayer";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import type { NatureSettingsV2, NatureVideoEntry } from "@/lib/nature/types";
import { resolveNaturePlayback } from "@/lib/nature/resolve-nature-playback";
import { useNatureMediaPolicy } from "@/hooks/useNatureMediaPolicy";
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
import { readAppShellScrollContentBoxClientHeight } from "@/lib/shell/home-dock-nav-bg";
import { HomeShellFloatingRouteNav } from "@/components/home/HomeShellFloatingRouteNav";
import { exitFullscreenCompat, requestFullscreenCompat } from "@/lib/dom/fullscreen";
import { isIosLikeUserAgent } from "@/lib/dom/ios";

/** 当前场景停留后再挂视频解码（毫秒） */
const NATURE_SCENE_DWELL_MS = 3000;
/** 水平滑动切换场景的最小位移（px） */
const NATURE_SCENE_SWIPE_MIN_DX = 48;

function adjacentNatureSceneId(videos: NatureVideoEntry[], currentId: string, direction: 1 | -1): string | null {
  const ids = videos.map((v) => v.id.trim()).filter(Boolean);
  if (ids.length < 2) return null;
  let i = ids.indexOf(currentId.trim());
  if (i < 0) i = 0;
  const n = (i + direction + ids.length) % ids.length;
  return ids[n] ?? null;
}

/** 音乐静音：保留 44×44 触控，无圆形底框 */
const NATURE_BELL_BTN =
  "touch-manipulation inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-none border-0 bg-transparent p-0 text-white/[0.9] transition hover:text-white active:scale-[0.97]";

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

function IconBgSoftFocus(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="6.5" stroke="currentColor" strokeWidth="1.35" strokeDasharray="2.2 3.4" opacity="0.85" />
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.2" strokeDasharray="1.8 4" opacity="0.55" />
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
 * 自然：背景视频铺满主列；左/右滑切换场景（先静图）；停留约 3s 且内存/省流等许可后再挂 `<video>` 解码与渐显。
 */
export function NatureVideoExperience({ initial }: Props) {
  const { t } = useLocale();
  const { dockChromeVisible, setDockChromeVisible, toggleDockChrome, peekDockChrome } = useHomeDockChrome();
  const videoRef = useRef<HTMLVideoElement>(null);
  const introRevealGuardRef = useRef(false);
  const swipeBlankTouchRef = useRef<{ x: number; y: number } | null>(null);
  const suppressBlankTapRef = useRef(false);
  const playbackWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 与量高逻辑配合：忽略 ±12px 内抖动，减轻 iOS 周期性闪屏 */
  const videoStageHeightCommitRef = useRef(0);

  const { shellAudioMuted, setShellAudioMuted } = useMusicShellPlayback();
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
  const [dwellVideoAllowed, setDwellVideoAllowed] = useState(false);
  const [dwellPolicyResolved, setDwellPolicyResolved] = useState(false);
  const [natureSettings, setNatureSettings] = useState<NatureSettingsV2>(initial);
  const [activeVideoId, setActiveVideoId] = useState(
    () => initial.activeVideoId.trim() || initial.videos[0]?.id || "",
  );
  const landscapeNarrow = useLandscapeNarrow();

  useEffect(() => {
    setNatureSettings(initial);
    const next = initial.activeVideoId.trim() || initial.videos[0]?.id || "";
    setActiveVideoId(next);
  }, [initial]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/nature/settings", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as NatureSettingsV2 | null;
        if (
          cancelled ||
          !data ||
          data.version !== 2 ||
          !Array.isArray(data.videos) ||
          !Array.isArray(data.ambientClips)
        ) {
          return;
        }
        setNatureSettings(data);
        setActiveVideoId((prev) => {
          const ids = new Set(data.videos.map((v) => v.id.trim()).filter(Boolean));
          const p = prev.trim();
          if (p && ids.has(p)) return prev;
          const fb = data.activeVideoId.trim() || data.videos[0]?.id || "";
          return fb || prev;
        });
      } catch {
        /* 离线等：保留构建期 initial */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-app-shell-scroll]");
    if (!root) return;

    /** iOS：visualViewport `scroll` 会高频触发；与 RO 叠加时 `clientHeight` 常在 ±1px 抖动，整槽高度重算会像周期性闪屏。仅采纳明显变化（≥12px），并短防抖。 */
    let debounceId: number | null = null;

    const applyHeight = () => {
      const readH = readAppShellScrollContentBoxClientHeight(root);
      if (readH <= 0) return;
      /** Android：safe-area 常为 0，scroll 盒 `clientHeight` 也可能小于可见视口，取较大值避免顶缘露壳层色条 */
      const vvH = typeof window !== "undefined" ? window.visualViewport?.height ?? 0 : 0;
      const innerH = typeof window !== "undefined" ? window.innerHeight : 0;
      const h = Math.max(readH, vvH || 0, innerH || 0);
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
      vv.addEventListener("scroll", onWin);
    }
    return () => {
      if (debounceId != null) window.clearTimeout(debounceId);
      ro.disconnect();
      window.removeEventListener("resize", onWin);
      if (vv) {
        vv.removeEventListener("resize", onWin);
        vv.removeEventListener("scroll", onWin);
      }
    };
  }, []);

  const playbackSettings = useMemo(
    () => ({
      ...natureSettings,
      activeVideoId: activeVideoId.trim() || natureSettings.activeVideoId.trim() || natureSettings.videos[0]?.id || "",
    }),
    [natureSettings, activeVideoId],
  );

  const selectVideoAndImmersive = useCallback(
    (id: string, opts?: { peekSceneDock?: boolean }) => {
      setActiveVideoId(id);
      if (opts?.peekSceneDock) {
        peekDockChrome();
      } else {
        setDockChromeVisible(false);
      }
    },
    [peekDockChrome, setDockChromeVisible],
  );

  /** 点场景小图：按需切源，由浏览器渐进缓冲；静图叠层直至缓冲够再揭晓 */
  const onSceneCardPress = useCallback(
    (id: string) => {
      const next = id.trim();
      if (!next || next === activeVideoId.trim()) return;
      selectVideoAndImmersive(next);
    },
    [activeVideoId, selectVideoAndImmersive],
  );

  const { videoSrc, posterSrc, previewStillSrc } = useMemo(
    () => resolveNaturePlayback(playbackSettings),
    [playbackSettings],
  );
  const hasMainVideo = Boolean(videoSrc.trim()) && !videoBroken;
  const mediaPolicy = useNatureMediaPolicy();

  useEffect(() => {
    if (!hasMainVideo) setNatureBgSoftFocus(false);
  }, [hasMainVideo]);
  const stillImageUrl = (posterSrc?.trim() || previewStillSrc?.trim() || "").trim();
  const posterUrl = stillImageUrl;
  const hasStillIntro = posterUrl.length > 0;
  /** 低电量：仅静图，不挂载解码 `<video>` */
  const posterOnlyLowPower = mediaPolicy.lowBatteryStatic && hasStillIntro;
  const showNatureVideoDecoder = hasMainVideo && !posterOnlyLowPower && dwellVideoAllowed;

  useEffect(() => {
    setDwellVideoAllowed(false);
    setDwellPolicyResolved(false);

    if (!hasMainVideo) {
      return;
    }

    if (posterOnlyLowPower) {
      setDwellVideoAllowed(false);
      setDwellPolicyResolved(true);
      return;
    }

    const id = window.setTimeout(() => {
      setDwellPolicyResolved(true);
      const mem = mediaPolicy.deviceMemoryGb;
      const memoryOk = mem === undefined || mem >= 3;
      if (mediaPolicy.lowBatteryStatic || mediaPolicy.saveData || !memoryOk) {
        setDwellVideoAllowed(false);
      } else {
        setDwellVideoAllowed(true);
      }
    }, NATURE_SCENE_DWELL_MS);

    return () => window.clearTimeout(id);
  }, [
    activeVideoId,
    hasMainVideo,
    posterOnlyLowPower,
    mediaPolicy.lowBatteryStatic,
    mediaPolicy.saveData,
    mediaPolicy.deviceMemoryGb,
  ]);

  const conservationHintKey = useMemo(() => {
    if (!hasMainVideo || showNatureVideoDecoder) return null;
    if (mediaPolicy.lowBatteryStatic) return "lowBattery" as const;
    if (!dwellPolicyResolved) return null;
    if (mediaPolicy.saveData) return "saveData" as const;
    const mem = mediaPolicy.deviceMemoryGb;
    if (mem !== undefined && mem < 3) return "lowMemory" as const;
    return null;
  }, [
    hasMainVideo,
    showNatureVideoDecoder,
    mediaPolicy.lowBatteryStatic,
    mediaPolicy.saveData,
    mediaPolicy.deviceMemoryGb,
    dwellPolicyResolved,
  ]);

  const rate = natureSettings.playbackRate;

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
    if (posterOnlyLowPower) return;
    if (introRevealGuardRef.current) return;
    introRevealGuardRef.current = true;
    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setIntroRevealed(true);
    } else {
      requestAnimationFrame(() => setIntroRevealed(true));
    }
  }, [posterUrl, posterOnlyLowPower]);

  const maybeRevealIntroFromBuffer = useCallback(() => {
    if (!posterUrl || posterOnlyLowPower) return;
    if (introRevealGuardRef.current) return;
    const v = videoRef.current;
    if (!v || !hasEnoughBufferedAhead(v, bufferAheadThreshold)) return;
    commitIntroReveal();
  }, [posterUrl, posterOnlyLowPower, commitIntroReveal, bufferAheadThreshold]);

  const onTimeUpdatePollIntroReveal = useCallback(() => {
    const now = performance.now();
    if (now - lastBufferRevealPollRef.current < 220) return;
    lastBufferRevealPollRef.current = now;
    maybeRevealIntroFromBuffer();
  }, [maybeRevealIntroFromBuffer]);

  const landscapeImmersive = landscapeNarrow && showNatureVideoDecoder;

  const videoStageShellStyle: CSSProperties = useMemo(
    () => ({
      height:
        videoStageHeightPx > 0
          ? `${videoStageHeightPx}px`
          : "max(100dvh, 100svh, 100vh)",
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
    const p = (posterSrc?.trim() || previewStillSrc?.trim() || "").trim();
    setIntroRevealed(p.length === 0);
  }, [videoSrc, posterSrc, previewStillSrc, clearPlaybackWaitHint]);

  useEffect(() => {
    if (!posterUrl || introRevealed || posterOnlyLowPower || !dwellVideoAllowed) return;
    const id = window.setTimeout(() => {
      if (introRevealGuardRef.current) return;
      introRevealGuardRef.current = true;
      setIntroRevealed(true);
    }, INTRO_REVEAL_FALLBACK_MS);
    return () => clearTimeout(id);
  }, [posterUrl, introRevealed, videoSrc, posterOnlyLowPower, dwellVideoAllowed]);

  useEffect(() => {
    if (!hasStillIntro || introRevealed || !posterUrl || posterOnlyLowPower || !dwellVideoAllowed) {
      setShowSlowIntroHint(false);
      return;
    }
    const id = window.setTimeout(() => setShowSlowIntroHint(true), SLOW_INTRO_HINT_DELAY_MS);
    return () => {
      clearTimeout(id);
      setShowSlowIntroHint(false);
    };
  }, [hasStillIntro, introRevealed, posterUrl, videoSrc, posterOnlyLowPower, dwellVideoAllowed]);

  useEffect(() => {
    return () => clearPlaybackWaitHint();
  }, [clearPlaybackWaitHint]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoSrc || videoBroken || posterOnlyLowPower) return;
    el.muted = true;
    try {
      el.playbackRate = rate;
    } catch {
      /* ignore */
    }
  }, [rate, videoSrc, videoBroken, posterOnlyLowPower]);

  /** 首访无静图时仅 metadata；不在后台、非低电静图、非低内存机、非 iOS 时 idle 后再升 preload=auto（省流跳过） */
  useEffect(() => {
    if (!dwellVideoAllowed) return;
    if (hasStillIntro) return;
    if (isIosLikeUserAgent()) return;
    if (!mediaPolicy.documentVisible) return;
    if (mediaPolicy.lowBatteryStatic) return;
    if (mediaPolicy.saveData) return;
    if (typeof mediaPolicy.deviceMemoryGb === "number" && mediaPolicy.deviceMemoryGb > 0 && mediaPolicy.deviceMemoryGb <= 4) {
      return;
    }
    const el = videoRef.current;
    if (!el || !videoSrc || videoBroken) return;
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
  }, [
    videoSrc,
    videoBroken,
    hasStillIntro,
    mediaPolicy.documentVisible,
    mediaPolicy.lowBatteryStatic,
    mediaPolicy.saveData,
    mediaPolicy.deviceMemoryGb,
    dwellVideoAllowed,
  ]);

  /** 后台标签：暂停解码，减少不可见时的缓冲 */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !videoSrc.trim() || videoBroken || posterOnlyLowPower) return;
    if (!dwellVideoAllowed) return;
    if (!mediaPolicy.documentVisible) {
      v.pause();
      return;
    }
    if (hasStillIntro && !introRevealed) return;
    void v.play().catch(() => {});
  }, [
    mediaPolicy.documentVisible,
    videoSrc,
    videoBroken,
    posterOnlyLowPower,
    hasStillIntro,
    introRevealed,
    dwellVideoAllowed,
  ]);

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

  /** 视频空白：柔焦面板打开时只收起面板，不切换底栏场景区 */
  const onNatureVideoBlankClick = useCallback(() => {
    if (natureSoftFocusPanelOpen) {
      setNatureSoftFocusPanelOpen(false);
      return;
    }
    toggleDockChrome();
  }, [natureSoftFocusPanelOpen, toggleDockChrome]);

  const onBlankPointerDown = useCallback((e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse") {
      swipeBlankTouchRef.current = null;
      return;
    }
    swipeBlankTouchRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onBlankPointerUp = useCallback(
    (e: PointerEvent<HTMLButtonElement>) => {
      if (e.pointerType === "mouse") return;
      const start = swipeBlankTouchRef.current;
      swipeBlankTouchRef.current = null;
      if (!start || natureSettings.videos.length < 2) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.abs(dx) < NATURE_SCENE_SWIPE_MIN_DX || Math.abs(dx) < Math.abs(dy) * 1.15) return;
      const direction = (dx < 0 ? 1 : -1) as 1 | -1;
      const next = adjacentNatureSceneId(natureSettings.videos, activeVideoId, direction);
      if (next && next !== activeVideoId.trim()) {
        suppressBlankTapRef.current = true;
        selectVideoAndImmersive(next, { peekSceneDock: true });
      }
    },
    [natureSettings.videos, activeVideoId, selectVideoAndImmersive],
  );

  const onBlankClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      if (suppressBlankTapRef.current) {
        suppressBlankTapRef.current = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      onNatureVideoBlankClick();
    },
    [onNatureVideoBlankClick],
  );

  return (
    <div className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden bg-canvas text-white [color-scheme:dark]">
      <AppShellTopBar
        tone="onDark"
        landscapeImmersive={false}
        showTopInsetTime={landscapeImmersive}
        rightAccessory={
          <div className="flex flex-col items-end gap-2">
            {hasMainVideo ? (
              <button
                type="button"
                onClick={() => setShellAudioMuted(!shellAudioMuted)}
                aria-pressed={shellAudioMuted}
                aria-label={shellAudioMuted ? t("chrome.unmuteShellMusic") : t("chrome.muteShellMusic")}
                className={NATURE_BELL_BTN}
              >
                {shellAudioMuted ? (
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
                  className={NATURE_BELL_BTN}
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
            <HomeSleepTimerControl />
          </div>
        }
      />

      {hasMainVideo ? (
        <div className={NATURE_VIDEO_STAGE_FRAME} style={videoStageShellStyle}>
          <div
            className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-sky-300/25 via-teal-950/15 to-transparent"
            aria-hidden
          />
          <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden bg-canvas">
            {showNatureVideoDecoder ? (
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
                poster={hasStillIntro ? undefined : posterSrc?.trim() || undefined}
                muted
                playsInline
                loop
                autoPlay
                preload="metadata"
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
            ) : null}
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
                  posterOnlyLowPower || !introRevealed ? "opacity-100" : "opacity-0",
                ].join(" ")}
                style={{ maxWidth: "none" }}
                aria-hidden
              />
            ) : null}
          </div>
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
          {(showSlowIntroHint || showPlaybackWaitHint) && !posterOnlyLowPower ? (
            <p
              className="pointer-events-none absolute bottom-[max(5.25rem,calc(env(safe-area-inset-bottom,0px)+4.75rem))] left-3 right-3 z-[3] text-center text-[12px] leading-snug text-white/50 sm:left-6 sm:right-6 sm:text-[13px]"
              aria-live="polite"
            >
              {showSlowIntroHint && !introRevealed ? t("nature.slowVisualHint") : t("nature.playbackBufferingHint")}
            </p>
          ) : conservationHintKey ? (
            <p
              className="pointer-events-none absolute bottom-[max(5.25rem,calc(env(safe-area-inset-bottom,0px)+4.75rem))] left-3 right-3 z-[3] text-center text-[12px] leading-snug text-white/50 sm:left-6 sm:right-6 sm:text-[13px]"
              aria-live="polite"
            >
              {conservationHintKey === "lowBattery"
                ? t("nature.lowBatteryStillHint")
                : conservationHintKey === "saveData"
                  ? t("nature.saveDataStillHint")
                  : t("nature.lowMemoryStillHint")}
            </p>
          ) : null}
          <button
            type="button"
            className="absolute inset-0 z-[7] cursor-default touch-pan-y border-0 bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
            aria-expanded={dockChromeVisible}
            aria-label={t("nature.toggleDockChrome")}
            onPointerDown={onBlankPointerDown}
            onPointerUp={onBlankPointerUp}
            onClick={onBlankClick}
          />
          <p className="sr-only">{t("nature.videoBgAnnounced")}</p>
          <div className="pointer-events-none absolute inset-x-0 top-[38.2%] z-[12] flex -translate-y-1/2 justify-center px-5 sm:px-6 [@media(max-height:500px)_and_(orientation:portrait)]:top-[32%]">
            <div className="w-full max-w-lg sm:max-w-xl landscape:max-w-[min(92vw,50rem)] md:landscape:max-w-[min(86vw,56rem)]">
              <HomeVerseRotator
                variant="dark"
                prominence="nature"
                className="w-full min-h-[6.5rem] sm:min-h-[7.5rem] landscape:min-h-0 [@media(max-height:500px)_and_(orientation:portrait)]:min-h-[4rem] [@media(max-height:500px)_and_(orientation:portrait)]:sm:min-h-[4.25rem]"
              />
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[14] flex max-h-[min(48dvh,58svh)] min-h-0 flex-col justify-end px-4 pb-[max(4.75rem,calc(env(safe-area-inset-bottom,0px)+4.25rem))] pt-1 sm:px-6 sm:pb-[max(5rem,calc(env(safe-area-inset-bottom,0px)+4.5rem))] md:px-8 xl:px-10">
            <div
              className={[
                "mx-auto w-full min-h-0 max-w-lg px-3 pb-1 pt-2 sm:max-w-xl sm:px-4 sm:pb-2 sm:pt-2.5 md:max-w-3xl lg:max-w-none lg:px-5",
                dockChromeVisible ? "pointer-events-auto" : "pointer-events-none",
              ].join(" ")}
            >
              <DockChromeCollapse>
                <NatureSceneLayer
                  className="mt-0 shrink-0 sm:mt-0.5 [@media(max-height:500px)]:mt-0 [@media(max-height:500px)]:sm:mt-0.5"
                  settings={natureSettings}
                  activeVideoId={playbackSettings.activeVideoId}
                  prepareSceneId={null}
                  prepareProgress={null}
                  onSceneCardPress={onSceneCardPress}
                />
              </DockChromeCollapse>
            </div>
          </div>
          <HomeShellFloatingRouteNav placement="videoStage" />
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
              className="absolute inset-0 z-0 cursor-default touch-pan-y border-0 bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
              aria-expanded={dockChromeVisible}
              aria-label={t("nature.toggleDockChrome")}
              onPointerDown={onBlankPointerDown}
              onPointerUp={onBlankPointerUp}
              onClick={onBlankClick}
            />
            <div className="relative z-10 flex min-h-0 flex-1 flex-col pointer-events-none">
              <div className="mx-auto mt-6 max-w-sm rounded-3xl bg-white/[0.14] px-5 py-6 text-center ring-1 ring-white/[0.22] backdrop-blur-2xl sm:mt-8">
                <p className="text-[15px] font-medium leading-snug text-white/90 sm:text-[16px]">{t("nature.emptyTitle")}</p>
                <p className="mt-3 text-[12px] leading-relaxed text-white/55 sm:text-[13px]">{t("nature.emptyHint")}</p>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[14] flex max-h-[min(40dvh,50svh)] min-h-0 flex-col justify-end px-4 pb-[max(4.75rem,calc(env(safe-area-inset-bottom,0px)+4.25rem))] sm:px-6 sm:pb-[max(5rem,calc(env(safe-area-inset-bottom,0px)+4.5rem))] md:px-8 xl:px-10">
              <div
                className={[
                  "mx-auto w-full min-h-0 max-w-lg px-3 pb-1 pt-2 sm:max-w-xl sm:px-4 sm:pb-2 sm:pt-2.5 md:max-w-3xl lg:max-w-none lg:px-5",
                  dockChromeVisible ? "pointer-events-auto" : "pointer-events-none",
                ].join(" ")}
              >
                <DockChromeCollapse>
                  <NatureSceneLayer
                    className="mt-0 shrink-0 sm:mt-0.5 [@media(max-height:500px)]:mt-0 [@media(max-height:500px)]:sm:mt-0.5"
                    settings={natureSettings}
                    activeVideoId={playbackSettings.activeVideoId}
                    prepareSceneId={null}
                    prepareProgress={null}
                    onSceneCardPress={onSceneCardPress}
                  />
                </DockChromeCollapse>
              </div>
            </div>
          </div>
          <HomeShellFloatingRouteNav placement="videoStage" />
        </div>
      )}
    </div>
  );
}
