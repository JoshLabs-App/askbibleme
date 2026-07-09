import { Audio } from "expo-av";
import { Platform } from "react-native";
import { useEffect, type MutableRefObject } from "react";
import { configureShellAudioMode } from "../audio/shellAudioMode";
import { safeStopAndUnloadSound } from "../audio/safeShellSound";
import { getAskBibleBaseUrl } from "../config/askbibleBaseUrl";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { isNetworkAvailable } from "../network/isNetworkAvailable";
import {
  hydrateMusicResourcePackState,
  readSyncedMusicCompanionStore,
} from "../media/musicResourcePackSync";
import {
  fetchMusicCompanionStoreFromRemote,
  getBundledMusicCompanionStore,
  readCachedMusicCompanionStore,
  writeCachedMusicCompanionStore,
} from "./fetchMusicCompanion";
import { enrichPlaybackTracks } from "./trackArtwork";
import { hasAtLeastBundledTracks, resolveSessionDefaultTrackIndex } from "./musicStoreHelpers";
import type { MusicCompanionStore } from "./types";
import type { MusicPlaybackRefs } from "./useMusicPlaybackRefs";

type Args = {
  enabled?: boolean;
  setStore: (store: MusicCompanionStore) => void;
  setTrackIndex: (index: number) => void;
  setLoading: (loading: boolean) => void;
  soundRef: MutableRefObject<Audio.Sound | null>;
  preloadedMusicSoundRef: MusicPlaybackRefs["preloadedMusicSoundRef"];
  preloadedMusicSoundWorkRef: MusicPlaybackRefs["preloadedMusicSoundWorkRef"];
  storeRef: MutableRefObject<MusicCompanionStore | null>;
};

export function useMusicStoreBootstrap({
  enabled = true,
  setStore,
  setTrackIndex,
  setLoading,
  soundRef,
  preloadedMusicSoundRef,
  preloadedMusicSoundWorkRef,
  storeRef,
}: Args): void {
  useEffect(() => {
    if (!enabled) return;
    const bootStartedAt = Date.now();
    const log = (message: string, ...args_: unknown[]) => {
      if (!__DEV__) return;
      console.warn(`[music-bootstrap +${Date.now() - bootStartedAt}ms] ${message}`, ...args_);
    };
    log("effect start", { platform: Platform.OS });
    const loadingGuard = setTimeout(() => {
      log("loading guard fired");
      setLoading(false);
    }, Platform.OS === "android" ? 1400 : 4000);
    let localDelayTimer: ReturnType<typeof setTimeout> | null = null;
    let remoteDelayTimer: ReturnType<typeof setTimeout> | null = null;
    let alive = true;

    void (async () => {
      log("setLoading(true)");
      setLoading(true);
      try {
        const audioModeWarmup = Promise.race([
          configureShellAudioMode(),
          new Promise<void>((resolve) => setTimeout(resolve, Platform.OS === "android" ? 250 : 1200)),
        ]);
        log("audio mode warmup requested");
        const bundledStore = getBundledMusicCompanionStore();
        const bundledTracks = enrichPlaybackTracks(bundledStore, getAskBibleBaseUrl());
        log("bundled store ready", {
          audioTracks: bundledStore.audioTracks?.length ?? 0,
          scenes: bundledStore.scenes?.length ?? 0,
          defaultSceneId: bundledStore.defaultSceneId ?? null,
        });
        setStore(bundledStore);
        if (isMobileBundledOnly()) {
          setTrackIndex(resolveSessionDefaultTrackIndex(bundledTracks));
          log("mobile bundled only path finished", { tracks: bundledTracks.length });
          await audioModeWarmup;
          return;
        }
        void audioModeWarmup;

        localDelayTimer = setTimeout(() => {
          log("local hydrate delay fired");
          void (async () => {
            if (!alive) return;
            try {
              log("hydrateMusicResourcePackState start");
              await hydrateMusicResourcePackState();
              if (!alive) return;
              log("hydrateMusicResourcePackState done");
              log("read synced/cached store start");
              const syncedStore = await readSyncedMusicCompanionStore();
              const cachedStore = await readCachedMusicCompanionStore();
              const localStore =
                syncedStore && hasAtLeastBundledTracks(syncedStore, bundledStore)
                  ? syncedStore
                  : cachedStore && hasAtLeastBundledTracks(cachedStore, bundledStore)
                    ? cachedStore
                    : bundledStore;
              if (!alive) return;
              log("local store resolved", {
                fromBundled: localStore === bundledStore,
                audioTracks: localStore.audioTracks?.length ?? 0,
                scenes: localStore.scenes?.length ?? 0,
              });
              if (localStore !== bundledStore) {
                setStore(localStore);
              }

              remoteDelayTimer = setTimeout(() => {
                log("remote hydrate delay fired");
                void (async () => {
                  if (!alive) return;
                  const online = await isNetworkAvailable();
                  log("remote network check", { online });
                  if (!online) return;
                  try {
                    log("fetchMusicCompanionStoreFromRemote start");
                    const remote = await fetchMusicCompanionStoreFromRemote();
                    if (!alive) return;
                    log("fetchMusicCompanionStoreFromRemote done", {
                      hasRemote: !!remote,
                      audioTracks: remote?.audioTracks?.length ?? 0,
                      scenes: remote?.scenes?.length ?? 0,
                    });
                    if (!remote || !hasAtLeastBundledTracks(remote, bundledStore)) return;
                    if (remote !== storeRef.current) {
                      log("applying remote store", {
                        audioTracks: remote.audioTracks?.length ?? 0,
                        scenes: remote.scenes?.length ?? 0,
                      });
                      setStore(remote);
                    }
                    await writeCachedMusicCompanionStore(remote);
                    log("remote store cached");
                  } catch {
                    /* 离线或超时：保留已应用的本地曲库 */
                    log("remote hydrate failed");
                  }
                })();
              }, Platform.OS === "android" ? 900 : 1800);
            } catch {
              /* 本地曲库 hydrate 失败：保留内置曲库 */
              log("local hydrate failed");
            }
          })();
        }, Platform.OS === "android" ? 0 : 1800);
      } finally {
        log("setLoading(false) in finally");
        setLoading(false);
      }
    })();

    return () => {
      log("cleanup");
      clearTimeout(loadingGuard);
      if (localDelayTimer) clearTimeout(localDelayTimer);
      if (remoteDelayTimer) clearTimeout(remoteDelayTimer);
      alive = false;
      const sound = soundRef.current;
      soundRef.current = null;
      if (sound) void safeStopAndUnloadSound(sound);
      const preloadedSound = preloadedMusicSoundRef.current?.sound ?? null;
      preloadedMusicSoundRef.current = null;
      preloadedMusicSoundWorkRef.current = null;
      if (preloadedSound && preloadedSound !== sound) void safeStopAndUnloadSound(preloadedSound);
    };
  }, [
    enabled,
    preloadedMusicSoundRef,
    preloadedMusicSoundWorkRef,
    setStore,
    setTrackIndex,
    setLoading,
    soundRef,
    storeRef,
  ]);
}
