import { useCallback } from "react";
import type { MusicPlayTrackBridge } from "./musicPlaybackBridges";
import {
  loadAndStartMusicTrackSound,
  type LoadedMusicTrack,
} from "./musicTrackSoundLoad";
import {
  prepareMusicTrackForPlay,
  scheduleMusicTrackPlayFallback,
} from "./musicTrackPlayPrepare";
import type { PlaybackTrack } from "./types";

type PlaybackMode = "music" | "scripture";

type Args = {
  bridge: MusicPlayTrackBridge;
  tracks: PlaybackTrack[];
  unloadCurrent: () => Promise<void>;
  endMusicSession: () => void;
  persistMusicResume: (trackId: string, positionSec: number) => void | Promise<void>;
  syncPlayingState: (playing: boolean) => void;
  setPlaying: (playing: boolean) => void;
  setTrackIndex: (index: number) => void;
  setPlaybackMode: (mode: PlaybackMode) => void;
  setMusicCurrentSec: (sec: number) => void;
  setMusicDurationSec: (sec: number) => void;
  downloadMusicTrackAt: (index: number) => Promise<boolean>;
  cacheMusicTrackInBackground: (trackId: string) => void;
};

export function useMusicPlayTrackAt({
  bridge,
  tracks,
  unloadCurrent,
  endMusicSession,
  persistMusicResume,
  syncPlayingState,
  setPlaying,
  setTrackIndex,
  setPlaybackMode,
  setMusicCurrentSec,
  setMusicDurationSec,
  downloadMusicTrackAt,
  cacheMusicTrackInBackground,
}: Args) {
  const { playTrackGenerationRef, storeRef, failedTrackIdsRef, playTrackAtRef } = bridge;

  return useCallback(
    async (index: number) => {
      if (tracks.length === 0) return;
      const generation = ++playTrackGenerationRef.current;

      const prepared = await prepareMusicTrackForPlay({
        tracks,
        index,
        generation,
        playTrackGenerationRef,
        storeRef,
        failedTrackIdsRef,
        playTrackAtRef,
        downloadMusicTrackAt,
        cacheMusicTrackInBackground,
        setPlaying,
      });
      if (!prepared.ok) return;

      endMusicSession();
      const loaded: LoadedMusicTrack = await loadAndStartMusicTrackSound({
        bridge,
        tracks,
        track: prepared.track,
        index: prepared.index,
        avSource: prepared.avSource,
        generation,
        unloadCurrent,
        persistMusicResume,
        syncPlayingState,
        setPlaying,
        setTrackIndex,
        setPlaybackMode,
        setMusicCurrentSec,
        setMusicDurationSec,
      });
      if (loaded.ok || loaded.stale) return;
      scheduleMusicTrackPlayFallback({
        tracks,
        index: prepared.index,
        failedTrackIdsRef,
        playTrackAtRef,
        setPlaying,
        failedTrackId: loaded.failedTrackId,
      });
    },
    [
      bridge,
      cacheMusicTrackInBackground,
      downloadMusicTrackAt,
      endMusicSession,
      failedTrackIdsRef,
      persistMusicResume,
      playTrackAtRef,
      playTrackGenerationRef,
      setMusicCurrentSec,
      setMusicDurationSec,
      setPlaybackMode,
      setPlaying,
      setTrackIndex,
      storeRef,
      syncPlayingState,
      tracks,
      unloadCurrent,
    ],
  );
}
