"use client";

import { useEffect, useState } from "react";

/**
 * 与 `NatureVideoExperience` 一致：窄屏设备横屏（排除典型桌面宽窗）。
 */
export function useLandscapeNarrow(): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape) and (max-width: 1024px)");
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return matches;
}
