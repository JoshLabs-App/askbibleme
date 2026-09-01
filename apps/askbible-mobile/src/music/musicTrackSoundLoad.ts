import { Audio } from "expo-av";
import type { AVPlaybackSource } from "expo-av";
import type { AVPlaybackStatus } from "expo-av";
import { configureShellAudioMode } from "../audio/shellAudioMode";
import type { MusicPlayTrackBridge } from "./musicPlaybackBridges";
import type { PlaybackTrack } from "./types";
import { persistMusicStoreSnapshot } from "./musicTrackStartPosition";
import { createAndPlayMusicTrackSound } from "./musicTrackSoundCreate";
import { clearScripturePlayingChapter } from "./scripturePlayingChapterStore";

type PlaybackMode = "music" | "scripture";

type LoadArgs = {
  bridge: MusicPlayTrackBridge;
  tracks: PlaybackTrack[];
  track: PlaybackTrack;
  index: number;
  avSource: AVPlaybackSource;
  generation: number;
  shouldPlay?: boolean;
  unloadCurrent: () => Promise<void>;
  persistMusicResume: (trackId: string, positionSec: number) => void | Promise<void>;
  syncPlayingState: (playing: boolean) => void;
  setPlaying: (playing: boolean) => void;
  setTrackIndex: (index: number) => void;
  setPlaybackMode: (mode: PlaybackMode) => void;
  setMusicCurrentSec: (sec: number) => void;
  setMusicDurationSec: (sec: number) => void;
  preloadedSound?: Audio.Sound | null;
  preloadedStatus?: AVPlaybackStatus | null;
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
    shouldPlay = true,
    unloadCurrent,
    persistMusicResume,
    syncPlayingState,
    setPlaying,
    setTrackIndex,
    setPlaybackMode,
    setMusicCurrentSec,
    setMusicDurationSec,
    preloadedSound = null,
    preloadedStatus = null,
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
      shouldPlay,
      syncPlayingState,
      setPlaying,
      setMusicCurrentSec,
      setMusicDurationSec,
    persistMusicResume,
    preloadedSound,
    preloadedStatus,
  });
  if (!created.ok) return created;

  const { sound } = created;
  const { status: readyStatus } = created;
  soundRef.current = sound;
  setTrackIndex(index);
  setPlaybackMode("music");
  playbackModeRef.current = "music";
  scriptureSrcRef.current = null;
  clearScripturePlayingChapter();
  musicSoundActivatedAtRef.current = Date.now();
  syncPlayingState(shouldPlay ? true : Boolean(readyStatus.isLoaded && readyStatus.isPlaying));
  failedTrackIdsRef.current.delete(track.id.trim());
  resumeTrackIdRef.current = track.id;
  resumePositionSecRef.current = 0;
  if (shouldPlay) {
    musicSessionRef.current = { trackId: track.id, startedAt: Date.now() };
  } else {
    musicSessionRef.current = null;
  }
  void persistMusicStoreSnapshot(storeRef);

  return { ok: true, sound, index };
}
