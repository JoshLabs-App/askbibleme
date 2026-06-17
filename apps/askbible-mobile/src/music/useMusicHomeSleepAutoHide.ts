import { useCallback, useEffect, useRef } from "react";
import { setMusicAutoHideChrome } from "./musicAutoHideChrome";

const MUSIC_UI_AUTO_HIDE_MS = 5000;

type Args = {
  sleepAutoHideEnabled: boolean;
  sleepUiAutoHideEnabled: boolean;
  compactLandscape: boolean;
  loading: boolean;
  tracksLength: number;
  hasCurrent: boolean;
  setUiVisible: (visible: boolean) => void;
  setLandscapeMenuVisible: (visible: boolean) => void;
};

export function useMusicHomeSleepAutoHide({
  sleepAutoHideEnabled,
  sleepUiAutoHideEnabled,
  compactLandscape,
  loading,
  tracksLength,
  hasCurrent,
  setUiVisible,
  setLandscapeMenuVisible,
}: Args) {
  const uiHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimeout = useCallback(() => {
    if (uiHideTimeoutRef.current) {
      clearTimeout(uiHideTimeoutRef.current);
      uiHideTimeoutRef.current = null;
    }
  }, []);

  const resetUiAutoHide = useCallback(() => {
    clearHideTimeout();
    if (compactLandscape) {
      setLandscapeMenuVisible(true);
    } else {
      setUiVisible(true);
    }
    if (!sleepUiAutoHideEnabled) return;
    if (loading || tracksLength === 0 || !hasCurrent) return;
    uiHideTimeoutRef.current = setTimeout(() => {
      if (compactLandscape) {
        setLandscapeMenuVisible(false);
      } else {
        setUiVisible(false);
      }
      uiHideTimeoutRef.current = null;
    }, MUSIC_UI_AUTO_HIDE_MS);
  }, [
    clearHideTimeout,
    compactLandscape,
    hasCurrent,
    loading,
    setLandscapeMenuVisible,
    setUiVisible,
    sleepUiAutoHideEnabled,
    tracksLength,
  ]);

  useEffect(() => {
    if (!sleepAutoHideEnabled || loading || tracksLength === 0 || !hasCurrent) {
      clearHideTimeout();
      if (!compactLandscape) setUiVisible(true);
      return;
    }
    if (!sleepUiAutoHideEnabled) {
      if (compactLandscape) {
        setLandscapeMenuVisible(true);
      } else {
        setUiVisible(true);
      }
      clearHideTimeout();
      return;
    }
    resetUiAutoHide();
  }, [
    clearHideTimeout,
    compactLandscape,
    hasCurrent,
    loading,
    resetUiAutoHide,
    setLandscapeMenuVisible,
    setUiVisible,
    sleepAutoHideEnabled,
    sleepUiAutoHideEnabled,
    tracksLength,
  ]);

  useEffect(() => () => clearHideTimeout(), [clearHideTimeout]);

  return resetUiAutoHide;
}

export function useMusicHomeSleepChromeEffect(
  compactLandscape: boolean,
  sleepUiAutoHideEnabled: boolean,
  uiVisible: boolean,
) {
  useEffect(() => {
    if (compactLandscape) return;
    setMusicAutoHideChrome(sleepUiAutoHideEnabled && !uiVisible);
    return () => setMusicAutoHideChrome(false);
  }, [compactLandscape, sleepUiAutoHideEnabled, uiVisible]);

  useEffect(() => {
    if (!compactLandscape) return;
    setMusicAutoHideChrome(true);
    return () => setMusicAutoHideChrome(false);
  }, [compactLandscape]);
}
