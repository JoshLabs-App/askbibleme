"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLandscapeNarrow } from "@/hooks/useLandscapeNarrow";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { AppShellTopBar } from "@/components/app-shell/AppShellTopBar";
import { NatureHomeSettingsControl } from "@/components/nature/NatureHomeSettingsControl";
import { useHomePrayerVerseFeedContext } from "@/components/home/HomePrayerVerseFeedContext";
import { HomeVerseRotator } from "@/components/home/HomeVerseRotator";
import type { NatureSettingsV2 } from "@/lib/nature/types";
import { resolveNaturePlayback } from "@/lib/nature/resolve-nature-playback";
import { useNatureMediaPolicy } from "@/hooks/useNatureMediaPolicy";
import {
  NATURE_HOME_ROOT_THEME,
  NATURE_HOME_THEME_LOCK_DATASET_KEY,
  NATURE_HOME_THEME_LOCK_VALUE,
} from "@/lib/nature/root-theme";
import {
  mergeNatureVisualPrefs,
  readNatureVisualLevels,
  writeNatureVisualLevels,
  type NatureVisualLevel,
} from "@/lib/nature/nature-visual-level-prefs";
import {
  NATURE_HOME_TEXT_SCALE_DEFAULT_STEP_INDEX,
  NATURE_HOME_TEXT_SCALE_STEPS,
  natureHomeTextScaleAtStep,
  readNatureHomeTextScaleStepIndex,
} from "@/lib/home/nature-home-text-scale-prefs";
import {
  NATURE_HOME_VERSE_APPEARANCE_UPDATED_EVENT,
  readNatureHomeVerseAppearance,
} from "@/lib/home/nature-home-verse-appearance-prefs";
import { NATURE_HOME_VERSE_FADE_MS } from "@/components/home/home-verse-constants";
import { setNatureHomeVerseTimingOverride } from "@/lib/home/nature-home-verse-timing-override";
import { readAppShellScrollContentBoxClientHeight } from "@/lib/shell/home-dock-nav-bg";
import {
  defaultNatureHomeActiveVideoId,
  resolveNatureHomeActiveVideoId,
  writeNatureHomeActiveSceneId,
} from "@/lib/home/nature-home-active-scene-prefs";
import { exitFullscreenCompat, requestFullscreenCompat } from "@/lib/dom/fullscreen";
import { isIosLikeUserAgent } from "@/lib/dom/ios";
import {
  NATURE_HOME_PORTRAIT_PAN_DELAY_SEC,
  NATURE_HOME_PORTRAIT_PAN_DURATION_SEC,
} from "@/lib/nature/nature-home-portrait-pan";
import "@/components/nature/nature-home-portrait-pan.css";
import {
  fetchNatureSettingsIfStale,
  markNatureSettingsRevisionSynced,
  natureSettingsStaleOnVisible,
} from "@/lib/nature/sync-nature-settings-client";
import { isPrefetchableNatureVideoSrc } from "@/lib/nature/is-prefetchable-nature-video-src";
import { canNatureHomeFullVideoFetch } from "@/lib/nature/can-nature-home-full-video-fetch";
import { useNatureHomeFullVideoFetch } from "@/hooks/useNatureHomeFullVideoFetch";
import { NatureVideoLoadProgress } from "@/components/nature/NatureVideoLoadProgress";
import { useShellBackgroundVideoCoordination } from "@/hooks/useShellBackgroundVideoCoordination";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { HomeShellFloatingRouteNav } from "@/components/home/HomeShellFloatingRouteNav";
import { NatureHomeBottomBand } from "@/components/nature/NatureHomeBottomBand";
import { NatureHomeAmbientSlotAudio } from "@/components/nature/NatureHomeAmbientSlotAudio";
import {
  readNatureHomeAmbientSceneSlotId,
  writeNatureHomeAmbientSceneSlotId,
} from "@/lib/home/nature-home-ambient-scene-prefs";
import {
  readNatureHomeLoopAllScenesEnabled,
  writeNatureHomeLoopAllScenesEnabled,
} from "@/lib/home/nature-home-loop-all-scenes-prefs";
import { SCENE_LOOP_SWITCH_MS } from "@/lib/nature/home-scene-strip-metrics";
import type { NatureAmbientSceneSlotId } from "@/lib/nature/ambient-scene-slots";

