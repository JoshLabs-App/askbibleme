"use client";

import { useEffect, useRef } from "react";

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
};

/**
 * 在 `active` 为 true 且页面在前台时请求 `screen` Wake Lock（常见：Chrome Android、部分桌面浏览器）。
 * 进入后台时系统会释放锁；回到前台时在此 hook 内会尝试重新申请。
 */
export function useScreenWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) {
      const s = sentinelRef.current;
      sentinelRef.current = null;
      if (s) void s.release().catch(() => {});
      return;
    }

    const nav = navigator as NavigatorWithWakeLock;
    if (typeof navigator === "undefined" || !nav.wakeLock?.request) return;

    let cancelled = false;

    const releaseHeld = () => {
      const held = sentinelRef.current;
      sentinelRef.current = null;
      if (held) void held.release().catch(() => {});
    };

    const request = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        const next = await nav.wakeLock!.request("screen");
        if (cancelled) {
          void next.release().catch(() => {});
          return;
        }
        releaseHeld();
        sentinelRef.current = next;
        next.addEventListener("release", () => {
          if (sentinelRef.current === next) sentinelRef.current = null;
        });
      } catch {
        /* 拒绝、非安全上下文或不支持 */
      }
    };

    void request();

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        releaseHeld();
        return;
      }
      if (!cancelled) void request();
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      releaseHeld();
    };
  }, [active]);
}
