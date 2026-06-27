import {
  useBundledOnlyTrackIndexGuard,
  useMusicCatalogActions,
  useMusicResumeHydration,
  useMusicStoreBootstrap,
  useWarmCalmBundledTrack,
  useAutoMusicPackDownload,
} from "./musicStoreCatalog";
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
  useMusicStoreBootstrap({
    setStore,
    setTrackIndex,
    setLoading,
    soundRef: refs.soundRef,
    storeRef: refs.storeRef,
  });
  useAutoMusicPackDownload({ setStore, setTrackIndex });
  useBundledOnlyTrackIndexGuard(tracks, trackIndex, setTrackIndex);
  useWarmCalmBundledTrack(tracks);

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
