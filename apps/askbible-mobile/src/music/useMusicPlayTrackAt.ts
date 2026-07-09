import { Audio } from "expo-av";
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
import type { MusicRepeatMode } from "./musicPlaybackTypes";
import type { PlaybackTrack } from "./types";
import type { MusicPlaybackRefs } from "./useMusicPlaybackRefs";
import { releaseScriptureShellForMusic } from "./scripturePlaybackPriority";

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
  musicRepeatModeRef: MusicPlaybackRefs["musicRepeatModeRef"];
  stopScripturePlayback: () => Promise<void>;
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
  musicRepeatModeRef,
  stopScripturePlayback,
}: Args) {
  const { playTrackGenerationRef, storeRef, failedTrackIdsRef, playTrackAtRef, playbackModeRef } =
    bridge;

  return useCallback(
    async (index: number, opts?: { autoPlay?: boolean }) => {
      if (tracks.length === 0) return false;
      await releaseScriptureShellForMusic(playbackModeRef, stopScripturePlayback);
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
        musicRepeatModeRef,
        setPlaying,
      });
      if (!prepared.ok) return false;

      let preloadedSound: Audio.Sound | null = null;
      let preloadedStatus: import("expo-av").AVPlaybackStatus | null = null;
      const preloaded = bridge.preloadedMusicSoundRef.current;
      if (preloaded?.trackId === prepared.track.id) {
        preloadedSound = preloaded.sound;
        preloadedStatus = preloaded.status;
        bridge.preloadedMusicSoundRef.current = null;
      } else {
        const pendingPreload = bridge.preloadedMusicSoundWorkRef.current;
        if (pendingPreload?.trackId === prepared.track.id) {
          const ready = await pendingPreload.promise;
          if (ready?.trackId === prepared.track.id) {
            bridge.preloadedMusicSoundWorkRef.current = null;
            preloadedSound = ready.sound;
            preloadedStatus = ready.status;
          }
        }
      }

      endMusicSession();
      const loaded: LoadedMusicTrack = await loadAndStartMusicTrackSound({
        bridge,
        tracks,
        track: prepared.track,
        index: prepared.index,
        avSource: prepared.avSource,
        generation,
        shouldPlay: opts?.autoPlay !== false,
        unloadCurrent,
        persistMusicResume,
        syncPlayingState,
        setPlaying,
        setTrackIndex,
        setPlaybackMode,
        setMusicCurrentSec,
        setMusicDurationSec,
        preloadedSound,
        preloadedStatus,
      });
      if (loaded.ok) return true;
      if (loaded.stale) return false;
      scheduleMusicTrackPlayFallback({
        tracks,
        index: prepared.index,
        failedTrackIdsRef,
        playTrackAtRef,
        setPlaying,
        failedTrackId: loaded.failedTrackId,
      });
      return false;
    },
    [
      bridge,
      cacheMusicTrackInBackground,
      downloadMusicTrackAt,
      musicRepeatModeRef,
      endMusicSession,
      failedTrackIdsRef,
      persistMusicResume,
      playTrackAtRef,
      playTrackGenerationRef,
      playbackModeRef,
      setMusicCurrentSec,
      setMusicDurationSec,
      setPlaybackMode,
      setPlaying,
      setTrackIndex,
      stopScripturePlayback,
      storeRef,
      syncPlayingState,
      tracks,
      unloadCurrent,
    ],
  );
}
