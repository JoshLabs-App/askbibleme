"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

function subscribeDisplayFullscreen(onStore: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(display-mode: fullscreen)");
  mq.addEventListener("change", onStore);
  return () => mq.removeEventListener("change", onStore);
}

function getDisplayFullscreenSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: fullscreen)").matches;
}

/**
 * PWA `display-mode: fullscreen` 或整页 `document.documentElement` 全屏时，系统状态栏（含时间）常不可见。
 */
export function useShellInsetClockEnvironment(): boolean {
  const layoutFullscreen = useSyncExternalStore(
    subscribeDisplayFullscreen,
    getDisplayFullscreenSnapshot,
    () => false,
  );
  const [docShellFullscreen, setDocShellFullscreen] = useState(false);
  useEffect(() => {
    const sync = () => {
      setDocShellFullscreen(
        typeof document !== "undefined" && document.fullscreenElement === document.documentElement,
      );
    };
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  return layoutFullscreen || docShellFullscreen;
}
