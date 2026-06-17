import { Audio } from "expo-av";
import type { AVPlaybackSource } from "expo-av";
import { configureShellAudioMode } from "../audio/shellAudioMode";
import { safeGetSoundStatus } from "../audio/safeShellSound";
import type { MusicPlayTrackBridge } from "./musicPlaybackBridges";
import type { PlaybackTrack } from "./types";
import { trackTelemetry } from "../telemetry/client";
import { persistMusicStoreSnapshot } from "./musicTrackStartPosition";
import { createAndPlayMusicTrackSound } from "./musicTrackSoundCreate";

type PlaybackMode = "music" | "scripture";

type LoadArgs = {
  bridge: MusicPlayTrackBridge;
  tracks: PlaybackTrack[];
  track: PlaybackTrack;
  index: number;
  avSource: AVPlaybackSource;
  generation: number;
  unloadCurrent: () => Promise<void>;
  persistMusicResume: (trackId: string, positionSec: number) => void | Promise<void>;
  syncPlayingState: (playing: boolean) => void;
  setPlaying: (playing: boolean) => void;
  setTrackIndex: (index: number) => void;
  setPlaybackMode: (mode: PlaybackMode) => void;
  setMusicCurrentSec: (sec: number) => void;
  setMusicDurationSec: (sec: number) => void;
};

export type LoadedMusicTrack =
  | { ok: true; sound: Audio.Sound; index: number }
  | { ok: false; stale: true }
  | { ok: false; stale: false; failedTrackId: string };

export async function loadAndStartMusicTrackSound(args: LoadArgs): Promise<LoadedMusicTrack> {
  const {
    bridge,
    tracks,
    track,
    index,
    avSource,
    generation,
    unloadCurrent,
    persistMusicResume,
    syncPlayingState,
    setPlaying,
    setTrackIndex,
    setPlaybackMode,
    setMusicCurrentSec,
    setMusicDurationSec,
  } = args;

  const {
    soundRef,
    activeSoundIdRef,
    playbackEpochRef,
    playbackModeRef,
    calmLoopTransitioningRef,
    lastMusicProgressSecRef,
    musicSoundActivatedAtRef,
    musicMaxProgressMsRef,
    failedTrackIdsRef,
    storeRef,
    scriptureSrcRef,
    musicSessionRef,
    playTrackGenerationRef,
    resumeTrackIdRef,
    resumePositionSecRef,
  } = bridge;

  calmLoopTransitioningRef.current = false;
  if (generation !== playTrackGenerationRef.current) return { ok: false, stale: true };
  await unloadCurrent();
  if (generation !== playTrackGenerationRef.current) return { ok: false, stale: true };
  await configureShellAudioMode();
  lastMusicProgressSecRef.current = -1;
  setMusicCurrentSec(0);
  setMusicDurationSec(0);

  const epoch = playbackEpochRef.current;
  const soundId = ++activeSoundIdRef.current;
  musicMaxProgressMsRef.current = 0;
  musicSoundActivatedAtRef.current = Date.now();

  const created = await createAndPlayMusicTrackSound({
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
  });
  if (!created.ok) return created;

  const { sound } = created;
  soundRef.current = sound;
  setTrackIndex(index);
  setPlaybackMode("music");
  playbackModeRef.current = "music";
  scriptureSrcRef.current = null;
  musicSoundActivatedAtRef.current = Date.now();
  const readyStatus = await safeGetSoundStatus(sound);
  syncPlayingState(Boolean(readyStatus?.isLoaded && readyStatus.isPlaying));
  failedTrackIdsRef.current.delete(track.id.trim());
  resumeTrackIdRef.current = track.id;
  resumePositionSecRef.current = 0;
  trackTelemetry("music_play", { track_id: track.id });
  musicSessionRef.current = { trackId: track.id, startedAt: Date.now() };
  void persistMusicStoreSnapshot(storeRef);

  return { ok: true, sound, index };
}
