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
import { usePathname, useRouter } from "next/navigation";
import { useAskbibleUser } from "@/components/auth/AskbibleUserProvider";
import { useCuvChapterAudioVoice } from "@/components/bible/CuvChapterAudioVoiceContext";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useTodayPlanScriptureResumePersistence } from "@/hooks/useTodayPlanScriptureResumePersistence";
import { isCuvChapterAudioEffectiveSrc } from "@/lib/bible/parse-cuv-chapter-audio-src";
import { devotionalAvailable, loadDevotionalDays } from "@/lib/devotional/solid-joys";
import type { MusicAlbumRepeatMode } from "@/lib/music/album-playback";
import { clearDevicePlaybackPersisted } from "@/lib/music/device-playback-storage";
import { getShellDefaultAudioSrc } from "@/lib/music-companion/shell-default-audio-src";
import {
  clearShellPlaybackPersisted,
  readScriptureAudioRepeatModePersisted,
  shellPlaybackUrlsEqual,
  writeScriptureAudioRepeatModePersisted,
} from "@/lib/music-companion/shell-playback-storage";
import {
  musicCompanionStoreHasPlayableTracks,
  shippedPublicMusicCompanionStore,
} from "@/lib/music-companion/shipped-store";
import type { MusicCompanionStore } from "@/lib/music-companion/types";
import {
  readScripturePlaybackRatePersisted,
  writeScripturePlaybackRatePersisted,
} from "@/lib/read/scripture-playback-rate-web";
import { isWebAppHomePath } from "@/lib/web-app-home-path";
import {
  audioUrlEquals,
  type DeviceLibraryPlaybackInfo,
  type DevicePlaybackCell,
  type MusicShellPlaybackValue,
  type MusicShellSleepTimerMinutes,
  type ScriptureAudioRepeatMode,
  type ScriptureListenTarget,
  type ShellPlaybackRestorePlan,
} from "./music-shell-playback-types";
import { useMusicShellAudioEvents } from "./use-music-shell-audio-events";
import { useMusicShellMediaSession } from "./use-music-shell-media-session";
import { useMusicShellPersistence } from "./use-music-shell-persistence";
import { useMusicShellScriptureAndEnded } from "./use-music-shell-scripture-and-ended";
import { useMusicShellSleepAndPlayHooks } from "./use-music-shell-sleep-and-hooks";

