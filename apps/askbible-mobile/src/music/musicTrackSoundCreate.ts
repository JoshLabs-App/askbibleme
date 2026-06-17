import { Audio } from "expo-av";
import type { AVPlaybackSource } from "expo-av";
import { shellSoundDownloadFirst } from "../audio/shellAudioMode";
import {
  logShellSoundError,
  safeGetSoundStatus,
  safePlaySound,
  safeStopAndUnloadSound,
} from "../audio/safeShellSound";
import { createMusicPlaybackStatusHandler } from "./musicPlaybackStatus";
import type { MusicPlayTrackBridge } from "./musicPlaybackBridges";
import type { PlaybackTrack } from "./types";
import { applyMusicTrackStartPosition } from "./musicTrackStartPosition";

type CreateArgs = {
  bridge: MusicPlayTrackBridge;
  tracks: PlaybackTrack[];
  track: PlaybackTrack;
  avSource: AVPlaybackSource;
  generation: number;
  epoch: number;
  soundId: number;
  syncPlayingState: (playing: boolean) => void;
  setPlaying: (playing: boolean) => void;
  setMusicCurrentSec: (sec: number) => void;
  setMusicDurationSec: (sec: number) => void;
  persistMusicResume: (trackId: string, positionSec: number) => void | Promise<void>;
};

export type CreatedMusicTrackSound =
  | { ok: true; sound: Audio.Sound }
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
    syncPlayingState,
    setPlaying,
    setMusicCurrentSec,
    setMusicDurationSec,
    persistMusicResume,
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
  try {
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
    try {
      await sound.setIsMutedAsync(false);
      await sound.setVolumeAsync(musicGainRef.current);
    } catch {
      /* ignore volume prep failures */
    }
    const loadedStatus = await safeGetSoundStatus(sound);
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
    const ok = await safePlaySound(sound);
    if (!ok) {
      syncPlayingState(false);
      await safeStopAndUnloadSound(sound);
      return { ok: false, stale: false, failedTrackId: track.id };
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

  return { ok: true, sound };
}
