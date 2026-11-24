import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from "react";
import { isIosLikeUserAgent } from "@/lib/dom/ios";
import { getDeviceTrackBlob } from "@/lib/music/device-library-db";
import {
  clearDevicePlaybackPersisted,
  readDevicePlaybackPersisted,
  writeDevicePlaybackPersisted,
} from "@/lib/music/device-playback-storage";
import {
  clearShellPlaybackPersisted,
  readShellPlaybackPersisted,
  shellPlaybackUrlsEqual,
  shouldRestoreShellPlaybackSrc,
  writeShellPlaybackPersisted,
} from "@/lib/music-companion/shell-playback-storage";
import type { MusicCompanionStore } from "@/lib/music-companion/types";
import {
  audioUrlEquals,
  type DevicePlaybackCell,
  type ShellPlaybackRestorePlan,
} from "./music-shell-playback-types";

/** 减轻「回前台就拉曲库」：全平台最短间隔（毫秒） */
const COMPANION_FETCH_MIN_INTERVAL_MS = 45_000;

export function useMusicShellPersistence({
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
}: {
  audioRef: RefObject<HTMLAudioElement | null>;
  store: MusicCompanionStore | null;
  setStore: Dispatch<SetStateAction<MusicCompanionStore | null>>;
  storeRef: MutableRefObject<MusicCompanionStore | null>;
  loading: boolean;
  pathname: string;
  defaultSrc: string;
  playbackOverride: string | null;
  setPlaybackOverride: Dispatch<SetStateAction<string | null>>;
  devicePlaybackRef: MutableRefObject<DevicePlaybackCell | null>;
  setDevicePlaybackState: Dispatch<SetStateAction<DevicePlaybackCell | null>>;
  setShellAudioHomePrimed: Dispatch<SetStateAction<boolean>>;
  effectiveSrc: string;
  setCurrentSec: Dispatch<SetStateAction<number>>;
  setDurationSec: Dispatch<SetStateAction<number>>;
  attemptShellPlay: (a: HTMLAudioElement) => void;
  shellPlaybackRestoreRef: MutableRefObject<ShellPlaybackRestorePlan | null>;
  shellPlaybackPersistEnabledRef: MutableRefObject<boolean>;
}) {
  const shellPlaybackHydratedRef = useRef(false);
  const companionLastFetchAtRef = useRef(0);
  const shellPlaybackLastPersistAtRef = useRef(0);

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
  }, [setStore]);

  useEffect(() => {
    let cancelled = false;
    let lastHiddenAt = 0;

    const load = async (reason: "initial" | "visible") => {
      if (reason === "visible") {
        const t = companionLastFetchAtRef.current;
        if (t > 0 && Date.now() - t < COMPANION_FETCH_MIN_INTERVAL_MS) return;
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
        /* 保留 bootstrap 曲库 */
      }
    };

    void load("initial");

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
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [setStore]);

  useEffect(() => {
    if (!playbackOverride) return;
    if (!defaultSrc) return;
    if (shellPlaybackUrlsEqual(playbackOverride, defaultSrc)) {
      setPlaybackOverride(null);
    }
  }, [defaultSrc, playbackOverride, setPlaybackOverride]);

  /** Restore once on every route, including /music. Navigation must never reset a listening session. */
  useEffect(() => {
    if (loading || shellPlaybackHydratedRef.current) return;
    if (!store && typeof navigator !== "undefined" && navigator.onLine) return;

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
      setPlaybackOverride(persisted.src.trim());
      shellPlaybackHydratedRef.current = true;
    })();

    return () => {
      cancelled = true;
    };
  }, [
    store,
    loading,
    pathname,
    setDevicePlaybackState,
    setPlaybackOverride,
    setShellAudioHomePrimed,
    shellPlaybackPersistEnabledRef,
    shellPlaybackRestoreRef,
  ]);

  /** 曲库加载失败等：无 store 时仍允许写入进度，避免持久化被永久关闭 */
  useEffect(() => {
    if (loading || store) return;
    shellPlaybackPersistEnabledRef.current = true;
  }, [loading, store, shellPlaybackPersistEnabledRef]);

  /** 无可用音源时放弃恢复，避免持久化永远锁定 */
  useEffect(() => {
    if (!shellPlaybackRestoreRef.current || loading) return;
    if (!effectiveSrc.trim()) {
      shellPlaybackRestoreRef.current = null;
      shellPlaybackPersistEnabledRef.current = true;
    }
  }, [effectiveSrc, loading, shellPlaybackPersistEnabledRef, shellPlaybackRestoreRef]);

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
      setCurrentSec(t);
      setDurationSec(Number.isFinite(dur) ? dur : 0);
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
  }, [
    audioRef,
    effectiveSrc,
    loading,
    attemptShellPlay,
    setCurrentSec,
    setDurationSec,
    shellPlaybackPersistEnabledRef,
    shellPlaybackRestoreRef,
  ]);

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
    if (
      !src ||
      src.startsWith("blob:") ||
      !storeRef.current?.audioTracks.some((track) => shellPlaybackUrlsEqual(track.src ?? "", src))
    ) {
      return;
    }
    if (!audioUrlEquals(a, src)) return;
    writeShellPlaybackPersisted({
      v: 1,
      src,
      timeSec: a.currentTime,
      wasPlaying: !a.paused,
    });
    shellPlaybackLastPersistAtRef.current = Date.now();
  }, [audioRef, devicePlaybackRef, effectiveSrc, loading, shellPlaybackPersistEnabledRef, storeRef]);

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
  }, [audioRef, persistShellPlayback, shellPlaybackPersistEnabledRef]);

  return { refetchCompanionStore };
}
