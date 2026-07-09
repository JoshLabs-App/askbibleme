import { useFocusEffect } from "@react-navigation/native";
import * as ScreenOrientation from "expo-screen-orientation";
import { useCallback } from "react";

/** 首页聚焦时允许横屏，离开时锁回竖屏（其它 Tab 保持竖屏）。 */
export function useHomeOrientationUnlock(enabled = true) {
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined;
      let cancelled = false;
      void (async () => {
        try {
          await ScreenOrientation.unlockAsync();
        } catch {
          /* 模拟器或未编入原生模块时忽略 */
        }
      })();
      return () => {
        cancelled = true;
        void (async () => {
          if (cancelled) return;
          try {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
          } catch {
            /* ignore */
          }
        })();
      };
    }, [enabled]),
  );
}
