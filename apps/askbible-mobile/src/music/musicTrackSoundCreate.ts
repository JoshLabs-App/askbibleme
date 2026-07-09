import { Audio } from "expo-av";
import type { AVPlaybackSource } from "expo-av";
import type { AVPlaybackStatus } from "expo-av";
import { configureShellAudioMode, shellSoundDownloadFirst } from "../audio/shellAudioMode";
import {
  logShellSoundError,
  safeStopAndUnloadSound,
} from "../audio/safeShellSound";
import { syncShellMediaSessionExplicit } from "../audio/shellMediaControls";
import { createMusicPlaybackStatusHandler } from "./musicPlaybackStatus";
import type { MusicPlayTrackBridge } from "./musicPlaybackBridges";
import type { PlaybackTrack } from "./types";
import { applyMusicTrackStartPosition } from "./musicTrackStartPosition";
import { resolveCalmLoopProfile } from "./musicCalmPlayback";

type CreateArgs = {
  bridge: MusicPlayTrackBridge;
  tracks: PlaybackTrack[];
  track: PlaybackTrack;
  avSource: AVPlaybackSource;
  generation: number;
  epoch: number;
  soundId: number;
  shouldPlay?: boolean;
  syncPlayingState: (playing: boolean) => void;
  setPlaying: (playing: boolean) => void;
  setMusicCurrentSec: (sec: number) => void;
  setMusicDurationSec: (sec: number) => void;
  persistMusicResume: (trackId: string, positionSec: number) => void | Promise<void>;
  preloadedSound?: Audio.Sound | null;
  preloadedStatus?: AVPlaybackStatus | null;
};

export type CreatedMusicTrackSound =
  | { ok: true; sound: Audio.Sound; status: AVPlaybackStatus }
  | { ok: false; stale: true }
  | { ok: false; stale: false; failedTrackId: string };

export async function createAndPlayMusicTrackSound(args: CreateArgs): Promise<CreatedMusicTrackSound> {
  const {
    bridge,
    tracks,
    track,
    avSource,
    generation,
    epoch,
    soundId,
    shouldPlay = true,
    syncPlayingState,
    setPlaying,
    setMusicCurrentSec,
    setMusicDurationSec,
    persistMusicResume,
    preloadedSound = null,
    preloadedStatus = null,
  } = args;

  const {
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
    playTrackAtRef,
    resumeTrackIdRef,
    resumePositionSecRef,
    playTrackGenerationRef,
  } = bridge;

  let sound: Audio.Sound;
  let loadedStatus: AVPlaybackStatus | null = null;
  try {
    const attachHandler = async (target: Audio.Sound) => {
      try {
        await target.setOnPlaybackStatusUpdate(
          createMusicPlaybackStatusHandler({
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
            playTrackAtRef,
            syncPlayingState,
            setPlaying,
            setMusicCurrentSec,
            setMusicDurationSec,
            persistMusicResume,
          }),
        );
      } catch {
        /* ignore handler attach failures */
      }
    };

    let reusePreloaded = preloadedSound;
    if (reusePreloaded) {
      sound = reusePreloaded;
      await attachHandler(sound);
      loadedStatus = preloadedStatus ?? (await sound.getStatusAsync());
    }
    if (!reusePreloaded) {
      const created = await Audio.Sound.createAsync(
        avSource,
        {
          shouldPlay: false,
          progressUpdateIntervalMillis: 250,
          volume: musicGainRef.current,
          isMuted: false,
        },
        createMusicPlaybackStatusHandler({
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
          playTrackAtRef,
          syncPlayingState,
          setPlaying,
          setMusicCurrentSec,
          setMusicDurationSec,
          persistMusicResume,
        }),
        shellSoundDownloadFirst(avSource),
      );
      sound = created.sound;
      loadedStatus = created.status;
    } else {
      // `reusePreloaded` still points to a loaded sound.
      sound = reusePreloaded;
    }
    if (reusePreloaded && musicGainRef.current !== 1) {
      try {
        await Promise.all([sound.setIsMutedAsync(false), sound.setVolumeAsync(musicGainRef.current)]);
      } catch {
        /* ignore volume prep failures */
      }
    }
    const resumeSecForTrackRaw =
      resumeTrackIdRef.current === track.id ? Math.max(0, resumePositionSecRef.current) : 0;
    const calmLoopProfileForTrack = resolveCalmLoopProfile(track);
    const needsStartPositionSync =
      resumeSecForTrackRaw > 0 || (calmLoopProfileForTrack?.startOffsetMs ?? 0) > 0;
    if (needsStartPositionSync) {
      await applyMusicTrackStartPosition({
        sound,
        track,
        resumeTrackIdRef,
        resumePositionSecRef,
        lastMusicProgressSecRef,
        setMusicCurrentSec,
        setMusicDurationSec,
        persistMusicResume,
        loadedStatus,
      });
    } else {
      lastMusicProgressSecRef.current = -1;
      setMusicCurrentSec(0);
      if (track.durationSec != null && Number.isFinite(track.durationSec)) {
        setMusicDurationSec(Math.max(0, track.durationSec));
      }
    }
    if (shouldPlay) {
      try {
        await sound.playAsync();
      } catch (err) {
        try {
          await configureShellAudioMode();
          await sound.playAsync();
        } catch (retryErr) {
          logShellSoundError("play-retry", retryErr);
          logShellSoundError("play", err);
          syncPlayingState(false);
          await safeStopAndUnloadSound(sound);
          return { ok: false, stale: false, failedTrackId: track.id };
        }
      }
      if (loadedStatus?.isLoaded) {
        syncShellMediaSessionExplicit({
          title: track.title,
          artist: track.artist,
          album: track.album,
          assetUri: track.src,
          artworkUri: track.artworkUri,
          durationSec: loadedStatus.durationMillis
            ? loadedStatus.durationMillis / 1000
            : track.durationSec ?? 0,
          positionSec: loadedStatus.positionMillis / 1000,
          playing: true,
        });
      }
    }
    if (generation !== playTrackGenerationRef.current) {
      await sound.unloadAsync();
      return { ok: false, stale: true };
    }
  } catch (err) {
    logShellSoundError("playTrackAt", err);
    return { ok: false, stale: false, failedTrackId: track.id };
  }

  if (epoch !== playbackEpochRef.current || soundId !== activeSoundIdRef.current) {
    await sound.unloadAsync();
    return { ok: false, stale: true };
  }

  return { ok: true, sound, status: loadedStatus ?? (await sound.getStatusAsync()) };
}