/**
 * 停留后再挂 `<video>` 解码（非「切换」时刻）。
 * 有首图时：揭晓 = 本延迟 + {@link INTRO_REVEAL_MIN_DELAY_MS} + 整段缓冲完成；弱网多停静图。
 */
const NATURE_SCENE_DWELL_MS = 3000;

/** 无滚动：先整体 `scale`；仍超出带区时再收紧行数（`line-clamp`）并二次压缩 */
const NATURE_VERSE_FIT_COMPRESS_MIN = 0.06;


type Props = {
  initial: NatureSettingsV2;
  /** 与 RSC 嵌入的 settings 指纹一致时可跳过首屏重复拉取 */
  settingsRevision: string;
  /** 电视壳：导航链到 `/tv/*` */
  shellRoot?: string;
};

/** 背景视频槽：与滚动区 `canvas` 对齐；底栏用 `appDark`，与主区背景色系一致衔接 */
const NATURE_VIDEO_STAGE_FRAME =
  "relative z-[1] w-full shrink-0 overflow-hidden bg-canvas transform-gpu min-h-[12rem]";

/** 与背景 `<video>` 同定位；竖屏平移见 `nature-home-portrait-pan.css` */
const NATURE_BG_COVER_MEDIA =
  "nature-bg-cover-media absolute top-1/2 h-full min-h-full w-full min-w-full object-cover";

/** 有首图时：至少停留静图此时长，且视频完全载入后，才淡出静图露出 `<video>` */
const INTRO_REVEAL_MIN_DELAY_MS = 5000;

/** 流式揭晓：整段循环影片已缓冲就绪 */
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
 * 自然：有首图时进页显静图、后台 fetch 整段 MP4，下完再挂 `<video>` 并淡出静图；否则约 3s 起流式缓冲揭晓。
 */
