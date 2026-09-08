import type { AudioPlayer } from "expo-audio";
import type { LegacyPlaybackStatus } from "../audio/legacyPlaybackStatus";
import { useCallback } from "react";
import type { MusicPlayTrackBridge } from "./musicPlaybackBridges";
import {
  prepareMusicTrackForPlay,
  scheduleMusicTrackPlayFallback,
} from "./musicTrackPlayPrepare";
import type { MusicRepeatMode } from "./musicPlaybackTypes";
import type { PlaybackTrack } from "./types";
import type { MusicPlaybackRefs } from "./useMusicPlaybackRefs";
import { configureShellAudioMode } from "../audio/shellAudioMode";
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
  setTrackIndex,
  setPlaybackMode,
  setMusicCurrentSec,
  setMusicDurationSec,
  downloadMusicTrackAt,
  cacheMusicTrackInBackground,
  musicRepeatModeRef,
  stopScripturePlayback,
}: Args) {
  const { playTrackGenerationRef, storeRef, failedTrackIdsRef, playTrackAtRef } = bridge;

  return useCallback(
    async (index: number, opts?: { autoPlay?: boolean }) => {
      if (tracks.length === 0) return false;
      if (opts?.autoPlay !== false) {
        yieldAmbientIfVerseAndAmbientOpen();
      }
      await releaseScriptureShellForMusic(stopScripturePlayback);
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
        autoPlay: opts?.autoPlay,
      });
      if (!prepared.ok) return false;

      /** 音乐一律走原生播放器；expo-av 那条载入路径已删。 */
      {
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
          setMusicCurrentSec,
          setMusicDurationSec,
          persistMusicResume,
          trackIndexRef: bridge.trackIndexRef,
          lastMusicProgressSecRef: bridge.lastMusicProgressSecRef,
        });
        if (ok) return true;
        scheduleMusicTrackPlayFallback({
          tracks,
          index: prepared.index,
          failedTrackIdsRef,
          playTrackAtRef,
          failedTrackId: prepared.track.id,
          autoPlay: opts?.autoPlay,
        });
        return false;
      }

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
      setMusicCurrentSec,
      setMusicDurationSec,
      setPlaybackMode,
      setTrackIndex,
      stopScripturePlayback,
      storeRef,
      tracks,
      unloadCurrent,
    ],
  );
}
