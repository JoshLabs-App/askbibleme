import { useCallback, useEffect, useMemo, useState } from "react";
import { InteractionManager } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { musicAlbumGlowColors } from "./musicAlbumCatalog";
import { cycleShellSleepTimerMinutes, sleepTimerBadgeText } from "./musicSleepTimer";
import type { ShellSleepTimerMinutes } from "./musicPlaybackTypes";

export function useMusicHomeSeekState(trackIndex: number, playbackMode: string) {
  const [seekDragging, setSeekDragging] = useState(false);
  const [seekPreview, setSeekPreview] = useState(0);

  useEffect(() => {
    setSeekDragging(false);
    setSeekPreview(0);
  }, [trackIndex, playbackMode]);

  return { seekDragging, seekPreview, setSeekDragging, setSeekPreview };
}

export { useMusicHomeLayout } from "./useMusicHomeLayout";

export function useMusicHomeCatalogCheck(loading: boolean, checkMusicCatalogUpdate: () => Promise<boolean>) {
  useFocusEffect(
    useCallback(() => {
      if (loading) return;
      const task = InteractionManager.runAfterInteractions(() => {
        void checkMusicCatalogUpdate();
      });
      return () => task.cancel();
    }, [checkMusicCatalogUpdate, loading]),
  );
}

export function useMusicHomeUpperSize() {
  const [upperSize, setUpperSize] = useState({ width: 0, height: 0 });
  const onUpperLayout = useCallback((e: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width, height } = e.nativeEvent.layout;
    setUpperSize((prev) =>
      Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5 ? prev : { width, height },
    );
  }, []);
  return { upperSize, onUpperLayout };
}

export function useMusicHomeSleepTimer(
  sleepTimerMinutes: 0 | ShellSleepTimerMinutes,
  setSleepTimerMinutes: (minutes: 0 | ShellSleepTimerMinutes) => void,
) {
  const cycleSleepTimer = useCallback(() => {
    setSleepTimerMinutes(cycleShellSleepTimerMinutes(sleepTimerMinutes));
  }, [setSleepTimerMinutes, sleepTimerMinutes]);
  const sleepTimerBadge = sleepTimerBadgeText(sleepTimerMinutes);
  return { cycleSleepTimer, sleepTimerBadge };
}

export function useMusicHomeGlowColors(album: string) {
  return useMemo(() => musicAlbumGlowColors(album), [album]);
}
