import type { AudioPlayer } from "expo-audio";
import type { LegacyPlaybackStatus } from "../audio/legacyPlaybackStatus";
import { useCallback } from "react";
import { isNativeMainTrackOs } from "../audio/shellNativeAudioTakeover";
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
import { configureShellAudioMode } from "../audio/shellAudioMode";
import { claimDefaultPreloadedMusicSound } from "./useMusicDefaultTrackPreload";
import { releaseScriptureShellForMusic } from "./scripturePlaybackPriority";
import { yieldAmbientIfVerseAndAmbientOpen } from "../home/homeGoldenVerseTwoSourceMutex";
import { startIosNativeMusicTrack } from "./startIosNativeMusicTrack";

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
      if (opts?.autoPlay !== false) {
        yieldAmbientIfVerseAndAmbientOpen();
      }
      await releaseScriptureShellForMusic(playbackModeRef, stopScripturePlayback);
      // 原生主轨勿先改 AudioMode（会污染系统会话）。
      if (!isNativeMainTrackOs() && opts?.autoPlay !== false) {
        await configureShellAudioMode({ force: true });
      }
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
        autoPlay: opts?.autoPlay,
      });
      if (!prepared.ok) return false;

      // iOS / Android：音乐只走原生播放器，不经 expo-av。
      if (isNativeMainTrackOs()) {
        const resumeSec =
          bridge.resumeTrackIdRef.current === prepared.track.id
            ? Math.max(0, bridge.resumePositionSecRef.current)
            : 0;
        const ok = await startIosNativeMusicTrack({
          tracks,
          track: prepared.track,
          index: prepared.index,
          positionSec: resumeSec,
          shouldPlay: opts?.autoPlay !== false,
          unloadCurrent,
          setTrackIndex,
          setPlaybackMode,
          setPlaying,
          setMusicCurrentSec,
          setMusicDurationSec,
          persistMusicResume,
          trackIndexRef: bridge.trackIndexRef,
          playbackModeRef,
          playingStateRef: bridge.playingStateRef,
          lastMusicProgressSecRef: bridge.lastMusicProgressSecRef,
        });
        if (ok) return true;
        scheduleMusicTrackPlayFallback({
          tracks,
          index: prepared.index,
          failedTrackIdsRef,
          playTrackAtRef,
          setPlaying,
          failedTrackId: prepared.track.id,
          autoPlay: opts?.autoPlay,
        });
        return false;
      }

      let preloadedSound: AudioPlayer | null = null;
      let preloadedStatus: LegacyPlaybackStatus | null = null;
      const claimed = claimDefaultPreloadedMusicSound(prepared.track.id);
      if (claimed) {
        preloadedSound = claimed.sound;
        preloadedStatus = claimed.status;
        bridge.preloadedMusicSoundRef.current = null;
        bridge.preloadedMusicSoundWorkRef.current = null;
      } else {
        const preloaded = bridge.preloadedMusicSoundRef.current;
        if (preloaded?.trackId === prepared.track.id) {
          preloadedSound = preloaded.sound;
          preloadedStatus = preloaded.status;
          bridge.preloadedMusicSoundRef.current = null;
          claimDefaultPreloadedMusicSound(prepared.track.id);
        } else {
          const pendingPreload = bridge.preloadedMusicSoundWorkRef.current;
          if (pendingPreload?.trackId === prepared.track.id) {
            const ready = await pendingPreload.promise;
            const taken = ready ? claimDefaultPreloadedMusicSound(ready.trackId) : null;
            if (taken) {
              bridge.preloadedMusicSoundWorkRef.current = null;
              preloadedSound = taken.sound;
              preloadedStatus = taken.status;
            } else if (ready?.trackId === prepared.track.id) {
              bridge.preloadedMusicSoundWorkRef.current = null;
              preloadedSound = ready.sound;
              preloadedStatus = ready.status;
            }
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
        autoPlay: opts?.autoPlay,
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
