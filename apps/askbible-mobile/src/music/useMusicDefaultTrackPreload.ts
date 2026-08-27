import { Audio } from "expo-av";
import { useEffect } from "react";
import { isNativeMainTrackOs } from "../audio/shellNativeAudioTakeover";
import { safeStopAndUnloadSound } from "../audio/safeShellSound";
import { getAskBibleBaseUrl } from "../config/askbibleBaseUrl";
import { getBundledMusicCompanionStore } from "./fetchMusicCompanion";
import { warmBundledModuleUri } from "./musicTrackPlayback";
import { enrichPlaybackTracks } from "./trackArtwork";
import { resolveSessionDefaultTrackIndex } from "./musicStoreHelpers";
import type { MusicPlaybackRefs, PreloadedMusicSound } from "./useMusicPlaybackRefs";

const moduleStartedAt = Date.now();
let defaultPreloadPromise: Promise<PreloadedMusicSound | null> | null = null;
let defaultPreloadTrackId: string | null = null;
let defaultPreloadCompletedTrackId: string | null = null;
let defaultPreloadedSound: PreloadedMusicSound | null = null;

function logPreload(message: string, ...args_: unknown[]) {
  if (__DEV__) {
    console.warn(`[music-preload +${Date.now() - moduleStartedAt}ms] ${message}`, ...args_);
  }
}

function startDefaultTrackPreload(): Promise<PreloadedMusicSound | null> | null {
  // 原生音乐勿预建 expo-av Sound 污染会话。
  if (isNativeMainTrackOs()) return null;
  if (defaultPreloadPromise) return defaultPreloadPromise;
  if (defaultPreloadCompletedTrackId && defaultPreloadCompletedTrackId === defaultPreloadTrackId) {
    return null;
  }

  const bundledStore = getBundledMusicCompanionStore();
  const bundledTracks = enrichPlaybackTracks(bundledStore, getAskBibleBaseUrl());
  const bundledDefaultTrack = bundledTracks[resolveSessionDefaultTrackIndex(bundledTracks)];
  const bundledDefaultModule = bundledDefaultTrack?.bundledModule ?? null;
  if (!bundledDefaultTrack || bundledDefaultModule == null) return null;

  defaultPreloadTrackId = bundledDefaultTrack.id;
  logPreload("default preload scheduled", { trackId: bundledDefaultTrack.id });
  void warmBundledModuleUri(bundledDefaultModule);

  const preloadTask = (async () => {
    if (defaultPreloadedSound?.trackId === bundledDefaultTrack.id) {
      return defaultPreloadedSound ?? null;
    }
    if (defaultPreloadedSound) {
      await safeStopAndUnloadSound(defaultPreloadedSound.sound);
      defaultPreloadedSound = null;
    }
    try {
      logPreload("default preload start", { trackId: bundledDefaultTrack.id });
      const avSource = await warmBundledModuleUri(bundledDefaultModule);
      if (!avSource) return null;
      const created = await Audio.Sound.createAsync(
        { uri: avSource },
        {
          shouldPlay: false,
        },
      );
      defaultPreloadedSound = {
        trackId: bundledDefaultTrack.id,
        sound: created.sound,
        status: created.status,
      };
      logPreload("default preload ready", { trackId: bundledDefaultTrack.id });
      defaultPreloadCompletedTrackId = bundledDefaultTrack.id;
      return defaultPreloadedSound;
    } catch {
      logPreload("default preload failed", { trackId: bundledDefaultTrack.id });
      return null;
    }
  })();
  defaultPreloadPromise = preloadTask;

  void preloadTask.finally(() => {
    if (defaultPreloadPromise === preloadTask) {
      defaultPreloadPromise = null;
    }
  });

  return preloadTask;
}

export function primeMusicDefaultTrackPreload(): void {
  void startDefaultTrackPreload();
}

/** 播放器接手预热 Sound 后调用，避免 hook cleanup 把正在播的轨 unload 掉。 */
export function claimDefaultPreloadedMusicSound(trackId: string): PreloadedMusicSound | null {
  const id = trackId.trim();
  if (!id || defaultPreloadedSound?.trackId !== id) return null;
  const claimed = defaultPreloadedSound;
  defaultPreloadedSound = null;
  defaultPreloadCompletedTrackId = null;
  defaultPreloadPromise = null;
  defaultPreloadTrackId = null;
  return claimed;
}

type Args = {
  preloadedMusicSoundRef: MusicPlaybackRefs["preloadedMusicSoundRef"];
  preloadedMusicSoundWorkRef: MusicPlaybackRefs["preloadedMusicSoundWorkRef"];
};

export function useMusicDefaultTrackPreload({
  preloadedMusicSoundRef,
  preloadedMusicSoundWorkRef,
}: Args): void {
  useEffect(() => {
    const preloadTask = startDefaultTrackPreload();
    if (!preloadTask || !defaultPreloadTrackId) return undefined;

    if (defaultPreloadedSound?.trackId === defaultPreloadTrackId) {
      preloadedMusicSoundRef.current = defaultPreloadedSound;
    }

    preloadedMusicSoundWorkRef.current = {
      trackId: defaultPreloadTrackId,
      promise: preloadTask,
    };
    void preloadTask.finally(() => {
      if (preloadedMusicSoundWorkRef.current?.promise === preloadTask) {
        preloadedMusicSoundWorkRef.current = null;
      }
      if (defaultPreloadedSound?.trackId === defaultPreloadTrackId) {
        preloadedMusicSoundRef.current = defaultPreloadedSound;
      }
    });

    return () => {
      preloadedMusicSoundRef.current = null;
      preloadedMusicSoundWorkRef.current = null;
      // 已被 claim 给播放器的 Sound 不再 unload
      const owned = defaultPreloadedSound;
      defaultPreloadedSound = null;
      defaultPreloadPromise = null;
      defaultPreloadTrackId = null;
      defaultPreloadCompletedTrackId = null;
      if (owned?.sound) void safeStopAndUnloadSound(owned.sound);
    };
  }, [preloadedMusicSoundRef, preloadedMusicSoundWorkRef]);
}

primeMusicDefaultTrackPreload();
