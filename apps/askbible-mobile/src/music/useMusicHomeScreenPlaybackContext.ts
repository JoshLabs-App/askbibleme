import { useCallback } from "react";
import { useIsFocused } from "@react-navigation/native";
import { setShellMusicWantPlaying } from "../audio/shellMusicWantPlaying";
import { useAppForeground } from "./useAppForeground";
import { useMusicPlayback } from "./MusicPlaybackContext";
import { useMusicHomeAlbum } from "./useMusicHomeAlbum";
import { resolveMusicHomePlaybackMetrics } from "./musicHomePlaybackMetrics";
import { resolveMusicPageToggleAction } from "./musicPagePlayback";
import { isTrackPlayable } from "./trackArtwork";
import { normalizeMusicAlbumLabel } from "./musicAlbumCatalog";
import {
  useMusicHomeGlowColors,
  useMusicHomeSleepTimer,
  useMusicHomeUpperSize,
} from "./useMusicHomeScreenState";

export function useMusicHomeScreenPlaybackContext() {
  const isFocused = useIsFocused();
  const appForeground = useAppForeground();
  const playback = useMusicPlayback();
  const {
    tracks,
    trackIndex,
    playing,
    loading,
    playbackMode,
    musicDurationSec,
    playTrackAt,
    playNext,
    playPrev,
    togglePlayMusic,
    seekRatio,
    musicRepeatMode,
    setMusicRepeatMode,
    toggleMusicRepeatOne,
    toggleMusicRepeatAll,
    sleepTimerMinutes,
    setSleepTimerMinutes,
    setMusicGain,
    downloadingTrackId,
    checkMusicCatalogUpdate,
    downloadMusicTrackAt,
  } = playback;

  const upper = useMusicHomeUpperSize();
  const sleepTimer = useMusicHomeSleepTimer(sleepTimerMinutes, setSleepTimerMinutes);

  const musicPagePlaying = playing && playbackMode === "music";

  const albumState = useMusicHomeAlbum({
    tracks,
    trackIndex,
    playing: musicPagePlaying,
    sleepTimerMinutes,
    playTrackAt,
    downloadMusicTrackAt,
    setMusicGain,
    setMusicRepeatMode,
    setSleepTimerMinutes,
  });

  const { album } = albumState;
  const togglePlaySelectedAlbum = useCallback(async () => {
    const action = resolveMusicPageToggleAction({
      selectedAlbum: album,
      currentAlbum: normalizeMusicAlbumLabel(tracks[trackIndex]?.album),
      playing: musicPagePlaying,
      tracks,
      trackIndex,
      isPlayable: isTrackPlayable,
    });
    if (action.type === "ignore") return;
    if (action.type === "pause") {
      await togglePlayMusic();
      return;
    }
    setShellMusicWantPlaying(true);
    await playTrackAt(action.index, { autoPlay: true });
  }, [album, musicPagePlaying, playTrackAt, togglePlayMusic, trackIndex, tracks]);
  const glowColors = useMusicHomeGlowColors(album);
  const current = tracks[trackIndex];
  const metrics = resolveMusicHomePlaybackMetrics({
    playbackMode,
    musicDurationSec,
    playing,
    isFocused,
    appForeground,
  });

  return {
    isFocused,
    tracks,
    trackIndex,
    playing: musicPagePlaying,
    canTogglePlayback: playback.canTogglePlayback,
    loading,
    playbackMode,
    playTrackAt,
    playNext,
    playPrev,
    togglePlayMusic: togglePlaySelectedAlbum,
    seekRatio,
    checkMusicCatalogUpdate,
    downloadMusicTrackAt,
    upper,
    sleepTimer,
    albumState,
    album,
    glowColors,
    current,
    metrics,
    playbackSlice: {
      tracks,
      trackIndex,
      playing: musicPagePlaying,
      loading,
      canTogglePlayback: playback.canTogglePlayback,
      musicRepeatMode,
      sleepTimerMinutes,
      downloadingTrackId,
      togglePlayMusic: togglePlaySelectedAlbum,
      setMusicRepeatMode,
      toggleMusicRepeatOne,
      toggleMusicRepeatAll,
      playTrackAt,
      playNext,
      seekRatio,
    },
  };
}
