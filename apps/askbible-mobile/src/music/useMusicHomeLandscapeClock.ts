import { useEffect, useMemo, useState } from "react";
import { formatWallClock } from "./musicPlaybackProgress";

export function useMusicHomeLandscapeClock(compactLandscape: boolean) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const nowClockText = useMemo(() => formatWallClock(new Date(nowMs)), [nowMs]);

  useEffect(() => {
    if (!compactLandscape) return;
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [compactLandscape]);

  return nowClockText;
}
