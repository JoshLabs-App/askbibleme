import { useIsFocused } from "@react-navigation/native";
import { useMusicPlayback } from "./MusicPlaybackContext";
import { useMusicHomeAlbum } from "./useMusicHomeAlbum";
import { resolveMusicHomePlaybackMetrics } from "./musicHomePlaybackMetrics";
import { musicCopy } from "./musicCopy";
import {
  useMusicHomeGlowColors,
  useMusicHomeSeekState,
  useMusicHomeSleepTimer,
  useMusicHomeUpperSize,
} from "./useMusicHomeScreenState";

export function useMusicHomeScreenPlaybackContext() {
  const isFocused = useIsFocused();
  const playback = useMusicPlayback();
  const {
    tracks,
    trackIndex,
    playing,
    loading,
    playbackMode,
    musicCurrentSec,
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

  const seek = useMusicHomeSeekState(trackIndex, playbackMode);
  const upper = useMusicHomeUpperSize();
  const sleepTimer = useMusicHomeSleepTimer(sleepTimerMinutes, setSleepTimerMinutes);

  const albumState = useMusicHomeAlbum({
    tracks,
    trackIndex,
    sleepTimerMinutes,
    playTrackAt,
    downloadMusicTrackAt,
    setMusicGain,
    setMusicRepeatMode,
    setSleepTimerMinutes,
  });

  const { album } = albumState;
  const glowColors = useMusicHomeGlowColors(album);
  const current = tracks[trackIndex];
  const selectedTrackTitle = current?.title?.trim() || musicCopy.untitled;
  const metrics = resolveMusicHomePlaybackMetrics({
    playbackMode,
    musicDurationSec,
    musicCurrentSec,
    seekDragging: seek.seekDragging,
    seekPreview: seek.seekPreview,
    playing,
    isFocused,
  });

  return {
    isFocused,
    tracks,
    trackIndex,
    playing,
    canTogglePlayback: playback.canTogglePlayback,
    loading,
    musicCurrentSec,
    playTrackAt,
    playNext,
    playPrev,
    togglePlayMusic,
    seekRatio,
    checkMusicCatalogUpdate,
    downloadMusicTrackAt,
    seek,
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
      playing,
      loading,
      canTogglePlayback: playback.canTogglePlayback,
      musicRepeatMode,
      sleepTimerMinutes,
      downloadingTrackId,
      togglePlayMusic,
      toggleMusicRepeatOne,
      toggleMusicRepeatAll,
      playTrackAt,
      playNext,
      seekRatio,
      selectedTrackTitle,
    },
  };
}
