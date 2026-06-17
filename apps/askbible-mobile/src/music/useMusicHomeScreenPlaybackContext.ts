import { useIsFocused } from "@react-navigation/native";
import { useMusicPlayback } from "./MusicPlaybackContext";
import { useMusicHomeAlbum } from "./useMusicHomeAlbum";
import { resolveMusicHomePlaybackMetrics } from "./musicHomePlaybackMetrics";
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
  } = playback;

  const seek = useMusicHomeSeekState(trackIndex, playbackMode);
  const upper = useMusicHomeUpperSize();
  const sleepTimer = useMusicHomeSleepTimer(sleepTimerMinutes, setSleepTimerMinutes);

  const albumState = useMusicHomeAlbum({
    tracks,
    trackIndex,
    sleepTimerMinutes,
    playTrackAt,
    setMusicGain,
    setMusicRepeatMode,
    setSleepTimerMinutes,
  });

  const { album } = albumState;
  const glowColors = useMusicHomeGlowColors(album);
  const current = tracks[trackIndex];
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
    loading,
    musicCurrentSec,
    playTrackAt,
    playNext,
    playPrev,
    togglePlayMusic,
    seekRatio,
    checkMusicCatalogUpdate,
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
      musicRepeatMode,
      sleepTimerMinutes,
      downloadingTrackId,
      toggleMusicRepeatOne,
      toggleMusicRepeatAll,
      playTrackAt,
      playNext,
      seekRatio,
    },
  };
}
