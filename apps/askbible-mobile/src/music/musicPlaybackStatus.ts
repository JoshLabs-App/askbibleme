import type { AudioPlayer } from "expo-audio";
import type { LegacyPlaybackStatus } from "../audio/legacyPlaybackStatus";
import type { MutableRefObject } from "react";
import { safePauseSound } from "../audio/safeShellSound";
import { getShellMusicWantPlaying } from "../audio/shellMusicWantPlaying";
import { isShellNativeAudioTakeover } from "../audio/shellNativeAudioTakeover";
import { refreshShellMediaSession } from "../audio/shellMediaSessionPayload";
import {
  MUSIC_PROGRESS_UI_INTERVAL_SEC,
  shouldEmitPlaybackSecUpdate,
} from "./musicPlaybackProgress";
import {
  handleMusicCalmLoopTrimStatus,
  musicDurationSecWithCalmTrim,
} from "./musicCalmLoopPlaybackStatus";
import { handleMusicTrackDidJustFinish } from "./musicTrackEndPlaybackStatus";
import type { MusicRepeatMode } from "./musicPlaybackTypes";
import type { PlaybackTrack } from "./types";

type PlaybackMode = "music" | "scripture";

export type MusicPlaybackStatusHandlerArgs = {
  soundId: number;
  epoch: number;
  track: PlaybackTrack;
  tracks: PlaybackTrack[];
  activeSoundIdRef: MutableRefObject<number>;
  playbackEpochRef: MutableRefObject<number>;
  playbackModeRef: MutableRefObject<PlaybackMode>;
  soundRef: MutableRefObject<AudioPlayer | null>;
  musicMaxProgressMsRef: MutableRefObject<number>;
  musicSoundActivatedAtRef: MutableRefObject<number>;
  calmLoopTransitioningRef: MutableRefObject<boolean>;
  lastMusicProgressSecRef: MutableRefObject<number>;
  lastMusicPersistMsRef: MutableRefObject<number>;
  musicRepeatModeRef: MutableRefObject<MusicRepeatMode>;
  musicGainRef: MutableRefObject<number>;
  trackIndexRef: MutableRefObject<number>;
  playingStateRef: MutableRefObject<boolean>;
  playTrackAtRef: MutableRefObject<(index: number, opts?: { autoPlay?: boolean }) => Promise<boolean>>;
  syncPlayingState: (playing: boolean) => void;
  setPlaying: (playing: boolean) => void;
  setMusicCurrentSec: (sec: number) => void;
  setMusicDurationSec: (sec: number) => void;
  persistMusicResume: (trackId: string, positionSec: number) => void | Promise<void>;
};

export function createMusicPlaybackStatusHandler(
  args: MusicPlaybackStatusHandlerArgs,
): (status: LegacyPlaybackStatus) => void {
  const {
    soundId,
    epoch,
    track,
    tracks,
    activeSoundIdRef,
    playbackEpochRef,
    playbackModeRef,
    soundRef,
    musicMaxProgressMsRef,
    musicSoundActivatedAtRef,
    calmLoopTransitioningRef,
    lastMusicProgressSecRef,
    lastMusicPersistMsRef,
    musicRepeatModeRef,
    musicGainRef,
    trackIndexRef,
    playingStateRef,
    playTrackAtRef,
    syncPlayingState,
    setPlaying,
    setMusicCurrentSec,
    setMusicDurationSec,
    persistMusicResume,
  } = args;

  return (status: LegacyPlaybackStatus) => {
    if (soundId !== activeSoundIdRef.current || epoch !== playbackEpochRef.current) return;
    if (!status.isLoaded) return;
    if (status.positionMillis > musicMaxProgressMsRef.current) {
      musicMaxProgressMsRef.current = status.positionMillis;
    }
    // 用户意图以 shellMusicWantPlaying 为准（与 UI playing / 系统 isPlaying 解耦）。
    const wantPlaying = getShellMusicWantPlaying() || playingStateRef.current;
    const uiPlaying = wantPlaying ? status.isPlaying : false;
    if (!wantPlaying) {
      if (status.isPlaying && soundRef.current) {
        void safePauseSound(soundRef.current);
      }
      syncPlayingState(false);
    } else if (status.isPlaying) {
      syncPlayingState(true);
    }
    // wantPlaying && !isPlaying：系统锁屏/打断暂停 — 保持用户意图，留给 music interruption recovery 续播。
    // 切勿 syncPlayingState(false)，否则几分钟后 JS 挂起再无续播。
    if (playbackModeRef.current === "music") {
      const musicSec = status.positionMillis / 1000;
      const durationSec = musicDurationSecWithCalmTrim(
        track,
        status.durationMillis ?? undefined,
        musicRepeatModeRef.current,
      );
      const shouldRefreshSession =
        !uiPlaying ||
        shouldEmitPlaybackSecUpdate(
          lastMusicProgressSecRef,
          musicSec,
          MUSIC_PROGRESS_UI_INTERVAL_SEC,
        );
      if (shouldRefreshSession) {
        refreshShellMediaSession({
          // 短暂系统暂停时仍报 playing，避免锁屏控件把会话掐死。
          playing: wantPlaying,
          musicCurrentSec: musicSec,
          musicDurationSec: durationSec,
        });
      }
      if (shouldRefreshSession) {
        setMusicCurrentSec(musicSec);
      }
      setMusicDurationSec(durationSec);
      if (
        handleMusicCalmLoopTrimStatus({
          status,
          track,
          soundRef,
          musicRepeatModeRef,
          musicGainRef,
          calmLoopTransitioningRef,
          setPlaying,
        })
      ) {
        return;
      }
      const now = Date.now();
      if (now - lastMusicPersistMsRef.current > 1800 || !uiPlaying) {
        lastMusicPersistMsRef.current = now;
        void persistMusicResume(track.id, status.positionMillis / 1000);
      }
    }
    // iOS 原生引擎在播时，expo-av 已被 pause；偶发 didJustFinish 勿清 wantPlaying / 勿切下一曲。
    if (
      status.didJustFinish &&
      playbackModeRef.current === "music" &&
      !isShellNativeAudioTakeover()
    ) {
      handleMusicTrackDidJustFinish({
        status,
        track,
        tracks,
        soundRef,
        musicMaxProgressMsRef,
        musicSoundActivatedAtRef,
        calmLoopTransitioningRef,
        musicRepeatModeRef,
        musicGainRef,
        trackIndexRef,
        playTrackAtRef,
        syncPlayingState,
        setPlaying,
      });
    }
  };
}