export type {
  DeviceLibraryPlaybackInfo,
  MusicShellPlaybackValue,
  MusicShellSleepTimerMinutes,
  ScriptureAudioRepeatMode,
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
  const { t, locale } = useLocale();
  const { isAdmin } = useAskbibleUser();
  const devotionalAccessRef = useRef({ locale, isAdmin });
  devotionalAccessRef.current = { locale, isAdmin };
  useEffect(() => {
    if (devotionalAvailable(locale, isAdmin)) void loadDevotionalDays(locale).catch(() => {});
  }, [locale, isAdmin]);

  const { effectiveVoiceId } = useCuvChapterAudioVoice();
  const [store, setStore] = useState<MusicCompanionStore | null>(() => shippedPublicMusicCompanionStore);
  /** 首屏已有随包曲库；网络刷新不阻塞播放。 */
  const [loading] = useState(false);
  /**
   * 自然首页 `/`、`/nature`：勿在曲库就绪后立刻把默认曲目绑进隐藏 `<audio>`（会 `load` 缓冲、吃内存），
   * 易与主屏 Web 上全屏视频争资源导致整页被系统回收。离开首页、恢复持久化播放、或用户点壳层播放后再绑。
   */
  const [shellAudioHomePrimed, setShellAudioHomePrimed] = useState(false);
  const [playbackOverride, setPlaybackOverride] = useState<string | null>(null);
  const [devicePlayback, setDevicePlaybackState] = useState<DevicePlaybackCell | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  /** 当前在播的经文章（听读计时用）：src 对不上就说明换成别的音频了，不再计时 */
  const scriptureListenTargetRef = useRef<ScriptureListenTarget | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [shellAudioMuted, setShellAudioMutedState] = useState(false);
  const [scriptureAudioRepeatMode, setScriptureAudioRepeatModeState] = useState<ScriptureAudioRepeatMode>("off");
  const [scripturePlaybackRate, setScripturePlaybackRateState] = useState(() =>
    typeof window === "undefined" ? 1 : readScripturePlaybackRatePersisted(),
  );
  /** 避免 `currentSrc` 尚未就绪时反复 `load()` 触发 setState 风暴 */
  const lastBoundEffectiveSrcRef = useRef("");
  const shellPlaybackRestoreRef = useRef<ShellPlaybackRestorePlan | null>(null);
  /** 恢复完成前不写 localStorage，避免用 0 秒覆盖上次进度 */
  const shellPlaybackPersistEnabledRef = useRef(false);
  /** 曲目自然结束后切到下一首并自动播放（避免 `ended` 时 `paused` 导致仅绑 src 不 play） */
  const playAfterNextBindRef = useRef(false);
  const [playRequestEpoch, setPlayRequestEpoch] = useState(0);
  const musicAlbumRepeatModeOverrideRef = useRef<MusicAlbumRepeatMode | null>(null);
  const readHomeScriptureReadyRef = useRef(false);
  const [readHomeScripturePlaybackReady, setReadHomeScripturePlaybackReadyState] = useState(false);
  const scriptureAudioRepeatRef = useRef<ScriptureAudioRepeatMode>("off");
  scriptureAudioRepeatRef.current = scriptureAudioRepeatMode;
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
    (src: string | null, opts?: { autoPlay?: boolean }) => {
      clearDevicePlaybackPersisted();
      const requestedSrc = src?.trim() || defaultSrc;
      const restore = shellPlaybackRestoreRef.current;
      if (restore && !shellPlaybackUrlsEqual(restore.targetSrc, requestedSrc)) {
        shellPlaybackRestoreRef.current = null;
        shellPlaybackPersistEnabledRef.current = true;
      }
      if (opts?.autoPlay) {
        setPlayRequestEpoch((epoch) => epoch + 1);
        playAfterNextBindRef.current = true;
        setShellAudioHomePrimed(true);
      }
      setDevicePlaybackState((prev) => {
        if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl);
        return null;
      });
      if (!src?.trim()) {
        setPlaybackOverride(null);
        return;
      }
      const next = src.trim();
      if (defaultSrc && shellPlaybackUrlsEqual(next, defaultSrc)) setPlaybackOverride(null);
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

  const pausePlayback = useCallback(() => {
    const a = audioRef.current;
    if (a && !a.paused) a.pause();
    setPlaying(false);
  }, []);

  const {
    sleepTimerMinutes,
    sleepTimerDeadlineAt,
    setSleepTimerMinutes,
    registerSleepPauseHandler,
    registerBeforeShellPlayHandler,
    registerAfterShellPlayHandler,
    attemptShellPlay,
  } = useMusicShellSleepAndPlayHooks({ pausePlayback, setPlaying });

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

  const setScripturePlaybackRate = useCallback((rate: number) => {
    const normalized = Number.isFinite(rate) && rate > 0 ? rate : 1;
    setScripturePlaybackRateState(normalized);
    writeScripturePlaybackRatePersisted(normalized);
    const a = audioRef.current;
    if (a) a.playbackRate = normalized;
  }, []);

  const setMusicAlbumRepeatModeOverride = useCallback((mode: MusicAlbumRepeatMode | null) => {
    musicAlbumRepeatModeOverrideRef.current = mode;
  }, []);

  const setReadHomeScripturePlaybackReady = useCallback((ready: boolean) => {
    readHomeScriptureReadyRef.current = ready;
    setReadHomeScripturePlaybackReadyState(ready);
  }, []);

  useEffect(() => {
    setScriptureAudioRepeatModeState(readScriptureAudioRepeatModePersisted());
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (a) a.playbackRate = scripturePlaybackRate;
  }, [scripturePlaybackRate]);

  useEffect(() => {
    if (!effectiveSrc.trim() || !isCuvChapterAudioEffectiveSrc(effectiveSrc)) {
      setScriptureAudioRepeatMode("off", { persist: false });
      return;
    }
    setScriptureAudioRepeatMode(readScriptureAudioRepeatModePersisted(), { persist: false });
  }, [effectiveSrc, setScriptureAudioRepeatMode]);

  useLayoutEffect(() => {
    const a = audioRef.current;
    if (a) a.muted = shellAudioMuted;
  }, [shellAudioMuted]);

  useEffect(() => {
    if (pathname !== "/" && !isWebAppHomePath(pathname) && pathname !== "/nature") {
      setShellAudioHomePrimed(true);
    }
  }, [pathname]);

  const { refetchCompanionStore } = useMusicShellPersistence({
    audioRef,
    store,
    setStore,
    storeRef,
    loading,
    pathname,
    defaultSrc,
    playbackOverride,
    setPlaybackOverride,
    devicePlaybackRef,
    setDevicePlaybackState,
    setShellAudioHomePrimed,
    effectiveSrc,
    setCurrentSec,
    setDurationSec,
    attemptShellPlay,
    shellPlaybackRestoreRef,
    shellPlaybackPersistEnabledRef,
  });

  useLayoutEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.preload = shellPlaybackRestoreRef.current ? "metadata" : "none";
    const isHomeNature = pathname === "/" || isWebAppHomePath(pathname) || pathname === "/nature";
    const bindSrc = !effectiveSrc.trim() || !isHomeNature || shellAudioHomePrimed ? effectiveSrc.trim() : "";

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
    if (audioUrlEquals(a, bindSrc) && !a.error) {
      lastBoundEffectiveSrcRef.current = bindSrc;
      a.muted = shellAudioMuted;
      if (playAfterNextBindRef.current) {
        playAfterNextBindRef.current = false;
        void attemptShellPlay(a);
      }
      return;
    }
    if (shellPlaybackUrlsEqual(lastBoundEffectiveSrcRef.current, bindSrc) && !a.error) {
      return;
    }
    lastBoundEffectiveSrcRef.current = bindSrc;
    const wasPlaying = !a.paused;
    const playAfterAdvance = playAfterNextBindRef.current;
    setCurrentSec(0);
    setDurationSec(0);
    a.src = bindSrc;
    a.muted = shellAudioMuted;
    a.load();
    if (wasPlaying || playAfterAdvance) {
      playAfterNextBindRef.current = false;
      void attemptShellPlay(a);
    }
  }, [effectiveSrc, pathname, shellAudioHomePrimed, shellAudioMuted, attemptShellPlay, playRequestEpoch]);

  useMusicShellAudioEvents({
    audioRef,
    scriptureListenTargetRef,
    setCurrentSec,
    setDurationSec,
    setPlaying,
    t,
    playing,
    store,
    effectiveSrc,
    musicAlbumRepeatModeOverrideRef,
  });

  const {
    pauseScripturePlayback,
    playScriptureChapter,
    skipScriptureNext,
    togglePlayScripture,
    togglePlayMusic,
  } = useMusicShellScriptureAndEnded({
    audioRef,
    loading,
    pathname,
    router,
    playing,
    setPlaying,
    setPlaybackSrc,
    attemptShellPlay,
    effectiveVoiceId,
    setShellAudioHomePrimed,
    setScriptureAudioRepeatMode,
    scriptureAudioRepeatRef,
    musicAlbumRepeatModeOverrideRef,
    storeRef,
    effectiveSrcRef,
    playbackOverrideRef,
    devicePlaybackRef,
    playAfterNextBindRef,
    shellPlaybackRestoreRef,
    shellPlaybackPersistEnabledRef,
    scriptureListenTargetRef,
    devotionalAccessRef,
  });

  const canPlay = Boolean(effectiveSrc) && !loading;
  const canPlayMusic = useMemo(() => musicCompanionStoreHasPlayableTracks(store), [store]);

  const seekRatio = useCallback((ratio: number) => {
    const a = audioRef.current;
    if (!a) return;
    const d = a.duration;
    if (!Number.isFinite(d) || d <= 0) return;
    a.currentTime = Math.max(0, Math.min(d, ratio * d));
  }, []);

  const getAudioElement = useCallback((): HTMLAudioElement | null => audioRef.current, []);

  useMusicShellMediaSession({
    audioRef,
    attemptShellPlay,
    pausePlayback,
    skipScriptureNext,
    setPlaybackSrc,
    seekRatio,
    effectiveSrcRef,
    storeRef,
    musicAlbumRepeatModeOverrideRef,
    playAfterNextBindRef,
    currentSec,
    devicePlayback,
    durationSec,
    effectiveSrc,
    locale,
    playing,
    scripturePlaybackRate,
    store,
  });

  useTodayPlanScriptureResumePersistence({
    playing,
    effectiveSrc,
    currentSec,
    durationSec,
  });

  const value = useMemo<MusicShellPlaybackValue>(
    () => ({
      canPlayMusic,
      canPlay,
      playing,
      loading,
      togglePlayScripture,
      playScriptureChapter,
      skipScriptureNext,
      pauseScripturePlayback,
      scripturePlaybackRate,
      setScripturePlaybackRate,
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
      setMusicAlbumRepeatModeOverride,
      setReadHomeScripturePlaybackReady,
      readHomeScripturePlaybackReady,
    }),
    [
      canPlayMusic,
      canPlay,
      playing,
      loading,
      togglePlayScripture,
      playScriptureChapter,
      skipScriptureNext,
      pauseScripturePlayback,
      scripturePlaybackRate,
      setScripturePlaybackRate,
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
      setMusicAlbumRepeatModeOverride,
      setReadHomeScripturePlaybackReady,
      readHomeScripturePlaybackReady,
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
