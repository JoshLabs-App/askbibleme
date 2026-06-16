"use client";

import { useEffect, useRef } from "react";
import { useAskbibleUser } from "@/components/auth/AskbibleUserProvider";
import { scheduleMemberReadingSyncWeb } from "@/lib/member-reading-sync/client/run-member-reading-sync-web";

export function MemberReadingSyncBridge() {
  const { bootstrapped, user } = useAskbibleUser();
  const enabled = bootstrapped && Boolean(user);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) return;
    scheduleMemberReadingSyncWeb();
  }, [enabled]);

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