export function NatureVideoExperience({ initial, settingsRevision, shellRoot = "" }: Props) {
  const { t } = useLocale();
  const { canPlayMusic, playing, togglePlayMusic } = useMusicShellPlayback();
  const { activeIndex, bilingual, homeVerseVisible } = useHomePrayerVerseFeedContext();
  const videoRef = useRef<HTMLVideoElement>(null);
  const introRevealGuardRef = useRef(false);
  /** 本会话内 `<video poster>` 是否仍用 HTML poster（首场景揭晓后不再重复挂） */
  const introSessionRevealedRef = useRef(false);
  const introStillLoadStartedAtRef = useRef(0);
  const playbackWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 与量高逻辑配合：忽略 ±12px 内抖动，减轻 iOS 周期性闪屏 */
  const videoStageHeightCommitRef = useRef(0);

  const [natureBgSoftFocus, setNatureBgSoftFocus] = useState(false);
  const [homeSettingsOpen, setHomeSettingsOpen] = useState(false);
  const [dimLevel, setDimLevel] = useState<NatureVisualLevel>(0);
  const [blurLevel, setBlurLevel] = useState<NatureVisualLevel>(0);
  const [softFocusCommittedOpacity, setSoftFocusCommittedOpacity] = useState(0);
  const [softFocusCommittedBlur, setSoftFocusCommittedBlur] = useState(0);
  const [softFocusDraftOpacity, setSoftFocusDraftOpacity] = useState(0);
  const [softFocusDraftBlur, setSoftFocusDraftBlur] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [textScaleStepIndex, setTextScaleStepIndex] = useState(NATURE_HOME_TEXT_SCALE_DEFAULT_STEP_INDEX);
  const [natureVerseAppearance, setNatureVerseAppearance] = useState(() => readNatureHomeVerseAppearance());
  const [videoBroken, setVideoBroken] = useState(false);
  /** 主壳滚动区可视高度（px），与底栏 flex 分配同源，避免 `100dvh` 与实高偏差 */
  const [videoStageHeightPx, setVideoStageHeightPx] = useState(0);
  const [dwellVideoAllowed, setDwellVideoAllowed] = useState(false);
  const [dwellPolicyResolved, setDwellPolicyResolved] = useState(false);
  const [natureSettings, setNatureSettings] = useState<NatureSettingsV2>(initial);
  const [activeVideoId, setActiveVideoId] = useState(() => defaultNatureHomeActiveVideoId(initial));
  const [loopAllScenesEnabled, setLoopAllScenesEnabled] = useState(false);
  const [activeAmbientSlotId, setActiveAmbientSlotId] = useState<NatureAmbientSceneSlotId | "">("");
  const ambientPrefsHydratedRef = useRef(false);
  const loopAllPrefsHydratedRef = useRef(false);
  const activeSceneHydratedRef = useRef(false);
  const landscapeNarrow = useLandscapeNarrow();
  /** 用户用右上按钮进入整页全屏时保留，避免与「竖屏 / 换源」自动退出逻辑冲突 */
  const natureHomeUserDocFullscreenRef = useRef(false);
  const [docElementFullscreen, setDocElementFullscreen] = useState(false);
  useEffect(() => {
    setNatureHomeVerseTimingOverride({ fadeMs: NATURE_HOME_VERSE_FADE_MS });
    return () => setNatureHomeVerseTimingOverride(null);
  }, []);
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

  useLayoutEffect(() => {
    if (ambientPrefsHydratedRef.current) return;
    ambientPrefsHydratedRef.current = true;
    const stored = readNatureHomeAmbientSceneSlotId()?.trim() ?? "";
    if (stored) setActiveAmbientSlotId(stored as NatureAmbientSceneSlotId);
  }, []);

  useLayoutEffect(() => {
    if (loopAllPrefsHydratedRef.current) return;
    loopAllPrefsHydratedRef.current = true;
    setLoopAllScenesEnabled(readNatureHomeLoopAllScenesEnabled());
  }, []);

  useEffect(() => {
    markNatureSettingsRevisionSynced(settingsRevision);
    let cancelled = false;

    const apply = (data: NatureSettingsV2) => {
      setNatureSettings(data);
      setActiveVideoId((prev) => {
        const ids = new Set(data.videos.map((v) => v.id.trim()).filter(Boolean));
        const p = prev.trim();
        if (p && ids.has(p)) return prev;
        return resolveNatureHomeActiveVideoId(data);
      });
    };

    void (async () => {
      const data = await fetchNatureSettingsIfStale(settingsRevision);
      if (cancelled || !data) return;
      apply(data);
    })();

    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (!natureSettingsStaleOnVisible()) return;
      void (async () => {
        const data = await fetchNatureSettingsIfStale(settingsRevision, { force: true });
        if (cancelled || !data) return;
        apply(data);
      })();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [settingsRevision]);

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
  const sceneEntries = playbackSettings.videos;

  const ambientClipById = useMemo(
    () => new Map((natureSettings.ambientClips ?? []).map((clip) => [clip.id, clip])),
    [natureSettings.ambientClips],
  );

  useEffect(() => {
    if (!activeAmbientSlotId) return;
    if (ambientClipById.has(activeAmbientSlotId)) return;
    setActiveAmbientSlotId("");
    writeNatureHomeAmbientSceneSlotId("");
  }, [activeAmbientSlotId, ambientClipById]);

  const activeAmbientSrc = activeAmbientSlotId
    ? ambientClipById.get(activeAmbientSlotId)?.src.trim() ?? ""
    : "";

  const selectScene = useCallback(
    (id: string, opts?: { keepLoopMode?: boolean }) => {
      const next = id.trim();
      if (!next) return;
      if (!opts?.keepLoopMode) {
        setLoopAllScenesEnabled(false);
        writeNatureHomeLoopAllScenesEnabled(false);
      }
      setActiveVideoId((prev) => {
        if (prev === next) return prev;
        writeNatureHomeActiveSceneId(next);
        return next;
      });
    },
    [],
  );

  const onSelectLoopAll = useCallback(() => {
    setLoopAllScenesEnabled(true);
    writeNatureHomeLoopAllScenesEnabled(true);
    if (!activeVideoId.trim() && sceneEntries.length > 0) {
      const firstId = sceneEntries[0]?.id;
      if (firstId) selectScene(firstId, { keepLoopMode: true });
    }
  }, [activeVideoId, sceneEntries, selectScene]);

  const onToggleAmbientSlot = useCallback((slotId: NatureAmbientSceneSlotId) => {
    setActiveAmbientSlotId((prev) => {
      const next = prev === slotId ? "" : slotId;
      writeNatureHomeAmbientSceneSlotId(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!loopAllScenesEnabled) return;
    if (sceneEntries.length < 2) return;
    const timer = window.setInterval(() => {
      const idx = sceneEntries.findIndex((v) => v.id === activeVideoId);
      const nextIdx = idx >= 0 ? (idx + 1) % sceneEntries.length : 0;
      const nextId = sceneEntries[nextIdx]?.id;
      if (!nextId) return;
      selectScene(nextId, { keepLoopMode: true });
    }, SCENE_LOOP_SWITCH_MS);
    return () => window.clearInterval(timer);
  }, [loopAllScenesEnabled, activeVideoId, sceneEntries, selectScene]);

  const activeNatureRow = useMemo(() => {
    const s = playbackSettings;
    if (!s.videos.length) return undefined;
    const want = s.activeVideoId.trim();
    return (want ? s.videos.find((v) => v.id === want) : undefined) ?? s.videos[0];
  }, [playbackSettings]);

  const { videoSrc, posterSrc, previewStillSrc } = useMemo(
    () => resolveNaturePlayback(playbackSettings),
    [playbackSettings],
  );
  const stillImageUrl = (posterSrc?.trim() || previewStillSrc?.trim() || "").trim();
  const posterUrl = stillImageUrl;
  const hasStillIntro = posterUrl.length > 0;
  /** 仅场景 id 变化时重置流式策略；切换场景不再因海报 URL 重播静图 */
  const sceneIntroKey = activeNatureRow?.id?.trim() ?? "";
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
  const { blockVideoDecoder, onVideoPlaying, shellAudioBlocksVideo } = useShellBackgroundVideoCoordination(
    videoRef,
    {
      enabled: hasConfiguredVideoSrc && !videoBroken,
      surfaceId: "nature-home",
    },
  );

  useEffect(() => {
    if (!hasNatureVisual) {
      setNatureBgSoftFocus(false);
      setHomeSettingsOpen(false);
    }
  }, [hasNatureVisual]);
  /** 低电量：仅静图，不挂载解码 `<video>` */
  const posterOnlyLowPower = mediaPolicy.lowBatteryStatic && hasStillIntro;

  const wantsFullVideoFetch =
    hasStillIntro && hasConfiguredVideoSrc && !posterOnlyLowPower && !videoBroken;
  const fullFetchEligible = wantsFullVideoFetch && canNatureHomeFullVideoFetch(videoSrc, mediaPolicy);
  const {
    objectUrl: fullFetchObjectUrl,
    ready: fullFetchReady,
    failed: fullFetchFailed,
    progress: fullFetchProgress,
    loading: fullFetchLoading,
  } = useNatureHomeFullVideoFetch({
    enabled: fullFetchEligible,
    videoSrc,
    sceneKey: sceneIntroKey,
  });
  /** 有首图且整段 fetch 成功：静图 → 下完再挂 video；否则走 dwell + 流式缓冲 */
  const useFullVideoIntro = fullFetchEligible && !fullFetchFailed;
  const introUsesStreaming = hasStillIntro && !useFullVideoIntro;
  const showFullFetchProgress =
    useFullVideoIntro && fullFetchLoading && !fullFetchReady && hasStillIntro && !posterOnlyLowPower;

  const showNatureVideoDecoder =
    hasPlayableVideo &&
    !posterOnlyLowPower &&
    !blockVideoDecoder &&
    (useFullVideoIntro ? fullFetchReady && Boolean(fullFetchObjectUrl) : dwellVideoAllowed);

  const playbackVideoSrc =
    useFullVideoIntro && fullFetchObjectUrl ? fullFetchObjectUrl : videoSrc;

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

    if (useFullVideoIntro) {
      setDwellVideoAllowed(false);
      setDwellPolicyResolved(true);
      return;
    }

    const id = window.setTimeout(() => {
      setDwellPolicyResolved(true);
      setDwellVideoAllowed(!mediaPolicy.lowBatteryStatic);
    }, NATURE_SCENE_DWELL_MS);

    return () => window.clearTimeout(id);
  }, [
    activeVideoId,
    hasConfiguredVideoSrc,
    posterOnlyLowPower,
    mediaPolicy.lowBatteryStatic,
    useFullVideoIntro,
  ]);

  const conservationHintKey = useMemo(() => {
    if (!hasConfiguredVideoSrc || videoBroken || showNatureVideoDecoder) return null;
    if (!dwellPolicyResolved) return null;
    if (mediaPolicy.lowBatteryStatic) return "lowBattery" as const;
    return null;
  }, [
    hasConfiguredVideoSrc,
    videoBroken,
    showNatureVideoDecoder,
    mediaPolicy.lowBatteryStatic,
    dwellPolicyResolved,
  ]);

  const rate = natureSettings.playbackRate;

  const [introRevealed, setIntroRevealed] = useState(!hasStillIntro);
  const lastBufferRevealPollRef = useRef(0);
  const [showSlowIntroHint, setShowSlowIntroHint] = useState(false);
  const [showPlaybackWaitHint, setShowPlaybackWaitHint] = useState(false);

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
    introSessionRevealedRef.current = true;
    if (reduce) {
      setIntroRevealed(true);
    } else {
      requestAnimationFrame(() => setIntroRevealed(true));
    }
  }, [posterUrl, posterOnlyLowPower]);

  const maybeRevealIntroFromBuffer = useCallback(() => {
    if (!posterUrl || posterOnlyLowPower) return;
    if (introRevealGuardRef.current) return;
    if (useFullVideoIntro) {
      if (!fullFetchReady) return;
      commitIntroReveal();
      return;
    }
    if (performance.now() - introStillLoadStartedAtRef.current < INTRO_REVEAL_MIN_DELAY_MS) return;
    const v = videoRef.current;
    if (!v) return;
    if (!isNatureVideoFullyLoaded(v)) return;
    commitIntroReveal();
  }, [
    posterUrl,
    posterOnlyLowPower,
    commitIntroReveal,
    useFullVideoIntro,
    fullFetchReady,
  ]);

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
    setIntroRevealed(!hasStillIntro);
  }, [sceneIntroKey, hasStillIntro, clearPlaybackWaitHint]);

  useEffect(() => {
    if (!introUsesStreaming || !posterUrl || posterOnlyLowPower || !dwellVideoAllowed) return;
    introStillLoadStartedAtRef.current = performance.now();
    const id = window.setTimeout(() => {
      maybeRevealIntroFromBuffer();
    }, INTRO_REVEAL_MIN_DELAY_MS);
    return () => clearTimeout(id);
  }, [
    sceneIntroKey,
    introUsesStreaming,
    posterUrl,
    posterOnlyLowPower,
    dwellVideoAllowed,
    maybeRevealIntroFromBuffer,
  ]);

  useEffect(() => {
    if (!useFullVideoIntro || !fullFetchReady || introRevealed || !posterUrl || posterOnlyLowPower) return;
    maybeRevealIntroFromBuffer();
  }, [
    useFullVideoIntro,
    fullFetchReady,
    introRevealed,
    posterUrl,
    posterOnlyLowPower,
    sceneIntroKey,
    maybeRevealIntroFromBuffer,
  ]);

  useEffect(() => {
    if (!hasStillIntro || introRevealed || !posterUrl || posterOnlyLowPower) {
      setShowSlowIntroHint(false);
      return;
    }
    const stillWaiting = useFullVideoIntro ? fullFetchLoading && !fullFetchReady : !dwellVideoAllowed;
    if (!stillWaiting) {
      setShowSlowIntroHint(false);
      return;
    }
    const id = window.setTimeout(() => setShowSlowIntroHint(true), SLOW_INTRO_HINT_DELAY_MS);
    return () => {
      clearTimeout(id);
      setShowSlowIntroHint(false);
    };
  }, [
    hasStillIntro,
    introRevealed,
    posterUrl,
    posterOnlyLowPower,
    useFullVideoIntro,
    fullFetchReady,
    fullFetchLoading,
    dwellVideoAllowed,
  ]);

  useEffect(() => {
    return () => clearPlaybackWaitHint();
  }, [clearPlaybackWaitHint]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !playbackVideoSrc || videoBroken || posterOnlyLowPower) return;
    el.muted = true;
    try {
      el.playbackRate = rate;
    } catch {
      /* ignore */
    }
  }, [rate, playbackVideoSrc, videoBroken, posterOnlyLowPower]);

  /** 首屏起预拉当前成片（整段 fetch 路径不用，避免重复拉流） */
  useEffect(() => {
    if (useFullVideoIntro) return;
    if (!hasConfiguredVideoSrc || !videoSrc.trim() || posterOnlyLowPower) return;
    if (!isPrefetchableNatureVideoSrc(videoSrc)) return;
    if (isIosLikeUserAgent()) return;
    if (mediaPolicy.saveData) return;
    if (mediaPolicy.lowBatteryStatic) return;
    if (
      typeof mediaPolicy.deviceMemoryGb === "number" &&
      mediaPolicy.deviceMemoryGb > 0 &&
      mediaPolicy.deviceMemoryGb <= 4
    ) {
      return;
    }
    let abs: string;
    try {
      abs = new URL(videoSrc, window.location.origin).href;
    } catch {
      return;
    }
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "video";
    link.href = abs;
    document.head.appendChild(link);
    return () => {
      try {
        link.remove();
      } catch {
        /* ignore */
      }
    };
  }, [
    sceneIntroKey,
    videoSrc,
    hasConfiguredVideoSrc,
    posterOnlyLowPower,
    mediaPolicy.saveData,
    mediaPolicy.lowBatteryStatic,
    mediaPolicy.deviceMemoryGb,
    useFullVideoIntro,
  ]);

  /** 流式路径：解码器挂载后 preload=auto */
  useEffect(() => {
    if (useFullVideoIntro) return;
    if (!showNatureVideoDecoder) return;
    if (isIosLikeUserAgent()) return;
    if (!mediaPolicy.documentVisible) return;
    if (mediaPolicy.lowBatteryStatic) return;
    if (mediaPolicy.saveData) return;
    if (
      typeof mediaPolicy.deviceMemoryGb === "number" &&
      mediaPolicy.deviceMemoryGb > 0 &&
      mediaPolicy.deviceMemoryGb <= 4
    ) {
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
    showNatureVideoDecoder,
    useFullVideoIntro,
  ]);

  /** 后台标签：暂停解码；前台且解码器已挂则静音播放 */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !playbackVideoSrc.trim() || videoBroken || posterOnlyLowPower) return;
    if (!showNatureVideoDecoder) return;
    if (!mediaPolicy.documentVisible) {
      v.pause();
      return;
    }
    void v.play().catch(() => {});
  }, [
    mediaPolicy.documentVisible,
    playbackVideoSrc,
    videoBroken,
    posterOnlyLowPower,
    showNatureVideoDecoder,
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
    const levels = readNatureVisualLevels();
    const prefs = mergeNatureVisualPrefs(levels.dimLevel, levels.blurLevel);
    setDimLevel(levels.dimLevel);
    setBlurLevel(levels.blurLevel);
    setSoftFocusCommittedOpacity(prefs.overlayOpacity);
    setSoftFocusCommittedBlur(prefs.blurPx);
    setSoftFocusDraftOpacity(prefs.overlayOpacity);
    setSoftFocusDraftBlur(prefs.blurPx);
    setNatureBgSoftFocus(levels.dimLevel > 0 || levels.blurLevel > 0);
  }, []);

  useLayoutEffect(() => {
    setTextScaleStepIndex(readNatureHomeTextScaleStepIndex());
  }, []);

  useEffect(() => {
    const syncAppearance = () => setNatureVerseAppearance(readNatureHomeVerseAppearance());
    window.addEventListener(NATURE_HOME_VERSE_APPEARANCE_UPDATED_EVENT, syncAppearance);
    return () => window.removeEventListener(NATURE_HOME_VERSE_APPEARANCE_UPDATED_EVENT, syncAppearance);
  }, []);


  const applyVisualLevels = useCallback((nextDim: NatureVisualLevel, nextBlur: NatureVisualLevel) => {
    const prefs = mergeNatureVisualPrefs(nextDim, nextBlur);
    writeNatureVisualLevels({ dimLevel: nextDim, blurLevel: nextBlur });
    setDimLevel(nextDim);
    setBlurLevel(nextBlur);
    setSoftFocusCommittedOpacity(prefs.overlayOpacity);
    setSoftFocusCommittedBlur(prefs.blurPx);
    setSoftFocusDraftOpacity(prefs.overlayOpacity);
    setSoftFocusDraftBlur(prefs.blurPx);
    setNatureBgSoftFocus(nextDim > 0 || nextBlur > 0);
  }, []);

  const onHomeSettingsOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setSoftFocusDraftOpacity(softFocusCommittedOpacity);
        setSoftFocusDraftBlur(softFocusCommittedBlur);
      } else {
        setSoftFocusDraftOpacity(softFocusCommittedOpacity);
        setSoftFocusDraftBlur(softFocusCommittedBlur);
      }
      setHomeSettingsOpen(open);
    },
    [softFocusCommittedOpacity, softFocusCommittedBlur],
  );

  const softFocusLayerVisible = natureBgSoftFocus || homeSettingsOpen;
  const softFocusDisplayOpacity = homeSettingsOpen ? softFocusDraftOpacity : softFocusCommittedOpacity;
  const softFocusDisplayBlur = homeSettingsOpen ? softFocusDraftBlur : softFocusCommittedBlur;

  const effectiveNatureSoftFocusBlurPx = prefersReducedMotion
    ? Math.min(softFocusDisplayBlur, 10)
    : softFocusDisplayBlur;

  /** 视频空白：收起设置面板；否则切换背景音乐播放 */
  const onNatureVideoBlankClick = useCallback(() => {
    if (homeSettingsOpen) {
      onHomeSettingsOpenChange(false);
      return;
    }
    if (canPlayMusic) void togglePlayMusic();
  }, [homeSettingsOpen, onHomeSettingsOpenChange, canPlayMusic, togglePlayMusic]);

  const verseTextZoom = natureHomeTextScaleAtStep(textScaleStepIndex);

  const onNatureHomePrefsChanged = useCallback(() => {
    setTextScaleStepIndex(readNatureHomeTextScaleStepIndex());
    setNatureVerseAppearance(readNatureHomeVerseAppearance());
  }, []);

  const renderBottomBand = () => {
    if (sceneEntries.length === 0) return null;
    return (
      <NatureHomeBottomBand
        settings={natureSettings}
        scenes={sceneEntries}
        activeVideoId={activeVideoId}
        loopAllScenesEnabled={loopAllScenesEnabled}
        activeAmbientSlotId={activeAmbientSlotId}
        onSelectScene={(id) => selectScene(id)}
        onSelectLoopAll={onSelectLoopAll}
        onToggleAmbientSlot={onToggleAmbientSlot}
      />
    );
  };

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
        hideTopShellInsetTime={!landscapeImmersive}
        rightAccessory={
          <NatureHomeSettingsControl
            open={homeSettingsOpen}
            onOpenChange={onHomeSettingsOpenChange}
            hasNatureVisual={hasNatureVisual}
            dimLevel={dimLevel}
            blurLevel={blurLevel}
            onDimLevelChange={(level) => applyVisualLevels(level, blurLevel)}
            onBlurLevelChange={(level) => applyVisualLevels(dimLevel, level)}
            onPrefsChanged={onNatureHomePrefsChanged}
          />
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
                key={`${activeNatureRow?.id ?? videoSrc}`}
                className={[
                  NATURE_BG_COVER_MEDIA,
                  "z-[1] border-0 outline-none",
                  "transition-opacity duration-700 ease-out motion-reduce:transition-none",
                  introRevealed ? "opacity-100" : "opacity-0",
                ].join(" ")}
                style={{ maxWidth: "none" }}
                src={playbackVideoSrc}
                poster={hasStillIntro && !introSessionRevealedRef.current ? undefined : posterSrc?.trim() || undefined}
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
                  onVideoPlaying();
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
                onError={() => {
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
                  posterOnlyLowPower ||
                  shellAudioBlocksVideo ||
                  !introRevealed ||
                  !showNatureVideoDecoder
                    ? "opacity-100"
                    : "opacity-0",
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
          ) : showFullFetchProgress ? (
            <NatureVideoLoadProgress
              progress={fullFetchProgress}
              label={t("nature.downloadProgressHint")}
            />
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
            className={[
              "pointer-events-none absolute inset-x-0 top-[38.2%] z-[12]",
              "flex max-h-[min(52dvh,calc(100%-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-11rem))]",
              "-translate-y-1/2 flex-col items-center justify-center overflow-hidden px-5 sm:px-6",
              "[@media(max-height:500px)_and_(orientation:portrait)]:top-[32%]",
              "landscape:max-h-[min(44dvh,calc(100%-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-9.5rem))]",
            ].join(" ")}
          >
            <div
              className="mx-auto flex min-w-0 max-w-full justify-center"
              style={{
                transform: `scale(${natureVerseFitCompress})`,
                transformOrigin: "center center",
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
          {renderBottomBand()}
          <HomeShellFloatingRouteNav placement="videoStage" shellRoot={shellRoot} />
          <NatureHomeAmbientSlotAudio
            slotId={activeAmbientSlotId}
            src={activeAmbientSrc}
            playbackRate={rate}
          />
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
          {renderBottomBand()}
          <HomeShellFloatingRouteNav placement="videoStage" shellRoot={shellRoot} />
          <NatureHomeAmbientSlotAudio
            slotId={activeAmbientSlotId}
            src={activeAmbientSrc}
            playbackRate={rate}
          />
        </div>
      )}
    </div>
  );
}
