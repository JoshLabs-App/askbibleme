"use client";

import { useEffect } from "react";

const PREFETCH_STAGGER_MS = 550;

/**
 * 进入前台壳后，在浏览器空闲时错峰预取配置里前几条自然背景成片（`link rel=prefetch`），
 * 不阻塞首屏；尊重 Save-Data；仅同源 `/nature/uploads/*.mp4`。
 */
export function NatureBackgroundVideoPrefetch() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;

    let cancelled = false;
    const timers: number[] = [];
    const injected: HTMLLinkElement[] = [];

    const prefetchUrl = (href: string) => {
      if (cancelled) return;
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

    const start = () => {
      if (cancelled) return;
      void (async () => {
        let urls: string[] = [];
        try {
          const r = await fetch("/api/nature/prefetch-srcs");
          if (!r.ok) return;
          const j = (await r.json()) as { urls?: unknown };
          if (!Array.isArray(j.urls)) return;
          urls = j.urls.filter((u): u is string => typeof u === "string");
        } catch {
          return;
        }
        if (cancelled || !urls.length) return;
        urls.forEach((href, i) => {
          const id = window.setTimeout(() => prefetchUrl(href), i * PREFETCH_STAGGER_MS);
          timers.push(id);
        });
      })();
    };

    const idleId =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(start, { timeout: 8000 })
        : null;
    const fallbackId = idleId == null ? window.setTimeout(start, 2200) : null;

    return () => {
      cancelled = true;
      if (idleId != null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (fallbackId != null) window.clearTimeout(fallbackId);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  return null;
}
