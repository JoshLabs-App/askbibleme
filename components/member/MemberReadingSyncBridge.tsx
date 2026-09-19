"use client";

import { useEffect, useRef } from "react";
import { useAskbibleUser } from "@/components/auth/AskbibleUserProvider";
import { scheduleMemberReadingSyncWeb } from "@/lib/member-reading-sync/client/run-member-reading-sync-web";
import { setAchievementsLocalChangeHandler } from "@/lib/achievements/achievement-store-web";

export function MemberReadingSyncBridge() {
  const { bootstrapped, user } = useAskbibleUser();
  const enabled = bootstrapped && Boolean(user);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) return;
    scheduleMemberReadingSyncWeb();
  }, [enabled]);

  // 成就账本改了就防抖推一次（原生那边是 AchievementStore.onLocalChange → 1.5 秒防抖）
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    setAchievementsLocalChangeHandler(() => {
      if (!enabledRef.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        scheduleMemberReadingSyncWeb("achievements");
      }, 1500);
    });
    return () => {
      if (timer) clearTimeout(timer);
      setAchievementsLocalChangeHandler(null);
    };
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !enabledRef.current) return;
      scheduleMemberReadingSyncWeb();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  return null;
}
