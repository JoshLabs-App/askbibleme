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
import { usePathname } from "next/navigation";
import type { MusicCompanionStore } from "@/lib/music-companion/types";
import { isIosLikeUserAgent } from "@/lib/dom/ios";
import { getShellDefaultAudioSrc, getShellSceneBoundAudioSrc, pickRandomShellAudioTrackSrc } from "@/lib/music-companion/shell-default-audio-src";
import {
  clearShellPlaybackPersisted,
  isTrackSrcInStore,
  readShellPlaybackPersisted,
  shellPlaybackUrlsEqual,
  writeShellPlaybackPersisted,
} from "@/lib/music-companion/shell-playback-storage";

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

/** 全局定时停止：0 为关闭；墙钟到时暂停壳层音乐（不关屏、不锁机），并调用已注册的额外暂停（历史：自然混音等） */
export type MusicShellSleepTimerMinutes = 0 | 30 | 60 | 120;

export type MusicShellPlaybackValue = {
  canPlay: boolean;
  playing: boolean;
  loading: boolean;
  togglePlay: () => void;
  pausePlayback: () => void;
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
  /** 壳层 `<audio>` 静音（首页顶栏铃铛）；不改变播放/暂停状态 */
  shellAudioMuted: boolean;
  setShellAudioMuted: (muted: boolean) => void;
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
  const [store, setStore] = useState<MusicCompanionStore | null>(null);
  const [loading, setLoading] = useState(true);
  /**
   * 自然首页 `/`、`/nature`：勿在曲库就绪后立刻把默认曲目绑进隐藏 `<audio>`（会 `load` 缓冲、吃内存），
   * 易与主屏 Web 上全屏视频争资源导致整页被系统回收。离开首页、恢复持久化播放、或用户点壳层播放后再绑。
   */
  const [shellAudioHomePrimed, setShellAudioHomePrimed] = useState(false);
  const [playbackOverride, setPlaybackOverride] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [sleepTimerMinutes, setSleepTimerMinutesState] = useState<MusicShellSleepTimerMinutes>(0); // 默认关闭
  const [sleepTimerDeadlineAt, setSleepTimerDeadlineAt] = useState<number | null>(null);
  const [shellAudioMuted, setShellAudioMutedState] = useState(false);
  const sleepTimerDeadlineRef = useRef<number | null>(null);
  const shellPlaybackHydratedRef = useRef(false);
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
  const sleepPauseHandlersRef = useRef(new Set<() => void>());
  const playbackOverrideRef = useRef<string | null>(null);
  playbackOverrideRef.current = playbackOverride;

  const defaultSrc = useMemo(() => ((store ? getShellDefaultAudioSrc(store) : null) ?? "").trim(), [store]);
  const effectiveSrc = (playbackOverride?.trim() || defaultSrc).trim();

  const storeRef = useRef(store);
  storeRef.current = store;
  const effectiveSrcRef = useRef(effectiveSrc);
  effectiveSrcRef.current = effectiveSrc;

  const setPlaybackSrc = useCallback(
    (src: string | null) => {
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

  const setShellAudioMuted = useCallback((muted: boolean) => {
    setShellAudioMutedState(muted);
    const a = audioRef.current;
    if (a) a.muted = muted;
  }, []);

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

  /** 首次拿到曲库后：从 localStorage 恢复上次曲目（非 `/music`）；音乐页每次进入随机起播、清持久化、尝试自动播放 */
  useEffect(() => {
    if (loading || !store || shellPlaybackHydratedRef.current) return;
    if (isMusicShellPath(pathname)) return;
    shellPlaybackHydratedRef.current = true;

    const persisted = readShellPlaybackPersisted();
    if (!persisted) {
      shellPlaybackPersistEnabledRef.current = true;
      return;
    }
    if (!isTrackSrcInStore(store, persisted.src)) {
      clearShellPlaybackPersisted();
      shellPlaybackPersistEnabledRef.current = true;
      return;
    }

    setShellAudioHomePrimed(true);
    shellPlaybackPersistEnabledRef.current = false;
    shellPlaybackRestoreRef.current = {
      targetSrc: persisted.src.trim(),
      timeSec: persisted.timeSec,
      tryPlay: persisted.wasPlaying,
    };
    const def = getShellSceneBoundAudioSrc(store)?.trim() ?? "";
    if (def && shellPlaybackUrlsEqual(persisted.src, def)) setPlaybackOverride(null);
    else setPlaybackOverride(persisted.src.trim());
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
        void a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
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
      void a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
    /** 未在播时不要 `setPlaying(false)`：会制造无意义重渲染，曾与首页对齐 `effectiveSrc` 的 effect 形成更新风暴。 */
  }, [effectiveSrc, pathname, shellAudioHomePrimed, shellAudioMuted]);

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
        void a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
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
  }, [effectiveSrc, loading]);

  const persistShellPlayback = useCallback(() => {
    if (!shellPlaybackPersistEnabledRef.current || loading) return;
    const a = audioRef.current;
    if (!a) return;
    const src = effectiveSrc.trim();
    if (!src) return;
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

    const onEndedAdvance = () => {
      const st = storeRef.current;
      if (!st) return;
      const tracks = st.audioTracks.filter((t) => Boolean(t.src?.trim()));
      const n = tracks.length;
      if (n === 0) return;
      if (n === 1) {
        a.currentTime = 0;
        void a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
        return;
      }
      const cur = effectiveSrcRef.current.trim();
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
  }, [loading, setPlaybackSrc]);

  const canPlay = Boolean(effectiveSrc) && !loading;

  const seekRatio = useCallback((ratio: number) => {
    const a = audioRef.current;
    if (!a) return;
    const d = a.duration;
    if (!Number.isFinite(d) || d <= 0) return;
    a.currentTime = Math.max(0, Math.min(d, ratio * d));
  }, []);

  const getAudioElement = useCallback((): HTMLAudioElement | null => audioRef.current, []);

  const togglePlay = useCallback(async () => {
    flushSync(() => {
      setShellAudioHomePrimed(true);
    });
    const a = audioRef.current;
    if (!a || loading) return;
    const st = storeRef.current;
    const eff = effectiveSrcRef.current.trim();

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
    if (tracks.length > 1 && playbackOverrideRef.current == null) {
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

    try {
      await a.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }, [loading, setPlaybackSrc]);

  const value = useMemo<MusicShellPlaybackValue>(
    () => ({
      canPlay,
      playing,
      loading,
      togglePlay,
      pausePlayback,
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
      shellAudioMuted,
      setShellAudioMuted,
    }),
    [
      canPlay,
      playing,
      loading,
      togglePlay,
      pausePlayback,
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
      shellAudioMuted,
      setShellAudioMuted,
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
