"use client";

import { useEffect } from "react";
import { useAppImmersive } from "@/components/app-shell/AppImmersiveProvider";
import { isTvBrowser } from "@/lib/dom/is-tv-browser";
import { requestFullscreenCompat } from "@/lib/dom/fullscreen";

const MAX_REPORTS = 25;

/**
 * 电视模式：遥控器几乎没法点界面，所以检测到电视浏览器就自动——
 * 进沉浸（藏掉按钮和底栏）、尝试全屏（浏览器要求手势时，遥控器第一次按键就补一次）、
 * 并把环境和播放异常自动上报到 /api/tv-report，不需要人在电视上读屏拍照。
 */
export function TvAutoMode() {
  const { setImmersive } = useAppImmersive();

  useEffect(() => {
    if (!isTvBrowser()) return;
    // 电视专用页：从网页首页 / 官网首页进来的电视一律转到 /tv
    if (location.pathname === "/" || location.pathname === "/web") {
      location.replace("/tv");
      return;
    }
    const root = document.documentElement;
    root.setAttribute("data-tv", "");
    setImmersive(true);

    let sent = 0;
    const report = (kind: string, extra?: Record<string, unknown>) => {
      if (sent >= MAX_REPORTS) return;
      sent += 1;
      const body = JSON.stringify({
        kind,
        path: location.pathname,
        t: Math.round(performance.now() / 1000),
        ...extra,
      });
      try {
        if (!navigator.sendBeacon?.("/api/tv-report", body)) {
          void fetch("/api/tv-report", { method: "POST", body, keepalive: true }).catch(() => {});
        }
      } catch {
        /* ignore */
      }
    };

    const tryFullscreen = (why: string) => {
      if (document.fullscreenElement) return;
      requestFullscreenCompat(root)
        .then(() => report("fullscreen-ok", { why }))
        .catch((e: unknown) => report("fullscreen-fail", { why, err: String(e) }));
    };

    const supports = (v: string) => {
      try {
        return CSS.supports("height", v);
      } catch {
        return false;
      }
    };
    report("hello", {
      ua: navigator.userAgent,
      inner: `${innerWidth}x${innerHeight}`,
      screen: `${screen.width}x${screen.height}`,
      dpr: devicePixelRatio,
      dvh: supports("1dvh"),
      fsApi: Boolean(root.requestFullscreen || (root as { webkitRequestFullscreen?: unknown }).webkitRequestFullscreen),
      mem: (navigator as { deviceMemory?: number }).deviceMemory ?? null,
    });
    tryFullscreen("load");

    const onKey = () => tryFullscreen("key");
    document.addEventListener("keydown", onKey, { once: true });

    // 媒体事件不冒泡，用捕获拿到所有 <video>/<audio> 的异常
    const onMedia = (e: Event) => {
      const m = e.target as HTMLMediaElement | null;
      if (!m || !("currentTime" in m)) return;
      report(`media-${e.type}`, {
        tag: m.tagName,
        src: (m.currentSrc || "").slice(-60),
        pos: Math.round(m.currentTime),
        code: m.error?.code ?? null,
        ready: m.readyState,
      });
    };
    const mediaEvents = ["error", "stalled", "ended", "pause", "emptied", "abort"];
    mediaEvents.forEach((n) => document.addEventListener(n, onMedia, true));
    const onErr = (e: ErrorEvent) => report("js-error", { msg: e.message, at: `${e.filename}:${e.lineno}` });
    const onVis = () => report("visibility", { state: document.visibilityState });
    window.addEventListener("error", onErr);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("keydown", onKey);
      mediaEvents.forEach((n) => document.removeEventListener(n, onMedia, true));
      window.removeEventListener("error", onErr);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [setImmersive]);

  return null;
}
