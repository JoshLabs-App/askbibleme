import { useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

// 只认 background：锁屏/切走会走到这里。transient 的 "inactive"（下拉通知中心、
// 应用切换器）不算离开，否则装饰动画会在用户眼前停一下再从头开始。
export function isForegroundState(state: AppStateStatus | null): boolean {
  return state !== "background";
}

/**
 * App 是否在前台。后台播音乐时装饰动画必须停：带 audio 后台模式的 App
 * 若 60 秒内平均 CPU 超 80%，会被 iOS 直接杀掉（音乐随之中断）。
 */
export function useAppForeground(): boolean {
  const [foreground, setForeground] = useState(() => isForegroundState(AppState.currentState));

  useEffect(() => {
    const sync = (next: AppStateStatus) => setForeground(isForegroundState(next));
    sync(AppState.currentState);
    const sub = AppState.addEventListener("change", sync);
    return () => sub.remove();
  }, []);

  return foreground;
}
