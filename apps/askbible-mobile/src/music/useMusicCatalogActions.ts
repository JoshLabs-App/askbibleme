import { useCallback, type MutableRefObject } from "react";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import {
  checkMusicResourcePackUpdate,
  ensureMusicResourcePackSync,
  readSyncedMusicCompanionStore,
} from "../media/musicResourcePackSync";
import {
  fetchMusicCompanionStoreFromRemote,
  getBundledMusicCompanionStore,
  isMusicCompanionStoreDifferent,
  writeCachedMusicCompanionStore,
} from "./fetchMusicCompanion";
import { hasAtLeastBundledTracks } from "./musicStoreHelpers";
import type { MusicCompanionStore, PlaybackTrack } from "./types";

type Args = {
  storeRef: MutableRefObject<MusicCompanionStore | null>;
  trackIndexRef: MutableRefObject<number>;
  tracks: PlaybackTrack[];
  latestRemoteMusicStoreRef: MutableRefObject<MusicCompanionStore | null>;
  setStore: (store: MusicCompanionStore) => void;
  setTrackIndex: (index: number) => void;
  setMusicCatalogUpdateAvailable: (available: boolean) => void;
};

export function useMusicCatalogActions({
  storeRef,
  trackIndexRef,
  tracks,
  latestRemoteMusicStoreRef,
  setStore,
  setTrackIndex,
  setMusicCatalogUpdateAvailable,
}: Args) {
  const checkMusicCatalogUpdate = useCallback(async (): Promise<boolean> => {
    if (isMobileBundledOnly()) {
      latestRemoteMusicStoreRef.current = null;
      setMusicCatalogUpdateAvailable(false);
      return false;
    }
    const packCheck = await checkMusicResourcePackUpdate();
    if (packCheck.available) {
      setMusicCatalogUpdateAvailable(true);
      return true;
    }
    const bundled = getBundledMusicCompanionStore();
    const current = storeRef.current ?? bundled;
    const remote = await fetchMusicCompanionStoreFromRemote();
    if (!remote || !hasAtLeastBundledTracks(remote, bundled)) {
      latestRemoteMusicStoreRef.current = null;
      setMusicCatalogUpdateAvailable(false);
      return false;
    }
    const available = isMusicCompanionStoreDifferent(remote, current);
    latestRemoteMusicStoreRef.current = available ? remote : null;
    setMusicCatalogUpdateAvailable(available);
    return available;
  }, [latestRemoteMusicStoreRef, setMusicCatalogUpdateAvailable, storeRef]);

  const downloadMusicCatalogUpdate = useCallback(async (): Promise<boolean> => {
    if (isMobileBundledOnly()) {
      latestRemoteMusicStoreRef.current = null;
      setMusicCatalogUpdateAvailable(false);
      return false;
    }
    const bundled = getBundledMusicCompanionStore();
    const current = storeRef.current ?? bundled;
    let remote = latestRemoteMusicStoreRef.current;
    if (!remote || !isMusicCompanionStoreDifferent(remote, current)) {
      remote = await fetchMusicCompanionStoreFromRemote();
    }
    const synced = await ensureMusicResourcePackSync({ force: true });
    const syncedStore = (await readSyncedMusicCompanionStore()) ?? remote;
    const nextStore =
      syncedStore && hasAtLeastBundledTracks(syncedStore, bundled)
        ? syncedStore
        : remote && hasAtLeastBundledTracks(remote, bundled)
          ? remote
          : null;
    if (!synced && !nextStore) {
      latestRemoteMusicStoreRef.current = null;
      setMusicCatalogUpdateAvailable(false);
      return false;
    }
    if (nextStore) {
      const currentTrackId = tracks[trackIndexRef.current]?.id ?? "";
      const nextTrackIndex = nextStore.audioTracks.findIndex((x) => x.id === currentTrackId);
      setStore(nextStore);
      storeRef.current = nextStore;
      setTrackIndex(nextTrackIndex >= 0 ? nextTrackIndex : 0);
      await writeCachedMusicCompanionStore(nextStore);
    }
    latestRemoteMusicStoreRef.current = null;
    setMusicCatalogUpdateAvailable(false);
    return synced || Boolean(nextStore);
  }, [
    latestRemoteMusicStoreRef,
    setMusicCatalogUpdateAvailable,
    setStore,
    setTrackIndex,
    storeRef,
    trackIndexRef,
    tracks,
  ]);

  return { checkMusicCatalogUpdate, downloadMusicCatalogUpdate };
}
