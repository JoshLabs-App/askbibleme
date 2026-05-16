"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLandscapeNarrow } from "@/hooks/useLandscapeNarrow";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { AppShellTopBar } from "@/components/app-shell/AppShellTopBar";
import { HomeSleepTimerControl } from "@/components/home/HomeSleepTimerControl";
import { useHomePrayerVerseFeedContext } from "@/components/home/HomePrayerVerseFeedContext";
import { HomeVerseRotator } from "@/components/home/HomeVerseRotator";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import type { NatureSettingsV2 } from "@/lib/nature/types";
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
import { shouldStartNatureVideoAt720 } from "@/lib/nature/nature-video-start-quality";
import {
  readNatureBackground1080Pref,
  writeNatureBackground1080Pref,
} from "@/lib/nature/nature-video-quality-prefs";
import {
  NATURE_HOME_TEXT_SCALE_DEFAULT_STEP_INDEX,
  NATURE_HOME_TEXT_SCALE_STEPS,
  natureHomeTextScaleAtStep,
  readNatureHomeTextScaleStepIndex,
  writeNatureHomeTextScaleStepIndex,
} from "@/lib/home/nature-home-text-scale-prefs";
import {
  NATURE_HOME_VERSE_APPEARANCE_UPDATED_EVENT,
  readNatureHomeVerseAppearance,
} from "@/lib/home/nature-home-verse-appearance-prefs";
import { readAppShellScrollContentBoxClientHeight } from "@/lib/shell/home-dock-nav-bg";
import { defaultNatureHomeActiveVideoId, resolveNatureHomeActiveVideoId } from "@/lib/home/nature-home-active-scene-prefs";
import { HomeShellFloatingRouteNav } from "@/components/home/HomeShellFloatingRouteNav";
import { NatureHomeVerseAppearancePanel } from "@/components/nature/NatureHomeVerseAppearancePanel";
import { exitFullscreenCompat, requestFullscreenCompat } from "@/lib/dom/fullscreen";
import { isIosLikeUserAgent } from "@/lib/dom/ios";
import {
  NATURE_HOME_PORTRAIT_PAN_DELAY_SEC,
  NATURE_HOME_PORTRAIT_PAN_DURATION_SEC,
} from "@/lib/nature/nature-home-portrait-pan";
import "@/components/nature/nature-home-portrait-pan.css";

/** 当前场景停留后再挂视频解码（毫秒） */
const NATURE_SCENE_DWELL_MS = 3000;

/** 无滚动：先整体 `scale`；仍超出带区时再收紧行数（`line-clamp`）并二次压缩 */
const NATURE_VERSE_FIT_COMPRESS_MIN = 0.06;

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

