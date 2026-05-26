"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import type { MusicCompanionStore } from "@/lib/music-companion/types";
import { isIosLikeUserAgent } from "@/lib/dom/ios";
import { getShellDefaultAudioSrc, getShellSceneBoundAudioSrc, pickRandomShellAudioTrackSrc } from "@/lib/music-companion/shell-default-audio-src";
import {
  clearShellPlaybackPersisted,
  readScriptureAudioRepeatModePersisted,
  readShellPlaybackPersisted,
  shouldRestoreShellPlaybackSrc,
  shellPlaybackUrlsEqual,
  writeScriptureAudioRepeatModePersisted,
  writeShellPlaybackPersisted,
} from "@/lib/music-companion/shell-playback-storage";
import { getDeviceTrackBlob } from "@/lib/music/device-library-db";
import {
  clearDevicePlaybackPersisted,
  readDevicePlaybackPersisted,
  writeDevicePlaybackPersisted,
} from "@/lib/music/device-playback-storage";
import { useCuvChapterAudioVoice } from "@/components/bible/CuvChapterAudioVoiceContext";
import {
  resolveChapterAudioPlayableSrc,
  translationSupportsChapterAudio,
} from "@/lib/bible/read-chapter-audio";
import { translationUsesWebChapterAudio } from "@/lib/bible/web-chapter-audio";
import { voiceSupportsBook } from "@/lib/bible/cuv-chapter-audio-voices";
import {
  getNextScriptureChapter,
  getNextScriptureChapterInBook,
} from "@/lib/bible/next-scripture-chapter";
import { tryParseCuvChapterAudioEffectiveSrc, isCuvChapterAudioEffectiveSrc } from "@/lib/bible/parse-cuv-chapter-audio-src";
import type { ParsedCuvChapterAudioSrc } from "@/lib/bible/parse-cuv-chapter-audio-src";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import { indexInReadingPlanQueue } from "@/lib/read/reading-plan-chapter-queue";
import {
  readReadingPlanAudioSession,
  writeReadingPlanAudioSession,
} from "@/lib/read/reading-plan-audio-session";
import { prepareReadingPlanAudioSessionForChapter } from "@/lib/read/prepare-reading-plan-audio-session";

function audioUrlEquals(el: HTMLAudioElement, candidate: string): boolean {
  const c = candidate.trim();
  if (!c) return false;
  if (typeof window === "undefined") return (el.currentSrc || el.src) === c;
  try {
    const next = new URL(c, window.location.href).href;
    const curSrc = (el.currentSrc || "").trim();
    if (curSrc) {
      const cur = new URL(curSrc, window.location.href).href;
      if (cur === next) return true;
    }
    const prop = (el.src || "").trim();
    if (prop) {
      const curp = new URL(prop, window.location.href).href;
      if (curp === next) return true;
    }
    return false;
  } catch {
    return (el.currentSrc || el.src) === c;
  }
}

function isMusicShellPath(p: string): boolean {
  return p === "/music" || p.startsWith("/music/");
}

const READ_CHAPTER_PATH = /^\/read\/([A-Za-z0-9]{2,8})\/(\d+)$/;

function parseReadChapterPath(p: string): { bookId: string; chapter: number } | null {
  const m = p.match(READ_CHAPTER_PATH);
  if (!m) return null;
  const bookId = m[1].toUpperCase();
  const chapter = Number(m[2]);
  if (!Number.isInteger(chapter) || chapter < 1) return null;
  const meta = scriptureBooks.find((b) => b.bookId === bookId);
  if (!meta || chapter > meta.chapters) return null;
  return { bookId, chapter };
}

let defaultTranslationCatalogPromise: Promise<string | null> | null = null;

async function fetchDefaultTranslationIdCached(): Promise<string | null> {
  if (!defaultTranslationCatalogPromise) {
    defaultTranslationCatalogPromise = (async () => {
      try {
        const res = await fetch("/api/home/bible-translations-catalog", { cache: "default" });
        if (!res.ok) return null;
        const j = (await res.json()) as { defaultTranslationId?: unknown };
        const raw = j.defaultTranslationId;
        return typeof raw === "string" && raw.trim() ? raw.trim() : null;
      } catch {
        return null;
      }
    })();
  }
  return defaultTranslationCatalogPromise;
}

/** 和合本整章经朗读结束后的行为（仅对 CUV 章节 MP3 生效） */
export type ScriptureAudioRepeatMode = "off" | "chapter" | "book";

/** 全局定时停止：0 为关闭；墙钟到时暂停壳层音乐（不关屏、不锁机），并调用已注册的额外暂停（历史：自然混音等） */
export type MusicShellSleepTimerMinutes = 0 | 30 | 60 | 120;

export type DeviceLibraryPlaybackInfo = {
  trackId: string;
  /** 导入曲库可跨页恢复；仅本次打开的本地文件不写入恢复存储 */
  persistResume: boolean;
};

