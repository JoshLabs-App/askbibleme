import { useEffect, useState } from "react";
import { Platform } from "react-native";
import {
  useBundledOnlyTrackIndexGuard,
  useMusicCatalogActions,
  useMusicResumeHydration,
  useMusicStoreBootstrap,
  useWarmCalmBundledTrack,
  useAutoMusicPackDownload,
} from "./musicStoreCatalog";
import { logStartupTiming } from "../debug/startupTiming";
import type { MusicPlaybackRefs } from "./useMusicPlaybackRefs";
import type { MusicCompanionStore, PlaybackTrack } from "./types";

type Args = {
  refs: MusicPlaybackRefs;
  tracks: PlaybackTrack[];
  trackIndex: number;
  setStore: (store: MusicCompanionStore) => void;
  setTrackIndex: (index: number) => void;
  setLoading: (loading: boolean) => void;
  setMusicCurrentSec: (sec: number) => void;
  setMusicDurationSec: (sec: number) => void;
  setMusicCatalogUpdateAvailable: (available: boolean) => void;
};

export function useMusicPlaybackCatalogLifecycle({
  refs,
  tracks,
  trackIndex,
  setStore,
  setTrackIndex,
  setLoading,
  setMusicCurrentSec,
  setMusicDurationSec,
  setMusicCatalogUpdateAvailable,
}: Args) {
  const [catalogReady, setCatalogReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(
      () => setCatalogReady(true),
      Platform.OS === "android" ? 0 : 2500,
    );
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!catalogReady) return;
    logStartupTiming("music", "catalog_ready");
  }, [catalogReady]);

  useMusicStoreBootstrap({
    enabled: catalogReady,
    setStore,
    setTrackIndex,
    setLoading,
    soundRef: refs.soundRef,
    preloadedMusicSoundRef: refs.preloadedMusicSoundRef,
    preloadedMusicSoundWorkRef: refs.preloadedMusicSoundWorkRef,
    storeRef: refs.storeRef,
  });
  useAutoMusicPackDownload({ enabled: catalogReady, setStore, setTrackIndex });
  useBundledOnlyTrackIndexGuard(tracks, trackIndex, setTrackIndex, catalogReady);
  useWarmCalmBundledTrack(tracks, catalogReady);

  const { checkMusicCatalogUpdate, downloadMusicCatalogUpdate } = useMusicCatalogActions({
    storeRef: refs.storeRef,
    trackIndexRef: refs.trackIndexRef,
    tracks,
    latestRemoteMusicStoreRef: refs.latestRemoteMusicStoreRef,
    setStore,
    setTrackIndex,
    setMusicCatalogUpdateAvailable,
  });

  useMusicResumeHydration({
    enabled: catalogReady,
    tracks,
    playbackResumeHydratedRef: refs.playbackResumeHydratedRef,
    resumeTrackIdRef: refs.resumeTrackIdRef,
    resumePositionSecRef: refs.resumePositionSecRef,
    lastMusicProgressSecRef: refs.lastMusicProgressSecRef,
    setTrackIndex,
    setMusicCurrentSec,
    setMusicDurationSec,
  });

  return { checkMusicCatalogUpdate, downloadMusicCatalogUpdate };
}
