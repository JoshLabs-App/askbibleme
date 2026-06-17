import { useShellSwipeAction } from "../shell/useShellSwipeAction";
import { useMusicHomeQueueScroll } from "./useMusicHomeQueueScroll";
import { useMusicHomeUiAutoHide } from "./useMusicHomeUiAutoHide";
import { useMusicHomeCoffeePulse } from "./useMusicHomeCoffeePulse";
import { useMusicHomeGestures } from "./useMusicHomeGestures";
import { useMusicHomeScreenPlaybackContext } from "./useMusicHomeScreenPlaybackContext";
import { useMusicHomeCatalogCheck, useMusicHomeLayout } from "./useMusicHomeScreenState";

export function useMusicHomeScreenController(layout: "tab" | "stack") {
  const layoutState = useMusicHomeLayout(layout);
  const ctx = useMusicHomeScreenPlaybackContext();
  const {
    isFocused,
    loading,
    tracks,
    album,
    albumState,
    current,
    metrics,
    glowColors,
    seek,
    upper,
    sleepTimer,
    playbackSlice,
    playTrackAt,
    playNext,
    playPrev,
    togglePlayMusic,
    seekRatio,
    musicCurrentSec,
    checkMusicCatalogUpdate,
  } = ctx;

  const { musicActive, albumDecorVisible, albumDecorMotionActive, duration, position, progress } = metrics;

  const uiAutoHide = useMusicHomeUiAutoHide({
    album,
    compactLandscape: layoutState.compactLandscape,
    musicActive,
    playing: ctx.playing,
    loading,
    tracks,
    current,
    togglePlayMusic,
  });

  const { coffeeRhythmPulse } = useMusicHomeCoffeePulse(
    album,
    current,
    musicCurrentSec,
    albumDecorMotionActive && isFocused,
  );

  useMusicHomeCatalogCheck(loading, checkMusicCatalogUpdate);

  const gestures = useMusicHomeGestures({
    tracksLength: tracks.length,
    filteredTrackIndices: albumState.filteredTrackIndices,
    currentFilteredIndex: albumState.currentFilteredIndex,
    musicActive,
    musicCurrentSec,
    playTrackAt,
    playNext,
    playPrev,
    seekRatio,
  });

  useShellSwipeAction(layoutState.inTab && !loading && tracks.length > 0, gestures.onMusicSwipe);

  const queue = useMusicHomeQueueScroll({
    album,
    trackIndex: ctx.trackIndex,
    filteredTrackIndices: albumState.filteredTrackIndices,
  });

  return {
    layoutState,
    playback: playbackSlice,
    seek,
    upper,
    sleepTimer,
    albumState,
    glowColors,
    current,
    albumDecorVisible,
    albumDecorMotionActive,
    duration,
    position,
    progress,
    uiAutoHide,
    coffeeRhythmPulse,
    gestures,
    queue,
  };
}

export type MusicHomeScreenController = ReturnType<typeof useMusicHomeScreenController>;