export type MusicShellPlaybackValue = {
  /** 壳层曲库是否有可播音乐（与是否正在播经文无关） */
  canPlayMusic: boolean;
  canPlay: boolean;
  playing: boolean;
  loading: boolean;
  /** 读经章快捷栏：整章朗读 */
  togglePlayScripture: () => void;
  /** 底栏播放钮 / 首页：仅背景音乐 */
  togglePlayMusic: () => void;
  pausePlayback: () => void;
  /** 非空时表示正在播放本机导入/打开的音频（不入站方服务器） */
  deviceLibraryPlayback: DeviceLibraryPlaybackInfo | null;
  /** 用本地 Blob 接管壳层 `<audio>`；会撤销上一段本机播放的 object URL */
  attachDeviceLibraryFromBlob: (trackId: string, blob: Blob, opts: { persistResume: boolean }) => void;
  /** 停止本机播放并释放 object URL；不影响曲库默认源 */
  clearDeviceLibraryPlayback: () => void;
  /** 桌面 Chromium：可选文件夹批量导入 */
  canPickLocalAudioFolder: boolean;
  /** 当前实际播放地址（全屏页 override 或默认池内随机曲） */
  effectiveSrc: string;
  /** 壳层默认播放 URL（多曲时在池内随机；单曲为唯一一条） */
  shellDefaultSrc: string;
  /** 非空时覆盖默认播放源（全屏选曲或持久化恢复） */
  shellOverrideSrc: string | null;
  /** 全屏音乐页切曲时设置；与当前默认场景曲相同时传 null 清除 override */
  setPlaybackSrc: (src: string | null) => void;
  /** 再次请求 `/api/music/companion` 并更新壳层曲库 */
  refetchCompanionStore: () => Promise<{ ok: true } | { ok: false; status?: number; message?: string }>;
  currentSec: number;
  durationSec: number;
  seekRatio: (ratio: number) => void;
  /** 壳层曲库（曲目元数据等） */
  musicStore: MusicCompanionStore | null;
  /** 壳层唯一 `<audio>`，供音乐驱动视觉等扩展 */
  getAudioElement: () => HTMLAudioElement | null;
  sleepTimerMinutes: MusicShellSleepTimerMinutes;
  sleepTimerDeadlineAt: number | null;
  setSleepTimerMinutes: (minutes: MusicShellSleepTimerMinutes) => void;
  /** 定时到时在 `pausePlayback` 之后调用；用于自然页混音等其它 `<audio>` */
  registerSleepPauseHandler: (handler: () => void) => () => void;
  /** 壳层 `play()` 之前调用（电视：先短暂暂停背景视频） */
  registerBeforeShellPlayHandler: (handler: () => void | Promise<void>) => () => void;
  /** 壳层 `play()` 尝试之后调用（电视：恢复静音背景视频） */
  registerAfterShellPlayHandler: (handler: () => void | Promise<void>) => () => void;
  /** 壳层 `<audio>` 静音（首页顶栏铃铛）；不改变播放/暂停状态 */
  shellAudioMuted: boolean;
  setShellAudioMuted: (muted: boolean) => void;
  /** 整章经朗读：重复本章 / 重复本卷（离开该音源时自动复位为 off） */
  scriptureAudioRepeatMode: ScriptureAudioRepeatMode;
  setScriptureAudioRepeatMode: (mode: ScriptureAudioRepeatMode) => void;
};

const MusicShellPlaybackContext = createContext<MusicShellPlaybackValue | null>(null);

export function useMusicShellPlayback(): MusicShellPlaybackValue {
  const ctx = useContext(MusicShellPlaybackContext);
  if (!ctx) {
    throw new Error("useMusicShellPlayback must be used within MusicShellPlaybackProvider");
  }
  return ctx;
}

