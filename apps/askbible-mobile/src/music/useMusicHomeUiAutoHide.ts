import { useCallback, useEffect, useState } from "react";
import { useMusicHomeLandscapeClock } from "./useMusicHomeLandscapeClock";
import { useMusicHomeSleepAutoHide, useMusicHomeSleepChromeEffect } from "./useMusicHomeSleepAutoHide";
import type { PlaybackTrack } from "./types";

type Args = {
  album: string;
  compactLandscape: boolean;
  musicActive: boolean;
  playing: boolean;
  loading: boolean;
  tracks: PlaybackTrack[];
  current: PlaybackTrack | undefined;
  togglePlayMusic: () => Promise<void>;
};

export function useMusicHomeUiAutoHide({
  album,
  compactLandscape,
  musicActive,
  playing,
  loading,
  tracks,
  current,
  togglePlayMusic,
}: Args) {
  const [uiVisible, setUiVisible] = useState(true);
  const [landscapeMenuVisible, setLandscapeMenuVisible] = useState(false);

  const sleepAutoHideEnabled = album === "睡眠";
  const sleepUiAutoHideEnabled = sleepAutoHideEnabled && musicActive && playing;
  const chromeVisible = compactLandscape ? landscapeMenuVisible : uiVisible;
  const nowClockText = useMusicHomeLandscapeClock(compactLandscape);

  const resetUiAutoHide = useMusicHomeSleepAutoHide({
    sleepAutoHideEnabled,
    sleepUiAutoHideEnabled,
    compactLandscape,
    loading,
    tracksLength: tracks.length,
    hasCurrent: Boolean(current),
    setUiVisible,
    setLandscapeMenuVisible,
  });

  useEffect(() => {
    if (!compactLandscape) {
      setLandscapeMenuVisible(false);
      return;
    }
    setLandscapeMenuVisible(false);
  }, [compactLandscape]);

  const onLandscapeStageToggle = useCallback(() => {
    if (!compactLandscape) return;
    if (landscapeMenuVisible) {
      setLandscapeMenuVisible(false);
      if (!playing && tracks.length > 0) void togglePlayMusic();
      return;
    }
    setLandscapeMenuVisible(true);
    if (playing) void togglePlayMusic();
  }, [compactLandscape, landscapeMenuVisible, playing, togglePlayMusic, tracks.length]);

  useMusicHomeSleepChromeEffect(compactLandscape, sleepUiAutoHideEnabled, uiVisible);

  return {
    uiVisible,
    chromeVisible,
    nowClockText,
    resetUiAutoHide,
    onLandscapeStageToggle,
  };
}
