"use client";

import { useEffect, useState } from "react";

/**
 * 与 `NatureVideoExperience` 等一致：**手机式**横屏（窄且矮），用于沉浸态 / 全屏等。
 * 勿用「宽 ≤1024」单条件：平板、小笔记本横屏会误判，导致底栏被 `globals.css` 整段隐藏。
 */
export function useLandscapeNarrow(): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(
      "(orientation: landscape) and (max-width: 956px) and (max-height: 500px)",
    );
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return matches;
}