export function MusicShellPlaybackProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { voiceId: chapterAudioVoiceId, effectiveVoiceId } = useCuvChapterAudioVoice();
  const chapterAudioVoiceRef = useRef(chapterAudioVoiceId);
  useEffect(() => {
    chapterAudioVoiceRef.current = chapterAudioVoiceId;
  }, [chapterAudioVoiceId]);
  const [store, setStore] = useState<MusicCompanionStore | null>(null);
  const [loading, setLoading] = useState(true);
  /**
   * 自然首页 `/`、`/nature`：勿在曲库就绪后立刻把默认曲目绑进隐藏 `<audio>`（会 `load` 缓冲、吃内存），
   * 易与主屏 Web 上全屏视频争资源导致整页被系统回收。离开首页、恢复持久化播放、或用户点壳层播放后再绑。
   */
  const [shellAudioHomePrimed, setShellAudioHomePrimed] = useState(false);
  const [playbackOverride, setPlaybackOverride] = useState<string | null>(null);
  type DevicePlaybackCell = { trackId: string; objectUrl: string; persistResume: boolean };
  const [devicePlayback, setDevicePlaybackState] = useState<DevicePlaybackCell | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [sleepTimerMinutes, setSleepTimerMinutesState] = useState<MusicShellSleepTimerMinutes>(0); // 默认关闭
  const [sleepTimerDeadlineAt, setSleepTimerDeadlineAt] = useState<number | null>(null);
  const [shellAudioMuted, setShellAudioMutedState] = useState(false);
  const [scriptureAudioRepeatMode, setScriptureAudioRepeatModeState] = useState<ScriptureAudioRepeatMode>("off");
  const sleepTimerDeadlineRef = useRef<number | null>(null);
  const shellPlaybackHydratedRef = useRef(false);
  /** 非音乐路由异步恢复（本机曲优先）时防止并发重复跑 */
  const nonMusicHydrateLockRef = useRef(false);
  /** 避免 `currentSrc` 尚未就绪时反复 `load()` 触发 setState 风暴 */
  const lastBoundEffectiveSrcRef = useRef("");
  const shellPlaybackRestoreRef = useRef<{
    targetSrc: string;
    timeSec: number;
    tryPlay: boolean;
  } | null>(null);
  /** 音乐路由：同一 pathname 内避免 store 引用更新时重复随机 */
  const musicShellSessionKeyRef = useRef<string>("");
  /** 减轻「回前台就拉曲库」：全平台最短间隔（毫秒） */
  const companionFetchMinIntervalMs = 45_000;
  const companionLastFetchAtRef = useRef(0);
  /** 恢复完成前不写 localStorage，避免用 0 秒覆盖上次进度 */
  const shellPlaybackPersistEnabledRef = useRef(false);
  const shellPlaybackLastPersistAtRef = useRef(0);
  /** 曲目自然结束后切到下一首并自动播放（避免 `ended` 时 `paused` 导致仅绑 src 不 play） */
  const playAfterNextBindRef = useRef(false);
  const scriptureAudioRepeatRef = useRef<ScriptureAudioRepeatMode>("off");
  scriptureAudioRepeatRef.current = scriptureAudioRepeatMode;
  const sleepPauseHandlersRef = useRef(new Set<() => void>());
  const beforeShellPlayHandlersRef = useRef(new Set<() => void | Promise<void>>());
  const afterShellPlayHandlersRef = useRef(new Set<() => void | Promise<void>>());
  const playbackOverrideRef = useRef<string | null>(null);
  playbackOverrideRef.current = playbackOverride;
  const devicePlaybackRef = useRef<DevicePlaybackCell | null>(null);
  devicePlaybackRef.current = devicePlayback;

  const defaultSrc = useMemo(() => ((store ? getShellDefaultAudioSrc(store) : null) ?? "").trim(), [store]);
  const catalogEffectiveSrc = (playbackOverride?.trim() || defaultSrc).trim();
  const effectiveSrc = (devicePlayback?.objectUrl.trim() || catalogEffectiveSrc).trim();

  const storeRef = useRef(store);
  storeRef.current = store;
  const effectiveSrcRef = useRef(effectiveSrc);
  effectiveSrcRef.current = effectiveSrc;

  const clearDeviceLibraryPlayback = useCallback(() => {
    clearDevicePlaybackPersisted();
    setDevicePlaybackState((prev) => {
      if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl);
      return null;
    });
  }, []);

  const attachDeviceLibraryFromBlob = useCallback((trackId: string, blob: Blob, opts: { persistResume: boolean }) => {
    clearShellPlaybackPersisted();
    const objectUrl = URL.createObjectURL(blob);
    setDevicePlaybackState((prev) => {
      if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl);
      return { trackId, objectUrl, persistResume: opts.persistResume };
    });
    setPlaybackOverride(null);
    playAfterNextBindRef.current = true;
    setShellAudioHomePrimed(true);
  }, []);

  const setPlaybackSrc = useCallback(
    (src: string | null) => {
      setDevicePlaybackState((prev) => {
        if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl);
        return null;
      });
      clearDevicePlaybackPersisted();
      if (!src?.trim()) {
        setPlaybackOverride(null);
        return;
      }
      const next = src.trim();
      const def = defaultSrc;
      if (def && shellPlaybackUrlsEqual(next, def)) setPlaybackOverride(null);
      else setPlaybackOverride(next);
    },
    [defaultSrc],
  );

  const canPickLocalAudioFolder = useMemo(
    () => typeof window !== "undefined" && "showDirectoryPicker" in window,
    [],
  );

  const deviceLibraryPlayback = useMemo((): DeviceLibraryPlaybackInfo | null => {
    if (!devicePlayback) return null;
    return { trackId: devicePlayback.trackId, persistResume: devicePlayback.persistResume };
  }, [devicePlayback]);

  const refetchCompanionStore = useCallback(async () => {
    try {
      const res = await fetch("/api/music/companion", { cache: "default" });
      if (!res.ok) return { ok: false as const, status: res.status };
      const next = (await res.json()) as MusicCompanionStore | { error?: string };
      if ("error" in next && next.error) return { ok: false as const, message: String(next.error) };
      companionLastFetchAtRef.current = Date.now();
      setStore(next as MusicCompanionStore);
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : "fetch failed" };
    }
  }, []);

  const pausePlayback = useCallback(() => {
    const a = audioRef.current;
    if (a && !a.paused) a.pause();
    setPlaying(false);
  }, []);

  const setSleepTimerMinutes = useCallback((minutes: MusicShellSleepTimerMinutes) => {
    setSleepTimerMinutesState(minutes);
    if (minutes === 0) {
      sleepTimerDeadlineRef.current = null;
      setSleepTimerDeadlineAt(null);
      return;
    }
    const until = Date.now() + minutes * 60 * 1000;
    sleepTimerDeadlineRef.current = until;
    setSleepTimerDeadlineAt(until);
  }, []);

  const registerSleepPauseHandler = useCallback((handler: () => void) => {
    sleepPauseHandlersRef.current.add(handler);
    return () => {
      sleepPauseHandlersRef.current.delete(handler);
    };
  }, []);

  const registerBeforeShellPlayHandler = useCallback((handler: () => void | Promise<void>) => {
    beforeShellPlayHandlersRef.current.add(handler);
    return () => {
      beforeShellPlayHandlersRef.current.delete(handler);
    };
  }, []);

  const registerAfterShellPlayHandler = useCallback((handler: () => void | Promise<void>) => {
    afterShellPlayHandlersRef.current.add(handler);
    return () => {
      afterShellPlayHandlersRef.current.delete(handler);
    };
  }, []);

  const runBeforeShellPlayHandlers = useCallback(async () => {
    for (const fn of beforeShellPlayHandlersRef.current) {
      try {
        await fn();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const runAfterShellPlayHandlers = useCallback(async () => {
    for (const fn of afterShellPlayHandlersRef.current) {
      try {
        await fn();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const attemptShellPlay = useCallback(
    async (a: HTMLAudioElement) => {
      await runBeforeShellPlayHandlers();
      try {
        await a.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      } finally {
        await runAfterShellPlayHandlers();
      }
    },
    [runBeforeShellPlayHandlers, runAfterShellPlayHandlers],
  );

  const setShellAudioMuted = useCallback((muted: boolean) => {
    setShellAudioMutedState(muted);
    const a = audioRef.current;
    if (a) a.muted = muted;
  }, []);

  const setScriptureAudioRepeatMode = useCallback((mode: ScriptureAudioRepeatMode, opts?: { persist?: boolean }) => {
    setScriptureAudioRepeatModeState(mode);
    if (opts?.persist !== false) {
      writeScriptureAudioRepeatModePersisted(mode);
    }
  }, []);

  useEffect(() => {
    const persisted = readScriptureAudioRepeatModePersisted();
    setScriptureAudioRepeatModeState(persisted);
  }, []);

  useEffect(() => {
    if (!effectiveSrc.trim() || !isCuvChapterAudioEffectiveSrc(effectiveSrc)) {
      setScriptureAudioRepeatMode("off", { persist: false });
      return;
    }
    setScriptureAudioRepeatMode(readScriptureAudioRepeatModePersisted(), { persist: false });
  }, [effectiveSrc, setScriptureAudioRepeatMode]);

  useLayoutEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.muted = shellAudioMuted;
  }, [shellAudioMuted]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const d = sleepTimerDeadlineRef.current;
      if (d == null || Date.now() < d) return;
      sleepTimerDeadlineRef.current = null;
      setSleepTimerMinutesState(0);
      setSleepTimerDeadlineAt(null);
      pausePlayback();
      sleepPauseHandlersRef.current.forEach((fn) => {
        try {
          fn();
        } catch {
          /* ignore */
        }
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [pausePlayback]);

  useEffect(() => {
    const p = pathname;
    if (p !== "/" && p !== "/nature") {
      setShellAudioHomePrimed(true);
    }
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    let lastHiddenAt = 0;
    let idleId: number | undefined;
    let fallbackTimer: number | undefined;

    const load = async (reason: "initial" | "visible") => {
      if (reason === "visible") {
        const t = companionLastFetchAtRef.current;
        if (t > 0 && Date.now() - t < companionFetchMinIntervalMs) return;
        if (isIosLikeUserAgent() && lastHiddenAt > 0 && Date.now() - lastHiddenAt < 30_000) {
          return;
        }
      }
      try {
        const res = await fetch("/api/music/companion", { cache: "default" });
        if (!res.ok || cancelled) return;
        const next = (await res.json()) as MusicCompanionStore | { error?: string };
        if ("error" in next && next.error) return;
        if (!cancelled) {
          companionLastFetchAtRef.current = Date.now();
          setStore(next as MusicCompanionStore);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const kickInitial = () => {
      if (cancelled) return;
      void load("initial");
    };

    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(kickInitial, { timeout: 500 });
    } else {
      fallbackTimer = window.setTimeout(kickInitial, 0);
    }

    const onVis = () => {
      if (document.visibilityState === "hidden") {
        lastHiddenAt = Date.now();
        return;
      }
      if (document.visibilityState === "visible") {
        void load("visible");
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      if (idleId != null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (fallbackTimer != null) window.clearTimeout(fallbackTimer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    if (!playbackOverride) return;
    if (!defaultSrc) return;
    if (shellPlaybackUrlsEqual(playbackOverride, defaultSrc)) {
      setPlaybackOverride(null);
    }
  }, [defaultSrc, playbackOverride]);

  /** 首次拿到曲库后：从 localStorage 恢复（非 `/music`）；本机导入曲优先于曲库 URL；音乐页每次进入随机起播并清远程持久化 */
  useEffect(() => {
    if (loading || shellPlaybackHydratedRef.current) return;
    if (!store && typeof navigator !== "undefined" && navigator.onLine) return;
    if (isMusicShellPath(pathname)) return;
    if (nonMusicHydrateLockRef.current) return;
    nonMusicHydrateLockRef.current = true;

    let cancelled = false;

    void (async () => {
      try {
        const dp = readDevicePlaybackPersisted();
        if (dp && dp.trackId && !dp.trackId.startsWith("session:")) {
          const blob = await getDeviceTrackBlob(dp.trackId);
          if (cancelled) return;
          if (blob) {
            const objectUrl = URL.createObjectURL(blob);
            setDevicePlaybackState((prev) => {
              if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl);
              return { trackId: dp.trackId, objectUrl, persistResume: true };
            });
            setShellAudioHomePrimed(true);
            shellPlaybackRestoreRef.current = {
              targetSrc: objectUrl,
              timeSec: dp.timeSec,
              tryPlay: dp.wasPlaying,
            };
            shellPlaybackPersistEnabledRef.current = false;
            shellPlaybackHydratedRef.current = true;
            return;
          }
          clearDevicePlaybackPersisted();
        }
      } catch {
        if (!cancelled) clearDevicePlaybackPersisted();
      }

      if (cancelled) return;

      const persisted = readShellPlaybackPersisted();
      if (!persisted) {
        shellPlaybackPersistEnabledRef.current = true;
        shellPlaybackHydratedRef.current = true;
        return;
      }
      if (!shouldRestoreShellPlaybackSrc(store, persisted.src)) {
        clearShellPlaybackPersisted();
        shellPlaybackPersistEnabledRef.current = true;
        shellPlaybackHydratedRef.current = true;
        return;
      }

      setShellAudioHomePrimed(true);
      shellPlaybackPersistEnabledRef.current = false;
      shellPlaybackRestoreRef.current = {
        targetSrc: persisted.src.trim(),
        timeSec: persisted.timeSec,
        tryPlay: persisted.wasPlaying,
      };
      const def = store ? (getShellSceneBoundAudioSrc(store)?.trim() ?? "") : "";
      if (def && shellPlaybackUrlsEqual(persisted.src, def)) setPlaybackOverride(null);
      else setPlaybackOverride(persisted.src.trim());
      shellPlaybackHydratedRef.current = true;
    })().finally(() => {
      nonMusicHydrateLockRef.current = false;
    });

    return () => {
      cancelled = true;
    };
  }, [store, loading, pathname]);

  useEffect(() => {
    if (loading || !store) return;
    if (!isMusicShellPath(pathname)) {
      musicShellSessionKeyRef.current = "";
      return;
    }
    if (musicShellSessionKeyRef.current === pathname) return;
    musicShellSessionKeyRef.current = pathname;

    if (!shellPlaybackHydratedRef.current) {
      shellPlaybackHydratedRef.current = true;
    }

    clearShellPlaybackPersisted();
    clearDevicePlaybackPersisted();
    setDevicePlaybackState((prev) => {
      if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl);
      return null;
    });
    shellPlaybackRestoreRef.current = null;
    shellPlaybackPersistEnabledRef.current = true;
    setShellAudioHomePrimed(true);

    const url = pickRandomShellAudioTrackSrc(store, null);
    if (!url) return;

    const def = getShellSceneBoundAudioSrc(store)?.trim() ?? "";
    if (def && shellPlaybackUrlsEqual(url, def)) {
      setPlaybackOverride(null);
    } else {
      playAfterNextBindRef.current = true;
      setPlaybackOverride(url);
    }
  }, [pathname, store, loading]);

  /** 曲库加载失败等：无 store 时仍允许写入进度，避免持久化被永久关闭 */
  useEffect(() => {
    if (loading || store) return;
    shellPlaybackPersistEnabledRef.current = true;
  }, [loading, store]);

  /** 无可用音源时放弃恢复，避免持久化永远锁定 */
  useEffect(() => {
    if (!shellPlaybackRestoreRef.current || loading) return;
    if (!effectiveSrc.trim()) {
      shellPlaybackRestoreRef.current = null;
      shellPlaybackPersistEnabledRef.current = true;
    }
  }, [effectiveSrc, loading]);

  useLayoutEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.preload = "none";
    const isHomeNature = pathname === "/" || pathname === "/nature";
    const bindSrc =
      !effectiveSrc.trim() || !isHomeNature || shellAudioHomePrimed ? effectiveSrc.trim() : "";

    if (!bindSrc) {
      lastBoundEffectiveSrcRef.current = "";
      a.removeAttribute("src");
      a.load();
      a.muted = shellAudioMuted;
      setPlaying(false);
      setCurrentSec(0);
      setDurationSec(0);
      return;
    }
    if (audioUrlEquals(a, bindSrc)) {
      lastBoundEffectiveSrcRef.current = bindSrc;
      a.muted = shellAudioMuted;
      if (playAfterNextBindRef.current) {
        playAfterNextBindRef.current = false;
        void attemptShellPlay(a);
      }
      return;
    }
    if (shellPlaybackUrlsEqual(lastBoundEffectiveSrcRef.current, bindSrc)) {
      return;
    }
    lastBoundEffectiveSrcRef.current = bindSrc;
    const wasPlaying = !a.paused;
    const playAfterAdvance = playAfterNextBindRef.current;
    a.src = bindSrc;
    a.muted = shellAudioMuted;
    a.load();
    if (wasPlaying || playAfterAdvance) {
      playAfterNextBindRef.current = false;
      void attemptShellPlay(a);
    }
    /** 未在播时不要 `setPlaying(false)`：会制造无意义重渲染，曾与首页对齐 `effectiveSrc` 的 effect 形成更新风暴。 */
  }, [effectiveSrc, pathname, shellAudioHomePrimed, shellAudioMuted, attemptShellPlay]);

  /** 在对应 src 的 metadata 就绪后 seek，并可选自动续播 */
  useEffect(() => {
    const a = audioRef.current;
    const plan = shellPlaybackRestoreRef.current;
    if (loading || !a || !effectiveSrc.trim() || !plan) return;
    if (!shellPlaybackUrlsEqual(plan.targetSrc, effectiveSrc)) return;

    let cancelled = false;
    const applySeek = () => {
      if (cancelled || !shellPlaybackRestoreRef.current) return;
      if (!audioUrlEquals(a, effectiveSrc)) return;

      const dur = a.duration;
      let t = shellPlaybackRestoreRef.current.timeSec;
      if (Number.isFinite(dur) && dur > 0) {
        t = Math.min(Math.max(0, t), Math.max(0, dur - 0.25));
      } else {
        t = Math.max(0, t);
      }
      a.currentTime = t;
      const tryPlay = shellPlaybackRestoreRef.current.tryPlay;
      shellPlaybackRestoreRef.current = null;
      shellPlaybackPersistEnabledRef.current = true;
      if (tryPlay) {
        void attemptShellPlay(a);
      }
    };

    if (audioUrlEquals(a, effectiveSrc) && a.readyState >= HTMLMediaElement.HAVE_METADATA) {
      applySeek();
      return () => {
        cancelled = true;
      };
    }

    const onMeta = () => {
      if (cancelled || !audioUrlEquals(a, effectiveSrc)) return;
      applySeek();
    };
    a.addEventListener("loadedmetadata", onMeta);
    return () => {
      cancelled = true;
      a.removeEventListener("loadedmetadata", onMeta);
    };
  }, [effectiveSrc, loading, attemptShellPlay]);

  const persistShellPlayback = useCallback(() => {
    if (!shellPlaybackPersistEnabledRef.current || loading) return;
    const a = audioRef.current;
    if (!a) return;
    const dev = devicePlaybackRef.current;
    if (dev?.persistResume) {
      writeDevicePlaybackPersisted({
        v: 1,
        trackId: dev.trackId,
        timeSec: a.currentTime,
        wasPlaying: !a.paused,
      });
      shellPlaybackLastPersistAtRef.current = Date.now();
      return;
    }
    const src = effectiveSrc.trim();
    if (!src || src.startsWith("blob:")) return;
    writeShellPlaybackPersisted({
      v: 1,
      src,
      timeSec: a.currentTime,
      wasPlaying: !a.paused,
    });
    shellPlaybackLastPersistAtRef.current = Date.now();
  }, [effectiveSrc, loading]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const THROTTLE_MS = 2500;
    const maybePersist = () => {
      if (!shellPlaybackPersistEnabledRef.current) return;
      if (Date.now() - shellPlaybackLastPersistAtRef.current < THROTTLE_MS) return;
      persistShellPlayback();
    };
    const flushPersist = () => {
      if (!shellPlaybackPersistEnabledRef.current) return;
      persistShellPlayback();
    };
    a.addEventListener("timeupdate", maybePersist);
    a.addEventListener("pause", flushPersist);
    a.addEventListener("ended", flushPersist);
    const onVis = () => {
      if (document.visibilityState === "hidden") flushPersist();
    };
    window.addEventListener("pagehide", flushPersist);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      a.removeEventListener("timeupdate", maybePersist);
      a.removeEventListener("pause", flushPersist);
      a.removeEventListener("ended", flushPersist);
      window.removeEventListener("pagehide", flushPersist);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [persistShellPlayback]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    let rafId = 0;
    const onTime = () => {
      if (rafId !== 0) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const el = audioRef.current;
        if (el) setCurrentSec(el.currentTime);
      });
    };
    const onMeta = () => setDurationSec(Number.isFinite(a.duration) ? a.duration : 0);
    const onEnded = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnded);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    return () => {
      if (rafId !== 0) cancelAnimationFrame(rafId);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
    };
  }, []);

  /** 自动下一首 / 单轨循环（与曲库 `audioTracks` 顺序一致，末首后回到第一首） */
  useEffect(() => {
    const a = audioRef.current;
    if (!a || loading) return;

    const advanceScriptureChapter = async (
      parsed: ParsedCuvChapterAudioSrc,
      target: { bookId: string; chapter: number } | null,
    ) => {
      if (!target) {
        setPlaying(false);
        return;
      }
      if (
        !parsed.webAudio &&
        parsed.voiceId === "teochew-nt" &&
        !voiceSupportsBook("teochew-nt", target.bookId)
      ) {
        setPlaying(false);
        return;
      }
      const meta = scriptureBooks.find((b) => b.bookId === target.bookId);
      if (!meta) {
        setPlaying(false);
        return;
      }
      const tid = await fetchDefaultTranslationIdCached();
      if (!tid || !translationSupportsChapterAudio(tid)) {
        setPlaying(false);
        return;
      }
      const audioTranslationId =
        parsed.webAudio && !translationUsesWebChapterAudio(tid) ? "web-en" : tid;
      const resolved = await resolveChapterAudioPlayableSrc({
        translationId: audioTranslationId,
        bookName: meta.bookName,
        bookId: target.bookId,
        chapter: target.chapter,
        voiceId: parsed.voiceId,
      });
      if (!resolved.ok) {
        setPlaying(false);
        return;
      }
      router.push(`/read/${target.bookId}/${target.chapter}`);
      playAfterNextBindRef.current = true;
      setPlaybackSrc(resolved.src.trim());
    };

    const onEndedAdvance = () => {
      if (devicePlaybackRef.current) {
        a.currentTime = 0;
        void attemptShellPlay(a);
        return;
      }
      const cur = effectiveSrcRef.current.trim();
      const planSession = readReadingPlanAudioSession();
      const planParsed = planSession && cur ? tryParseCuvChapterAudioEffectiveSrc(cur) : null;
      if (planSession && planParsed) {
        const idx = indexInReadingPlanQueue(planSession.queue, planParsed.bookId, planParsed.chapter);
        if (idx >= 0) {
          const nextIdx = idx + 1;
          if (nextIdx < planSession.queue.length) {
            const next = planSession.queue[nextIdx]!;
            void advanceScriptureChapter(planParsed, {
              bookId: next.bookId,
              chapter: next.chapter,
            });
            return;
          }
          writeReadingPlanAudioSession(null);
          setPlaying(false);
          return;
        }
      }
      const mode = scriptureAudioRepeatRef.current;
      const parsed = tryParseCuvChapterAudioEffectiveSrc(cur);
      if (parsed) {
        if (mode === "chapter") {
          a.currentTime = 0;
          void attemptShellPlay(a);
          return;
        }
        const nextRef =
          mode === "book"
            ? getNextScriptureChapterInBook(parsed.bookId, parsed.chapter)
            : getNextScriptureChapter(parsed.bookId, parsed.chapter);
        void advanceScriptureChapter(parsed, nextRef);
        return;
      }
      const st = storeRef.current;
      if (st && cur && !shouldRestoreShellPlaybackSrc(st, cur)) {
        setPlaying(false);
        return;
      }
      if (!st && cur && typeof navigator !== "undefined" && navigator.onLine) {
        setPlaying(false);
        return;
      }
      if (!st) return;
      const tracks = st.audioTracks.filter((t) => Boolean(t.src?.trim()));
      const n = tracks.length;
      if (n === 0) return;
      if (n === 1) {
        a.currentTime = 0;
        void attemptShellPlay(a);
        return;
      }
      const randomNext = pickRandomShellAudioTrackSrc(st, cur);
      const nextSrc =
        randomNext?.trim() ||
        (() => {
          let idx = tracks.findIndex((t) => shellPlaybackUrlsEqual((t.src ?? "").trim(), cur));
          if (idx < 0) idx = 0;
          return (tracks[(idx + 1) % n]?.src ?? "").trim();
        })();
      if (!nextSrc) return;
      playAfterNextBindRef.current = true;
      setPlaybackSrc(nextSrc);
    };

    a.addEventListener("ended", onEndedAdvance);
    return () => a.removeEventListener("ended", onEndedAdvance);
  }, [loading, setPlaybackSrc, router, attemptShellPlay]);

  const canPlay = Boolean(effectiveSrc) && !loading;

  const canPlayMusic = useMemo(() => {
    if (loading || !store) return false;
    return (
      Boolean(getShellDefaultAudioSrc(store)?.trim()) ||
      store.audioTracks.some((t) => Boolean(t.src?.trim()))
    );
  }, [loading, store]);

  const seekRatio = useCallback((ratio: number) => {
    const a = audioRef.current;
    if (!a) return;
    const d = a.duration;
    if (!Number.isFinite(d) || d <= 0) return;
    a.currentTime = Math.max(0, Math.min(d, ratio * d));
  }, []);

  const getAudioElement = useCallback((): HTMLAudioElement | null => audioRef.current, []);

  const togglePlayScripture = useCallback(async () => {
    flushSync(() => {
      setShellAudioHomePrimed(true);
    });
    const a = audioRef.current;
    if (!a || loading) return;

    const readCh = parseReadChapterPath(pathname);
    if (!readCh) return;

    const tid = await fetchDefaultTranslationIdCached();
    if (!tid || !translationSupportsChapterAudio(tid)) return;

    const bookMeta = scriptureBooks.find((b) => b.bookId === readCh.bookId);
    if (!bookMeta) return;

    const planSession = await prepareReadingPlanAudioSessionForChapter(readCh.bookId, readCh.chapter);
    if (planSession) {
      setScriptureAudioRepeatMode("off", { persist: false });
    }
    const playVoice = effectiveVoiceId(readCh.bookId);
    const resolved = await resolveChapterAudioPlayableSrc({
      translationId: tid,
      bookName: bookMeta.bookName,
      bookId: readCh.bookId,
      chapter: readCh.chapter,
      voiceId: playVoice,
    });
    if (!resolved.ok) return;

    const want = resolved.src.trim();
    const ov = playbackOverrideRef.current?.trim() ?? "";
    const already = audioUrlEquals(a, want) || (Boolean(ov) && shellPlaybackUrlsEqual(ov, want));
    if (!already) {
      playAfterNextBindRef.current = true;
      setPlaybackSrc(want);
      return;
    }
    if (!a.paused) {
      a.pause();
      setPlaying(false);
      return;
    }
    await attemptShellPlay(a);
  }, [loading, pathname, setPlaybackSrc, attemptShellPlay, effectiveVoiceId, setScriptureAudioRepeatMode]);

  const togglePlayMusic = useCallback(async () => {
    flushSync(() => {
      setShellAudioHomePrimed(true);
    });
    const a = audioRef.current;
    if (!a || loading) return;

    const st = storeRef.current;
    const eff = effectiveSrcRef.current.trim();

    if (eff && isCuvChapterAudioEffectiveSrc(eff)) {
      if (!a.paused) {
        a.pause();
        setPlaying(false);
      }
      setScriptureAudioRepeatMode("off", { persist: false });
      if (st) {
        const avoid = eff;
        const pick =
          pickRandomShellAudioTrackSrc(st, avoid)?.trim() || getShellDefaultAudioSrc(st)?.trim() || "";
        if (pick) {
          playAfterNextBindRef.current = true;
          const def = getShellDefaultAudioSrc(st)?.trim() ?? "";
          if (def && shellPlaybackUrlsEqual(pick, def)) setPlaybackSrc(null);
          else setPlaybackSrc(pick);
        }
      }
      return;
    }

    if (!eff) {
      if (st) {
        const boot = getShellDefaultAudioSrc(st)?.trim() ?? "";
        if (boot) {
          playAfterNextBindRef.current = true;
          setPlaybackSrc(boot);
        }
      }
      return;
    }

    if (!a.paused) {
      a.pause();
      setPlaying(false);
      return;
    }

    const tracks = st?.audioTracks.filter((t) => Boolean(t.src?.trim())) ?? [];
    if (tracks.length > 1 && playbackOverrideRef.current == null && !devicePlaybackRef.current) {
      const dur = a.duration;
      const t0 = a.currentTime;
      const nearStart = !Number.isFinite(dur) || dur <= 0 || t0 < 0.35;
      const nearEnd = Number.isFinite(dur) && dur > 0 && t0 >= dur - 0.75;
      if (nearStart || nearEnd) {
        const curUrl = (a.currentSrc || a.src || eff).trim();
        let pick = tracks[Math.floor(Math.random() * tracks.length)]!;
        for (let g = 0; g < 28 && tracks.length > 1; g++) {
          const ps = (pick.src ?? "").trim();
          if (!shellPlaybackUrlsEqual(ps, curUrl)) break;
          pick = tracks[Math.floor(Math.random() * tracks.length)]!;
        }
        const ns = (pick.src ?? "").trim();
        if (ns) {
          playAfterNextBindRef.current = true;
          setPlaybackSrc(ns);
          return;
        }
      }
    }

    await attemptShellPlay(a);
  }, [loading, setPlaybackSrc, attemptShellPlay, setScriptureAudioRepeatMode]);

  const value = useMemo<MusicShellPlaybackValue>(
    () => ({
      canPlayMusic,
      canPlay,
      playing,
      loading,
      togglePlayScripture,
      togglePlayMusic,
      pausePlayback,
      deviceLibraryPlayback,
      attachDeviceLibraryFromBlob,
      clearDeviceLibraryPlayback,
      canPickLocalAudioFolder,
      effectiveSrc,
      shellDefaultSrc: defaultSrc,
      shellOverrideSrc: playbackOverride,
      setPlaybackSrc,
      refetchCompanionStore,
      currentSec,
      durationSec,
      seekRatio,
      musicStore: store,
      getAudioElement,
      sleepTimerMinutes,
      sleepTimerDeadlineAt,
      setSleepTimerMinutes,
      registerSleepPauseHandler,
      registerBeforeShellPlayHandler,
      registerAfterShellPlayHandler,
      shellAudioMuted,
      setShellAudioMuted,
      scriptureAudioRepeatMode,
      setScriptureAudioRepeatMode,
    }),
    [
      canPlayMusic,
      canPlay,
      playing,
      loading,
      togglePlayScripture,
      togglePlayMusic,
      pausePlayback,
      deviceLibraryPlayback,
      attachDeviceLibraryFromBlob,
      clearDeviceLibraryPlayback,
      canPickLocalAudioFolder,
      effectiveSrc,
      defaultSrc,
      playbackOverride,
      setPlaybackSrc,
      refetchCompanionStore,
      currentSec,
      durationSec,
      seekRatio,
      store,
      getAudioElement,
      sleepTimerMinutes,
      sleepTimerDeadlineAt,
      setSleepTimerMinutes,
      registerSleepPauseHandler,
      registerBeforeShellPlayHandler,
      registerAfterShellPlayHandler,
      shellAudioMuted,
      setShellAudioMuted,
      scriptureAudioRepeatMode,
      setScriptureAudioRepeatMode,
    ],
  );

  return (
    <MusicShellPlaybackContext.Provider value={value}>
      <audio
        ref={audioRef}
        preload="none"
        playsInline
        className="hidden"
        controls={false}
        aria-hidden
      />
      {children}
    </MusicShellPlaybackContext.Provider>
  );
}
