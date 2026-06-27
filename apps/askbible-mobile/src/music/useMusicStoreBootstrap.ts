import type { Audio } from "expo-av";
import { InteractionManager } from "react-native";
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

type Args = {
  setStore: (store: MusicCompanionStore) => void;
  setTrackIndex: (index: number) => void;
  setLoading: (loading: boolean) => void;
  soundRef: MutableRefObject<Audio.Sound | null>;
  storeRef: MutableRefObject<MusicCompanionStore | null>;
};

export function useMusicStoreBootstrap({
  setStore,
  setTrackIndex,
  setLoading,
  soundRef,
  storeRef,
}: Args): void {
  useEffect(() => {
    const loadingGuard = setTimeout(() => setLoading(false), 4000);
    let remoteTask: { cancel: () => void } | null = null;
    let localTask: { cancel: () => void } | null = null;
    let alive = true;

    void (async () => {
      setLoading(true);
      try {
        const audioModeWarmup = Promise.race([
          configureShellAudioMode(),
          new Promise<void>((resolve) => setTimeout(resolve, 1200)),
        ]);
        const bundledStore = getBundledMusicCompanionStore();
        setStore(bundledStore);
        if (isMobileBundledOnly()) {
          const tracks = enrichPlaybackTracks(bundledStore, getAskBibleBaseUrl());
          setTrackIndex(resolveSessionDefaultTrackIndex(tracks));
          await audioModeWarmup;
          return;
        }
        void audioModeWarmup;

        localTask = InteractionManager.runAfterInteractions(() => {
          void (async () => {
            if (!alive) return;
            try {
              await hydrateMusicResourcePackState();
              if (!alive) return;
              const syncedStore = await readSyncedMusicCompanionStore();
              const cachedStore = await readCachedMusicCompanionStore();
              const localStore =
                syncedStore && hasAtLeastBundledTracks(syncedStore, bundledStore)
                  ? syncedStore
                  : cachedStore && hasAtLeastBundledTracks(cachedStore, bundledStore)
                    ? cachedStore
                    : bundledStore;
              if (!alive) return;
              if (localStore !== bundledStore) {
                setStore(localStore);
              }

              remoteTask = InteractionManager.runAfterInteractions(() => {
                void (async () => {
                  if (!alive) return;
                  if (!(await isNetworkAvailable())) return;
                  try {
                    const remote = await fetchMusicCompanionStoreFromRemote();
                    if (!alive) return;
                    if (!remote || !hasAtLeastBundledTracks(remote, bundledStore)) return;
                    if (remote !== storeRef.current) {
                      setStore(remote);
                    }
                    await writeCachedMusicCompanionStore(remote);
                  } catch {
                    /* 离线或超时：保留已应用的本地曲库 */
                  }
                })();
              });
            } catch {
              /* 本地曲库 hydrate 失败：保留内置曲库 */
            }
          })();
        });
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      clearTimeout(loadingGuard);
      alive = false;
      localTask?.cancel();
      remoteTask?.cancel();
      const sound = soundRef.current;
      soundRef.current = null;
      if (sound) void safeStopAndUnloadSound(sound);
    };
  }, [setStore, setTrackIndex, setLoading, soundRef, storeRef]);
}
