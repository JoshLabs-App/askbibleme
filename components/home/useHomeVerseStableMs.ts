"use client";

import { useEffect, useState } from "react";
import { HOME_PRAYER_PREFS_UPDATED_EVENT, readHomePrayerVersePrefs } from "@/lib/home-prayer-pools/prefs";

function readStableMs(): number {
  return Math.max(1000, readHomePrayerVersePrefs().homeVerseStableSec * 1000);
}

/** 监听本地经文偏好里的轮播停留时间；用于首页轮播与独立经文轮播同步。 */
export function useHomeVerseStableMs(): number {
  const [stableMs, setStableMs] = useState(readStableMs);

  useEffect(() => {
    const sync = () => setStableMs(readStableMs());
    window.addEventListener(HOME_PRAYER_PREFS_UPDATED_EVENT, sync);
    sync();
    return () => window.removeEventListener(HOME_PRAYER_PREFS_UPDATED_EVENT, sync);
  }, []);

  return stableMs;
}
