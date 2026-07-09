import { useCallback } from "react";
import { configureShellAudioMode } from "../audio/shellAudioMode";
import {
  logShellSoundError,
  safeGetSoundStatus,
  safePauseSound,
  safePlaySound,
} from "../audio/safeShellSound";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { fadeSoundVolume, shouldUseCalmAlbumFade } from "./musicCalmPlayback";
import type { MusicPlayTrackBridge } from "./musicPlaybackBridges";
import { isTrackPlayable, resolveShellMusicPlayIndex } from "./trackArtwork";
import type { PlaybackTrack } from "./types";
import { releaseScriptureShellForMusic } from "./scripturePlaybackPriority";

type Args = {
  bridge: MusicPlayTrackBridge;
  tracks: PlaybackTrack[];
  trackIndex: number;
  playTrackAt: (index: number, opts?: { autoPlay?: boolean }) => Promise<boolean>;
  persistMusicResume: (trackId: string, positionSec: number) => void | Promise<void>;
  setPlaying: (playing: boolean) => void;
  setMusicCurrentSec: (sec: number) => void;
  setMusicDurationSec: (sec: number) => void;
  stopScripturePlayback: () => Promise<void>;
};

export function useMusicTogglePlayMusic({
  bridge,
  tracks,
  trackIndex,
  playTrackAt,
  persistMusicResume,
  setPlaying,
  setMusicCurrentSec,
  setMusicDurationSec,
  stopScripturePlayback,
}: Args) {
  const { soundRef, playbackModeRef, trackIndexRef, lastMusicProgressSecRef, musicGainRef } = bridge;

  return useCallback(async () => {
    if (tracks.length === 0) return;
    const playIdx = resolveShellMusicPlayIndex(tracks, trackIndexRef.current);
    const playTrack = tracks[playIdx];
    if (!playTrack || !isTrackPlayable(playTrack)) return;
    if (isMobileBundledOnly() && !playTrack.localReady) return;
    try {
      await configureShellAudioMode();
      const sound = soundRef.current;
      const st = sound ? await safeGetSoundStatus(sound) : null;
      const currentTrack = tracks[trackIndexRef.current] ?? null;
      const useCalmFade = shouldUseCalmAlbumFade(currentTrack);
      const loadedTrack = tracks[trackIndexRef.current];
      const sameLoadedTrack = loadedTrack?.id === playTrack.id;

      if (playbackModeRef.current !== "music" || !sound || !st?.isLoaded || !sameLoadedTrack) {
        await releaseScriptureShellForMusic(playbackModeRef, stopScripturePlayback);
        await playTrackAt(playIdx);
        return;
      }

      if (st.isPlaying) {
        if (useCalmFade) {
          const fromVolume = typeof st.volume === "number" ? st.volume : musicGainRef.current;
          await fadeSoundVolume(sound, fromVolume, 0, 0);
        }
        await safePauseSound(sound);
        if (useCalmFade) {
          try {
            await sound.setVolumeAsync(musicGainRef.current);
          } catch {
            /* ignore restore failures */
          }
        }
        setPlaying(false);
        await persistMusicResume(tracks[trackIndex]?.id ?? "", st.positionMillis / 1000);
        return;
      }

      if (useCalmFade) {
        try {
          await sound.setVolumeAsync(0);
        } catch {
          /* ignore pre-play fade setup failures */
        }
      }
      const ok = await safePlaySound(sound);
      if (!ok) {
        await releaseScriptureShellForMusic(playbackModeRef, stopScripturePlayback);
        await playTrackAt(playIdx);
        return;
      }
      if (useCalmFade) {
        await fadeSoundVolume(sound, 0, musicGainRef.current, 0);
      }
      setPlaying(true);
      if (st.durationMillis != null) {
        lastMusicProgressSecRef.current = st.positionMillis / 1000;
        setMusicCurrentSec(st.positionMillis / 1000);
        setMusicDurationSec(st.durationMillis / 1000);
      }
    } catch (err) {
      logShellSoundError("togglePlayMusic", err);
      setPlaying(false);
    }
  }, [
    lastMusicProgressSecRef,
    musicGainRef,
    persistMusicResume,
    playTrackAt,
    playbackModeRef,
    setMusicCurrentSec,
    setMusicDurationSec,
    setPlaying,
    soundRef,
    stopScripturePlayback,
    trackIndex,
    trackIndexRef,
    tracks,
  ]);
}
