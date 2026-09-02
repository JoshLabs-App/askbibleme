import { createAudioPlayer, type AudioPlayer, type AudioSource } from "expo-audio";
import { toLegacyPlaybackStatus, type LegacyPlaybackStatus } from "../audio/legacyPlaybackStatus";
import { waitForAudioPlayerLoaded } from "../audio/expoAudioPlayerReady";
import { configureShellAudioMode, shellSoundDownloadFirst } from "../audio/shellAudioMode";
import {
  logShellSoundError,
  safeStopAndUnloadSound,
} from "../audio/safeShellSound";
import { syncShellMediaSessionExplicit } from "../audio/shellMediaControls";
import {
  normalizeShellMusicFileUri,
  setShellMusicPlayableAssetUri,
} from "../audio/shellMusicPlayableAssetUri";
import { reshuffleShellMediaSceneArtwork } from "../audio/shellMediaSceneArtwork";
import { setShellMusicWantPlaying } from "../audio/shellMusicWantPlaying";
import { createMusicPlaybackStatusHandler } from "./musicPlaybackStatus";
import type { MusicPlayTrackBridge } from "./musicPlaybackBridges";
import type { PlaybackTrack } from "./types";
import { applyMusicTrackStartPosition } from "./musicTrackStartPosition";
import { resolveCalmLoopProfile } from "./musicCalmPlayback";

type CreateArgs = {
  bridge: MusicPlayTrackBridge;
  tracks: PlaybackTrack[];
  track: PlaybackTrack;
  avSource: AudioSource;
  generation: number;
  epoch: number;
  soundId: number;
  shouldPlay?: boolean;
  syncPlayingState: (playing: boolean) => void;
  setPlaying: (playing: boolean) => void;
  setMusicCurrentSec: (sec: number) => void;
  setMusicDurationSec: (sec: number) => void;
  persistMusicResume: (trackId: string, positionSec: number) => void | Promise<void>;
  preloadedSound?: AudioPlayer | null;
  preloadedStatus?: LegacyPlaybackStatus | null;
};

export type CreatedMusicTrackSound =
  | { ok: true; sound: AudioPlayer; status: LegacyPlaybackStatus }
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
    playingStateRef,
  } = bridge;

  let sound: AudioPlayer;
  let loadedStatus: LegacyPlaybackStatus | null = null;
  try {
    const attachHandler = (target: AudioPlayer) => {
      try {
        target.addListener("playbackStatusUpdate", (raw) => {
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
            playingStateRef,
            playTrackAtRef,
            syncPlayingState,
            setPlaying,
            setMusicCurrentSec,
            setMusicDurationSec,
            persistMusicResume,
          })(toLegacyPlaybackStatus(raw, target.volume, target.muted));
        });
      } catch {
        /* ignore handler attach failures */
      }
    };

    let reusePreloaded = preloadedSound;
    if (reusePreloaded) {
      sound = reusePreloaded;
      attachHandler(sound);
      loadedStatus = preloadedStatus ?? toLegacyPlaybackStatus(sound.currentStatus, sound.volume, sound.muted);
    }
    if (!reusePreloaded) {
      sound = createAudioPlayer(avSource, {
        updateInterval: 250,
        downloadFirst: shellSoundDownloadFirst(avSource),
      });
      sound.volume = musicGainRef.current;
      sound.muted = false;
      attachHandler(sound);
      const rawStatus = await waitForAudioPlayerLoaded(sound);
      loadedStatus = toLegacyPlaybackStatus(rawStatus, sound.volume, sound.muted);
    } else {
      // `reusePreloaded` still points to a loaded sound.
      sound = reusePreloaded;
    }
    if (reusePreloaded && musicGainRef.current !== 1) {
      try {
        sound.muted = false;
        sound.volume = musicGainRef.current;
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
      setShellMusicWantPlaying(true);
      playingStateRef.current = true;
      try {
        await configureShellAudioMode({ force: true });
        sound.muted = false;
        sound.volume = musicGainRef.current;
        sound.play();
      } catch (err) {
        try {
          await configureShellAudioMode({ force: true });
          sound.muted = false;
          sound.volume = musicGainRef.current;
          sound.play();
        } catch (retryErr) {
          logShellSoundError("play-retry", retryErr);
          logShellSoundError("play", err);
          setShellMusicWantPlaying(false);
          playingStateRef.current = false;
          syncPlayingState(false);
          await safeStopAndUnloadSound(sound);
          return { ok: false, stale: false, failedTrackId: track.id };
        }
      }
      try {
        sound.muted = false;
        sound.volume = musicGainRef.current;
        const after = toLegacyPlaybackStatus(sound.currentStatus, sound.volume, sound.muted);
        if (after.isLoaded && !after.isPlaying) {
          sound.play();
        }
      } catch {
        /* ignore post-play verify */
      }
      if (loadedStatus?.isLoaded) {
        // 优先实际可播 URI（file://）；Metro Debug 的 track.src 常是 http，原生无法接管。
        const playableUriRaw =
          typeof avSource === "object" &&
          avSource != null &&
          "uri" in avSource &&
          typeof (avSource as { uri?: unknown }).uri === "string"
            ? String((avSource as { uri: string }).uri).trim()
            : "";
        const playableUri = playableUriRaw
          ? normalizeShellMusicFileUri(playableUriRaw)
          : normalizeShellMusicFileUri(track.src || "");
        if (playableUri) setShellMusicPlayableAssetUri(playableUri);
        const artworkUri = await reshuffleShellMediaSceneArtwork();
        syncShellMediaSessionExplicit({
          title: track.title,
          artist: track.artist,
          album: track.album,
          assetUri: playableUri || track.src,
          artworkUri,
          durationSec: loadedStatus.durationMillis
            ? loadedStatus.durationMillis / 1000
            : track.durationSec ?? 0,
          positionSec: loadedStatus.positionMillis / 1000,
          playing: true,
          kind: "music",
        });
      }
    }
    if (generation !== playTrackGenerationRef.current) {
      sound.remove();
      return { ok: false, stale: true };
    }
  } catch (err) {
    logShellSoundError("playTrackAt", err);
    return { ok: false, stale: false, failedTrackId: track.id };
  }

  if (epoch !== playbackEpochRef.current || soundId !== activeSoundIdRef.current) {
    sound.remove();
    return { ok: false, stale: true };
  }

  return {
    ok: true,
    sound,
    status: loadedStatus ?? toLegacyPlaybackStatus(sound.currentStatus, sound.volume, sound.muted),
  };
}
