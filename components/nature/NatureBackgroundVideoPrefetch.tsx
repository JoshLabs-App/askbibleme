"use client";

import { useEffect, useRef } from "react";
import { isIosLikeUserAgent } from "@/lib/dom/ios";
import { readNatureBackground1080Pref } from "@/lib/nature/nature-video-quality-prefs";

const PREFETCH_STAGGER_MS = 550;

/**
 * 仅在标签页前台可见、且非 iOS、非 Save-Data、非低内存机时，于 idle 错峰 `link rel=prefetch` 若干成片。
 * 隐藏或后台：取消排队并移除已注入的 link，避免不可见 Tab 继续拉满大媒体。
 */
export function NatureBackgroundVideoPrefetch() {
  const sessionRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isIosLikeUserAgent()) return;

    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;

    const dm = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    if (typeof dm === "number" && dm > 0 && dm <= 4) return;

    let disposed = false;
    const timers: number[] = [];
    const injected: HTMLLinkElement[] = [];

    const clearTimers = () => {
      timers.forEach((id) => window.clearTimeout(id));
      timers.length = 0;
    };

    const removeInjected = () => {
      for (const link of injected) {
        try {
          link.remove();
        } catch {
          /* ignore */
        }
      }
      injected.length = 0;
    };

    const bumpSession = () => {
      sessionRef.current += 1;
      clearTimers();
      removeInjected();
    };

    const prefetchUrl = (href: string, sid: number) => {
      if (disposed || sid !== sessionRef.current) return;
      if (document.visibilityState !== "visible") return;
      let abs: string;
      try {
        abs = new URL(href, window.location.origin).href;
      } catch {
        return;
      }
      if (!abs.startsWith(window.location.origin + "/nature/uploads/")) return;
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.href = abs;
      link.as = "video";
      document.head.appendChild(link);
      injected.push(link);
    };

    const runPrefetch = (sid: number) => {
      if (disposed || sid !== sessionRef.current) return;
      if (document.visibilityState !== "visible") return;
      void (async () => {
        let urls: string[] = [];
        try {
          const prefer1080 = readNatureBackground1080Pref();
          const r = await fetch(
            `/api/nature/prefetch-srcs${prefer1080 ? "?prefer1080=1" : ""}`,
          );
          if (!r.ok || disposed || sid !== sessionRef.current) return;
          const j = (await r.json()) as { urls?: unknown };
          if (!Array.isArray(j.urls)) return;
          urls = j.urls.filter((u): u is string => typeof u === "string");
        } catch {
          return;
        }
        if (disposed || sid !== sessionRef.current || !urls.length) return;
        if (document.visibilityState !== "visible") return;
        urls.forEach((href, i) => {
          const id = window.setTimeout(() => prefetchUrl(href, sid), i * PREFETCH_STAGGER_MS);
          timers.push(id);
        });
      })();
    };

    let idleHandle: number | null = null;
    let fallbackTimer: number | null = null;

    const cancelIdleKick = () => {
      if (idleHandle != null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleHandle);
      }
      idleHandle = null;
      if (fallbackTimer != null) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
    };

    const schedulePrefetch = () => {
      cancelIdleKick();
      bumpSession();
      const sid = sessionRef.current;
      if (document.visibilityState !== "visible") return;

      const kick = () => {
        idleHandle = null;
        fallbackTimer = null;
        runPrefetch(sid);
      };

      if (typeof window.requestIdleCallback === "function") {
        idleHandle = window.requestIdleCallback(kick, { timeout: 8000 });
      } else {
        fallbackTimer = window.setTimeout(kick, 2200);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState !== "visible") {
        bumpSession();
        cancelIdleKick();
        return;
      }
      schedulePrefetch();
    };

    document.addEventListener("visibilitychange", onVisibility);
    schedulePrefetch();

    return () => {
      disposed = true;
      bumpSession();
      cancelIdleKick();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