function IconNatureEnterFullscreen(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconNatureExitFullscreen(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 右上 Aa：自然首页经文外观（独立存储，与金句专页无关） */
function IconVerseTypography(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={props.className} aria-hidden>
      <text
        x="3.25"
        y="16.75"
        fill="currentColor"
        fontSize="14"
        fontWeight="700"
        fontFamily='ui-serif, Georgia, "Times New Roman", serif'
      >
        A
      </text>
      <text
        x="12.75"
        y="16.75"
        fill="currentColor"
        fontSize="11"
        fontWeight="600"
        fontFamily='system-ui, ui-sans-serif, sans-serif'
      >
        a
      </text>
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

/** 与背景 `<video>` 同定位；竖屏平移见 `nature-home-portrait-pan.css` */
const NATURE_BG_COVER_MEDIA =
  "nature-bg-cover-media absolute top-1/2 h-full min-h-full w-full min-w-full object-cover";

/** 有首图时：至少停留静图此时长，且视频完全载入后，才淡出静图露出 `<video>` */
const INTRO_REVEAL_MIN_DELAY_MS = 5000;

/** 播放中 rebuffer 判定用：当前时间点之后需缓冲够长（秒） */
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

/** 揭晓静图前：整段循环影片已缓冲就绪（非「够播几秒」） */
function isNatureVideoFullyLoaded(v: HTMLVideoElement): boolean {
  if (v.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) return false;
  const dur = v.duration;
  if (!Number.isFinite(dur) || dur <= 0) return false;
  try {
    const ranges = v.buffered;
    if (ranges.length === 0) return false;
    return ranges.end(ranges.length - 1) >= dur - 0.2;
  } catch {
    return false;
  }
}

/** 静图阶段：超过揭晓最短等待后再提示加载慢 */
const SLOW_INTRO_HINT_DELAY_MS = INTRO_REVEAL_MIN_DELAY_MS + 2500;
/** 播放中 rebuffer 稍候再提示，避免闪一下 */
const PLAYBACK_WAIT_HINT_DELAY_MS = 2800;
/**
 * 自然：背景视频铺满主列；场景在「场景」页选择；停留约 3s 且内存/省流等许可后再挂 `<video>` 解码与渐显。
 */
export function NatureVideoExperience({ initial }: Props) {
  const { t } = useLocale();
  const { activeIndex, bilingual, homeVerseVisible } = useHomePrayerVerseFeedContext();
  const videoRef = useRef<HTMLVideoElement>(null);
  const introRevealGuardRef = useRef(false);
  const introStillLoadStartedAtRef = useRef(0);
  const playbackWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 与量高逻辑配合：忽略 ±12px 内抖动，减轻 iOS 周期性闪屏 */
  const videoStageHeightCommitRef = useRef(0);

  const { shellAudioMuted, setShellAudioMuted } = useMusicShellPlayback();
  const [natureBgSoftFocus, setNatureBgSoftFocus] = useState(false);
  const [natureSoftFocusPanelOpen, setNatureSoftFocusPanelOpen] = useState(false);
  const [verseAppearancePanelOpen, setVerseAppearancePanelOpen] = useState(false);
  const [softFocusCommittedOpacity, setSoftFocusCommittedOpacity] = useState(
    NATURE_SOFT_FOCUS_DEFAULTS.overlayOpacity,
  );
  const [softFocusCommittedBlur, setSoftFocusCommittedBlur] = useState(NATURE_SOFT_FOCUS_DEFAULTS.blurPx);
  const [softFocusDraftOpacity, setSoftFocusDraftOpacity] = useState(NATURE_SOFT_FOCUS_DEFAULTS.overlayOpacity);
  const [softFocusDraftBlur, setSoftFocusDraftBlur] = useState(NATURE_SOFT_FOCUS_DEFAULTS.blurPx);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [textScaleStepIndex, setTextScaleStepIndex] = useState(NATURE_HOME_TEXT_SCALE_DEFAULT_STEP_INDEX);
  const [natureVerseAppearance, setNatureVerseAppearance] = useState(() => readNatureHomeVerseAppearance());
  const [videoBroken, setVideoBroken] = useState(false);
  const [preferNature1080, setPreferNature1080] = useState(true);
  /** 本会话内因卡顿从 1080 退回 720（换场景后重试 1080，除非弱网首帧策略） */
  const [adaptiveNature720, setAdaptiveNature720] = useState(false);
  /** 主壳滚动区可视高度（px），与底栏 flex 分配同源，避免 `100dvh` 与实高偏差 */
  const [videoStageHeightPx, setVideoStageHeightPx] = useState(0);
  const [dwellVideoAllowed, setDwellVideoAllowed] = useState(false);
  const [dwellPolicyResolved, setDwellPolicyResolved] = useState(false);
  const [natureSettings, setNatureSettings] = useState<NatureSettingsV2>(initial);
  const [activeVideoId, setActiveVideoId] = useState(() => defaultNatureHomeActiveVideoId(initial));
  const activeSceneHydratedRef = useRef(false);
  const landscapeNarrow = useLandscapeNarrow();
  /** 用户用右上按钮进入整页全屏时保留，避免与「竖屏 / 换源」自动退出逻辑冲突 */
  const natureHomeUserDocFullscreenRef = useRef(false);
  const [docElementFullscreen, setDocElementFullscreen] = useState(false);
  /** 避免 SSR（无 navigator）与客户端 iOS UA 不一致导致顶栏子树 hydration 错位 */
  const [iosUaResolved, setIosUaResolved] = useState(false);
  useEffect(() => {
    setIosUaResolved(true);
  }, []);
  const showNatureDocFullscreenBtn = !iosUaResolved || !isIosLikeUserAgent();
  const natureVerseFitBoxRef = useRef<HTMLDivElement>(null);
  const natureVerseFitMeasureRef = useRef<HTMLDivElement>(null);
  const [natureVerseFitCompress, setNatureVerseFitCompress] = useState(1);
  const [verseTightLineClamp, setVerseTightLineClamp] = useState(false);

  useEffect(() => {
    setNatureSettings(initial);
    setActiveVideoId(resolveNatureHomeActiveVideoId(initial));
  }, [initial]);

  useLayoutEffect(() => {
    if (activeSceneHydratedRef.current) return;
    activeSceneHydratedRef.current = true;
    setActiveVideoId(resolveNatureHomeActiveVideoId(natureSettings));
  }, [natureSettings]);

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
          return resolveNatureHomeActiveVideoId(data);
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

  const activeNatureRow = useMemo(() => {
    const s = playbackSettings;
    if (!s.videos.length) return undefined;
    const want = s.activeVideoId.trim();
    return (want ? s.videos.find((v) => v.id === want) : undefined) ?? s.videos[0];
  }, [playbackSettings]);

  const currentClipHas1080 = Boolean(activeNatureRow?.src1080?.trim());
  const effectivePreferNature1080 = preferNature1080 && !adaptiveNature720;

  const { videoSrc, posterSrc, previewStillSrc } = useMemo(
    () => resolveNaturePlayback(playbackSettings, { prefer1080: effectivePreferNature1080 }),
    [playbackSettings, effectivePreferNature1080],
  );
  const stillImageUrl = (posterSrc?.trim() || previewStillSrc?.trim() || "").trim();
  const posterUrl = stillImageUrl;
  const hasStillIntro = posterUrl.length > 0;
  /** 配置里是否有主片地址（与解码是否成功无关） */
  const hasConfiguredVideoSrc = Boolean(videoSrc.trim());
  /** 可挂载 `<video>` 且不处于解码错误态 */
  const hasPlayableVideo = hasConfiguredVideoSrc && !videoBroken;
  /**
   * 是否展示自然主舞台（含静图兜底）。勿用 `!videoBroken` 判断：解码失败时仍应有预览图，
   * 否则误落入「仍未配置背景影片」空态。
   */
  const hasNatureVisual = hasConfiguredVideoSrc || hasStillIntro;
  const mediaPolicy = useNatureMediaPolicy();

  useEffect(() => {
    if (!hasNatureVisual) {
      setNatureBgSoftFocus(false);
      setNatureSoftFocusPanelOpen(false);
    }
  }, [hasNatureVisual]);
  /** 低电量：仅静图，不挂载解码 `<video>` */
  const posterOnlyLowPower = mediaPolicy.lowBatteryStatic && hasStillIntro;
  const showNatureVideoDecoder = hasPlayableVideo && !posterOnlyLowPower && dwellVideoAllowed;

  useEffect(() => {
    setDwellVideoAllowed(false);
    setDwellPolicyResolved(false);

    if (!hasConfiguredVideoSrc) {
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
    hasConfiguredVideoSrc,
    posterOnlyLowPower,
    mediaPolicy.lowBatteryStatic,
    mediaPolicy.saveData,
    mediaPolicy.deviceMemoryGb,
  ]);

  const conservationHintKey = useMemo(() => {
    if (!hasConfiguredVideoSrc || videoBroken || showNatureVideoDecoder) return null;
    if (mediaPolicy.lowBatteryStatic) return "lowBattery" as const;
    if (!dwellPolicyResolved) return null;
    if (mediaPolicy.saveData) return "saveData" as const;
    const mem = mediaPolicy.deviceMemoryGb;
    if (mem !== undefined && mem < 3) return "lowMemory" as const;
    return null;
  }, [
    hasConfiguredVideoSrc,
    videoBroken,
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
    if (performance.now() - introStillLoadStartedAtRef.current < INTRO_REVEAL_MIN_DELAY_MS) return;
    const v = videoRef.current;
    if (!v || !isNatureVideoFullyLoaded(v)) return;
    commitIntroReveal();
  }, [posterUrl, posterOnlyLowPower, commitIntroReveal]);

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
    const sync = () => {
      setDocElementFullscreen(document.fullscreenElement === document.documentElement);
      if (document.fullscreenElement !== document.documentElement) {
        natureHomeUserDocFullscreenRef.current = false;
      }
    };
    document.addEventListener("fullscreenchange", sync);
    sync();
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    /** iOS / iPadOS：对 `documentElement` 自动全屏易导致系统退出、手势与误触（含底栏「首页」）；仅桌面系横屏窄窗使用。 */
    if (isIosLikeUserAgent()) {
      natureHomeUserDocFullscreenRef.current = false;
      if (document.fullscreenElement === document.documentElement) {
        void exitFullscreenCompat();
      }
      return;
    }
    if (!videoSrc.trim() || videoBroken) {
      natureHomeUserDocFullscreenRef.current = false;
      if (document.fullscreenElement === document.documentElement) {
        void exitFullscreenCompat();
      }
      return;
    }
    if (!landscapeNarrow) {
      if (
        document.fullscreenElement === document.documentElement &&
        !natureHomeUserDocFullscreenRef.current
      ) {
        void exitFullscreenCompat();
      }
      return;
    }
    void requestFullscreenCompat(document.documentElement).catch(() => {});
  }, [landscapeNarrow, videoSrc, videoBroken]);

  useEffect(() => {
    introRevealGuardRef.current = false;
    introStillLoadStartedAtRef.current = performance.now();
    lastBufferRevealPollRef.current = 0;
    setShowSlowIntroHint(false);
    clearPlaybackWaitHint();
    const p = (posterSrc?.trim() || previewStillSrc?.trim() || "").trim();
    setIntroRevealed(p.length === 0);
  }, [videoSrc, posterSrc, previewStillSrc, clearPlaybackWaitHint]);

  useEffect(() => {
    if (!hasStillIntro || !posterUrl || posterOnlyLowPower || !dwellVideoAllowed) return;
    introStillLoadStartedAtRef.current = performance.now();
    const id = window.setTimeout(() => {
      maybeRevealIntroFromBuffer();
    }, INTRO_REVEAL_MIN_DELAY_MS);
    return () => clearTimeout(id);
  }, [
    videoSrc,
    hasStillIntro,
    posterUrl,
    posterOnlyLowPower,
    dwellVideoAllowed,
    maybeRevealIntroFromBuffer,
  ]);

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

  useEffect(() => {
    setAdaptiveNature720(shouldStartNatureVideoAt720(mediaPolicy));
  }, [activeVideoId, mediaPolicy.saveData]);

  const considerAdaptiveDowngradeTo720 = useCallback(() => {
    if (!currentClipHas1080 || !preferNature1080 || adaptiveNature720) return;
    const v = videoRef.current;
    if (!v) return;
    if (hasEnoughBufferedAhead(v, bufferAheadThreshold)) return;
    setAdaptiveNature720(true);
  }, [
    currentClipHas1080,
    preferNature1080,
    adaptiveNature720,
    bufferAheadThreshold,
  ]);

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
    setSoftFocusCommittedOpacity(p.overlayOpacity);
    setSoftFocusCommittedBlur(p.blurPx);
    setSoftFocusDraftOpacity(p.overlayOpacity);
    setSoftFocusDraftBlur(p.blurPx);
  }, []);

  useLayoutEffect(() => {
    setTextScaleStepIndex(readNatureHomeTextScaleStepIndex());
    setPreferNature1080(readNatureBackground1080Pref());
  }, []);

  useEffect(() => {
    const syncAppearance = () => setNatureVerseAppearance(readNatureHomeVerseAppearance());
    window.addEventListener(NATURE_HOME_VERSE_APPEARANCE_UPDATED_EVENT, syncAppearance);
    return () => window.removeEventListener(NATURE_HOME_VERSE_APPEARANCE_UPDATED_EVENT, syncAppearance);
  }, []);


  /** 关闭 / 取消：收起面板并关闭柔焦叠层（不写入当前滑条值） */
  const dismissNatureSoftFocusPanel = useCallback(() => {
    setNatureSoftFocusPanelOpen(false);
    setNatureBgSoftFocus(false);
  }, []);

  const confirmNatureSoftFocusPanel = useCallback(() => {
    writeNatureSoftFocusPrefs({ overlayOpacity: softFocusDraftOpacity, blurPx: softFocusDraftBlur });
    setSoftFocusCommittedOpacity(softFocusDraftOpacity);
    setSoftFocusCommittedBlur(softFocusDraftBlur);
    setNatureBgSoftFocus(true);
    setNatureSoftFocusPanelOpen(false);
  }, [softFocusDraftOpacity, softFocusDraftBlur]);

  const openNatureSoftFocusPanel = useCallback(() => {
    setSoftFocusDraftOpacity(softFocusCommittedOpacity);
    setSoftFocusDraftBlur(softFocusCommittedBlur);
    setVerseAppearancePanelOpen(false);
    setNatureSoftFocusPanelOpen(true);
  }, [softFocusCommittedOpacity, softFocusCommittedBlur]);

  const onNatureSoftFocusIconClick = useCallback(() => {
    if (natureSoftFocusPanelOpen) {
      dismissNatureSoftFocusPanel();
      return;
    }
    openNatureSoftFocusPanel();
  }, [natureSoftFocusPanelOpen, dismissNatureSoftFocusPanel, openNatureSoftFocusPanel]);

  const onVerseAppearanceIconClick = useCallback(() => {
    setVerseAppearancePanelOpen((wasOpen) => {
      const next = !wasOpen;
      if (next) setNatureSoftFocusPanelOpen(false);
      return next;
    });
  }, []);

  const onToggleNature1080 = useCallback(() => {
    if (!effectivePreferNature1080 && preferNature1080) {
      setAdaptiveNature720(false);
      setVideoBroken(false);
      return;
    }
    setPreferNature1080((p) => {
      const next = !p;
      writeNatureBackground1080Pref(next);
      if (next) setAdaptiveNature720(false);
      return next;
    });
    setVideoBroken(false);
  }, [effectivePreferNature1080, preferNature1080]);

  const softFocusLayerVisible = natureBgSoftFocus || natureSoftFocusPanelOpen;
  const softFocusDisplayOpacity = natureSoftFocusPanelOpen ? softFocusDraftOpacity : softFocusCommittedOpacity;
  const softFocusDisplayBlur = natureSoftFocusPanelOpen ? softFocusDraftBlur : softFocusCommittedBlur;

  const effectiveNatureSoftFocusBlurPx = prefersReducedMotion
    ? Math.min(softFocusDisplayBlur, 10)
    : softFocusDisplayBlur;

  const natureSoftFocusTriggerAria = natureSoftFocusPanelOpen
    ? t("nature.bgSoftFocusCloseAria")
    : natureBgSoftFocus
      ? t("nature.bgSoftFocusOpenPanelAria")
      : t("nature.bgSoftFocusStartAria");

  /** 视频空白：收起柔焦或经文外观浮层（无浮层时无操作） */
  const onNatureVideoBlankClick = useCallback(() => {
    if (natureSoftFocusPanelOpen) {
      dismissNatureSoftFocusPanel();
      return;
    }
    if (verseAppearancePanelOpen) {
      setVerseAppearancePanelOpen(false);
    }
  }, [natureSoftFocusPanelOpen, verseAppearancePanelOpen, dismissNatureSoftFocusPanel]);

  const verseTextZoom = natureHomeTextScaleAtStep(textScaleStepIndex);
  const textScaleMin = textScaleStepIndex <= 0;
  const textScaleMax = textScaleStepIndex >= NATURE_HOME_TEXT_SCALE_STEPS.length - 1;

  const bumpTextScaleStep = useCallback((delta: 1 | -1) => {
    setTextScaleStepIndex((prev) => {
      const next = Math.min(NATURE_HOME_TEXT_SCALE_STEPS.length - 1, Math.max(0, prev + delta));
      writeNatureHomeTextScaleStepIndex(next);
      return next;
    });
  }, []);

  const onNatureHomeFullscreenClick = useCallback(() => {
    if (typeof document === "undefined" || isIosLikeUserAgent()) return;
    if (document.fullscreenElement === document.documentElement) {
      natureHomeUserDocFullscreenRef.current = false;
      void exitFullscreenCompat();
      return;
    }
    natureHomeUserDocFullscreenRef.current = true;
    void requestFullscreenCompat(document.documentElement).catch(() => {
      natureHomeUserDocFullscreenRef.current = false;
    });
  }, []);

  useLayoutEffect(() => {
    if (!hasNatureVisual) return;
    const box = natureVerseFitBoxRef.current;
    const inner = natureVerseFitMeasureRef.current;
    if (!box || !inner) return;

    const applyFit = () => {
      const bw = box.clientWidth;
      const bh = box.clientHeight;

      setVerseTightLineClamp(false);
      setNatureVerseFitCompress(1);
      void inner.offsetWidth;
      let r = inner.getBoundingClientRect();
      if (!(bw >= 8 && bh >= 8 && r.width >= 0.5 && r.height >= 0.5)) return;

      let raw = Math.min(bw / r.width, bh / r.height);
      const needsClamp = raw < 0.998;
      if (needsClamp) {
        setVerseTightLineClamp(true);
        void inner.offsetWidth;
        r = inner.getBoundingClientRect();
        raw = Math.min(bw / r.width, bh / r.height);
      }

      const next = Math.min(1, Math.max(NATURE_VERSE_FIT_COMPRESS_MIN, Number.isFinite(raw) ? raw : 1));
      setNatureVerseFitCompress((prev) => (Math.abs(prev - next) < 0.004 ? prev : next));
    };

    applyFit();
    const ro = new ResizeObserver(() => applyFit());
    ro.observe(box);
    return () => ro.disconnect();
  }, [
    hasNatureVisual,
    bilingual,
    homeVerseVisible,
    verseTextZoom,
    activeIndex,
    natureVerseAppearance.fontFamily,
    natureVerseAppearance.textEffect,
  ]);

  return (
    <div className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden bg-canvas text-white [color-scheme:dark]">
      <AppShellTopBar
        tone="onDark"
        landscapeImmersive={false}
        showTopInsetTime={false}
        hideTopShellInsetTime
        rightAccessory={
          <div className="flex flex-col items-end gap-2">
            {hasNatureVisual ? (
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
            {hasNatureVisual ? (
              <div className="relative isolate">
                {natureSoftFocusPanelOpen ? (
                  <div
                    id="nature-soft-focus-panel"
                    role="region"
                    aria-label={t("nature.bgSoftFocusPanelTitle")}
                    className="pointer-events-auto absolute right-full top-0 z-[60] mr-2 max-h-[min(72dvh,calc(100svh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-5rem))] w-[min(13.75rem,calc(100vw-5rem))] overflow-y-auto overscroll-y-contain rounded-2xl border border-white/18 bg-black/55 px-3 py-2.5 text-left shadow-[0_8px_36px_-8px_rgba(0,0,0,0.5)] backdrop-blur-xl [-webkit-overflow-scrolling:touch]"
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
                      value={softFocusDraftOpacity}
                      className="mb-2.5 mt-1 w-full accent-white"
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        setSoftFocusDraftOpacity(v);
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
                      value={softFocusDraftBlur}
                      className="mt-1 w-full accent-white"
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        const b = Math.round(v);
                        setSoftFocusDraftBlur(b);
                      }}
                    />
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        className="min-h-[40px] flex-1 rounded-lg border border-white/25 bg-white/12 px-2 py-2 text-center text-[12px] font-medium text-white/95 transition hover:bg-white/18"
                        onClick={confirmNatureSoftFocusPanel}
                      >
                        {t("nature.bgSoftFocusConfirm")}
                      </button>
                      <button
                        type="button"
                        className="min-h-[40px] flex-1 rounded-lg border border-white/18 bg-transparent px-2 py-2 text-center text-[12px] font-medium text-white/75 transition hover:bg-white/[0.07] hover:text-white/90"
                        onClick={dismissNatureSoftFocusPanel}
                      >
                        {t("nature.bgSoftFocusCloseNoEffect")}
                      </button>
                    </div>
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
                      natureBgSoftFocus || natureSoftFocusPanelOpen
                        ? "h-[1.25rem] w-[1.25rem] text-white [filter:drop-shadow(0_0_6px_rgba(255,255,255,0.95))_drop-shadow(0_0_18px_rgba(200,225,255,0.55))]"
                        : "h-[1.25rem] w-[1.25rem] opacity-90"
                    }
                  />
                </button>
              </div>
            ) : null}
            {hasNatureVisual && currentClipHas1080 ? (
              <button
                type="button"
                onClick={onToggleNature1080}
                aria-pressed={effectivePreferNature1080}
                aria-label={t("nature.bg1080ToggleAria")}
                className={NATURE_BELL_BTN}
              >
                <span
                  className={
                    effectivePreferNature1080
                      ? "text-[10px] font-semibold tabular-nums leading-none tracking-tight text-white [filter:drop-shadow(0_0_4px_rgba(255,255,255,0.65))]"
                      : "text-[10px] font-medium tabular-nums leading-none tracking-tight text-white/60"
                  }
                >
                  1080
                </span>
              </button>
            ) : null}
            <div className="relative isolate">
              {verseAppearancePanelOpen ? (
                <div
                  id="nature-verse-appearance-panel"
                  role="region"
                  aria-label={t("nature.homeVerse.typographyMenu")}
                  className="pointer-events-auto absolute right-full top-0 z-[60] mr-2 max-h-[min(72dvh,calc(100svh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-5rem))] w-[min(13.75rem,calc(100vw-5rem))] overflow-y-auto overscroll-y-contain rounded-2xl border border-white/18 bg-black/55 px-3 py-2.5 text-left shadow-[0_8px_36px_-8px_rgba(0,0,0,0.5)] backdrop-blur-xl [-webkit-overflow-scrolling:touch]"
                >
                  <NatureHomeVerseAppearancePanel
                    natureVerseTextScale={{
                      atMin: textScaleMin,
                      atMax: textScaleMax,
                      onSmaller: () => bumpTextScaleStep(-1),
                      onLarger: () => bumpTextScaleStep(1),
                    }}
                  />
                </div>
              ) : null}
              <button
                type="button"
                onClick={onVerseAppearanceIconClick}
                aria-expanded={verseAppearancePanelOpen}
                aria-controls={verseAppearancePanelOpen ? "nature-verse-appearance-panel" : undefined}
                aria-label={t("nature.toggleVerseAppearanceAria")}
                className={NATURE_BELL_BTN}
              >
                <IconVerseTypography
                  className={
                    verseAppearancePanelOpen
                      ? "h-[1.35rem] w-[1.35rem] text-white [filter:drop-shadow(0_0_4px_rgba(255,255,255,0.75))]"
                      : "h-[1.35rem] w-[1.35rem] opacity-90"
                  }
                />
              </button>
            </div>
            {showNatureDocFullscreenBtn ? (
              <button
                type="button"
                onClick={onNatureHomeFullscreenClick}
                aria-pressed={docElementFullscreen}
                aria-label={
                  docElementFullscreen ? t("nature.fullscreenExitAria") : t("nature.fullscreenEnterAria")
                }
                className={NATURE_BELL_BTN}
              >
                {docElementFullscreen ? (
                  <IconNatureExitFullscreen className="h-[1.25rem] w-[1.25rem] opacity-90" />
                ) : (
                  <IconNatureEnterFullscreen className="h-[1.25rem] w-[1.25rem] opacity-90" />
                )}
              </button>
            ) : null}
            <HomeSleepTimerControl />
          </div>
        }
      />

      {hasNatureVisual ? (
        <div className={NATURE_VIDEO_STAGE_FRAME} style={videoStageShellStyle}>
          <div
            className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-sky-300/25 via-teal-950/15 to-transparent"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 z-[1] overflow-hidden bg-canvas"
            style={
              {
                "--nature-home-portrait-pan-delay": `${NATURE_HOME_PORTRAIT_PAN_DELAY_SEC}s`,
                "--nature-home-portrait-pan-duration": `${NATURE_HOME_PORTRAIT_PAN_DURATION_SEC}s`,
              } as CSSProperties
            }
          >
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
                onCanPlayThrough={maybeRevealIntroFromBuffer}
                onLoadedData={maybeRevealIntroFromBuffer}
                onProgress={maybeRevealIntroFromBuffer}
                onPlaying={() => {
                  clearPlaybackWaitHint();
                  maybeRevealIntroFromBuffer();
                }}
                onTimeUpdate={onTimeUpdatePollIntroReveal}
                onWaiting={() => {
                  considerAdaptiveDowngradeTo720();
                  if (introRevealed) schedulePlaybackWaitHint();
                }}
                onStalled={() => {
                  considerAdaptiveDowngradeTo720();
                  if (introRevealed) schedulePlaybackWaitHint();
                }}
                onError={() => {
                  if (currentClipHas1080 && preferNature1080 && !adaptiveNature720) {
                    setAdaptiveNature720(true);
                    return;
                  }
                  setVideoBroken(true);
                }}
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
                  posterOnlyLowPower || !introRevealed || !showNatureVideoDecoder ? "opacity-100" : "opacity-0",
                ].join(" ")}
                style={{ maxWidth: "none" }}
                aria-hidden
              />
            ) : null}
          </div>
          {softFocusLayerVisible ? (
            <div
              className="pointer-events-none absolute inset-0 z-[8]"
              style={
                {
                  backgroundColor: `rgba(0,0,0,${softFocusDisplayOpacity})`,
                  backdropFilter: `blur(${effectiveNatureSoftFocusBlurPx}px)`,
                  WebkitBackdropFilter: `blur(${effectiveNatureSoftFocusBlurPx}px)`,
                } satisfies CSSProperties
              }
              aria-hidden
            />
          ) : null}
          {videoBroken && hasConfiguredVideoSrc ? (
            <p
              className="pointer-events-none absolute bottom-[max(5.25rem,calc(env(safe-area-inset-bottom,0px)+4.75rem))] left-3 right-3 z-[3] text-center text-[12px] leading-snug text-amber-100/80 sm:left-6 sm:right-6 sm:text-[13px]"
              role="status"
              aria-live="polite"
            >
              {t("nature.videoDecodeErrorShort")}
            </p>
          ) : (showSlowIntroHint || showPlaybackWaitHint) && !posterOnlyLowPower ? (
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
            aria-label={t("nature.homeBackdropTapAria")}
            onClick={onNatureVideoBlankClick}
          />
          <p className="sr-only">{t("nature.videoBgAnnounced")}</p>
          <div
            ref={natureVerseFitBoxRef}
            className="pointer-events-none absolute inset-x-0 bottom-[max(5.25rem,calc(env(safe-area-inset-bottom,0px)+4.75rem))] z-[12] flex min-h-0 flex-col items-center justify-start overflow-hidden px-5 sm:px-6 top-[max(4.25rem,38.2%)] [@media(max-height:500px)_and_(orientation:portrait)]:top-[max(4rem,32%)] landscape:bottom-[max(4.75rem,calc(env(safe-area-inset-bottom,0px)+4.25rem))] landscape:top-[max(3.5rem,min(38.2%,30svh))]"
          >
            <div
              className="mx-auto flex min-w-0 max-w-full justify-center"
              style={{
                transform: `scale(${natureVerseFitCompress})`,
                transformOrigin: "center top",
              }}
            >
              <div
                ref={natureVerseFitMeasureRef}
                className="mx-auto min-w-0 overflow-x-clip"
                style={
                  {
                    zoom: verseTextZoom,
                    maxWidth: `min(80vw, ${80 / verseTextZoom}vw)`,
                  } satisfies CSSProperties
                }
              >
                <HomeVerseRotator
                  variant="dark"
                  prominence="nature"
                  natureHomeFontFamily={natureVerseAppearance.fontFamily}
                  natureHomeTextEffect={natureVerseAppearance.textEffect}
                  natureTightLineClamp={verseTightLineClamp}
                  className="w-full min-h-[6.5rem] sm:min-h-[7.5rem] landscape:min-h-0 [@media(max-height:500px)_and_(orientation:portrait)]:min-h-[4rem] [@media(max-height:500px)_and_(orientation:portrait)]:sm:min-h-[4.25rem]"
                />
              </div>
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
              aria-label={t("nature.homeBackdropTapAria")}
              onClick={onNatureVideoBlankClick}
            />
            <div className="relative z-10 flex min-h-0 flex-1 flex-col pointer-events-none">
              <div className="mx-auto mt-6 max-w-sm rounded-3xl bg-white/[0.14] px-5 py-6 text-center ring-1 ring-white/[0.22] backdrop-blur-2xl sm:mt-8">
                <p className="text-[15px] font-medium leading-snug text-white/90 sm:text-[16px]">{t("nature.emptyTitle")}</p>
                <p className="mt-3 text-[12px] leading-relaxed text-white/55 sm:text-[13px]">{t("nature.emptyHint")}</p>
              </div>
            </div>
          </div>
          <HomeShellFloatingRouteNav placement="videoStage" />
        </div>
      )}
    </div>
  );
}
