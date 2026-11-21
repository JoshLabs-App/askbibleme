"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useAppImmersive } from "@/components/app-shell/AppImmersiveProvider";
import {
  ASKBIBLE_UPDATE_APPLIED_EVENT,
  fetchRemoteBuildId,
  getLoadedBuildId,
  shouldSkipBuildId,
} from "@/lib/pwa/check-app-update";
import {
  purgeOfflineCachesForBuildUpdate,
  refreshServiceWorkerRegistration,
  skipWaitingServiceWorker,
} from "@/lib/pwa/sw-client";

const POLL_MS = 5 * 60 * 1000;
const FIRST_CHECK_MS = 45_000;
const FOREGROUND_THROTTLE_MS = 30_000;
const RELOAD_DELAY_MS = 1200;

/**
 * 部署新版本后：已打开的标签或主屏幕 PWA 可能仍是旧 HTML/旧 chunk。
 * 自动轮询 + 标签回到前台（`visibilitychange`）+ 网络恢复（`online`）拉取 `/app-build.json`；
 * 发现不一致则清理缓存、切换新 Service Worker 并在短延迟后无感刷新。
 */
export function AppUpdateNotifier() {
  const { t } = useLocale();
  const { immersive } = useAppImmersive();
  const [visible, setVisible] = useState(false);
  const loadedRef = useRef<string | null>(null);
  const lastCheckAtRef = useRef(0);
  const reloadScheduledRef = useRef(false);
  const reloadTimerRef = useRef<number | null>(null);

  const scheduleReload = useCallback((delayMs: number) => {
    if (reloadScheduledRef.current) return;
    void purgeOfflineCachesForBuildUpdate();
    void skipWaitingServiceWorker();
    void refreshServiceWorkerRegistration();
    reloadScheduledRef.current = true;
    setVisible(true);
    if (reloadTimerRef.current != null) window.clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = window.setTimeout(() => {
      reloadTimerRef.current = null;
      window.location.reload();
    }, delayMs);
  }, []);

  const check = useCallback(async () => {
    if (reloadScheduledRef.current) return;
    lastCheckAtRef.current = Date.now();
    const loaded = loadedRef.current ?? getLoadedBuildId();
    if (shouldSkipBuildId(loaded)) return;
    loadedRef.current = loaded;
    const remote = await fetchRemoteBuildId();
    if (shouldSkipBuildId(remote)) return;
    if (remote === loaded) return;
    scheduleReload(RELOAD_DELAY_MS);
  }, [scheduleReload]);

  useEffect(() => {
    loadedRef.current = getLoadedBuildId() || null;
    const first = window.setTimeout(() => void check(), FIRST_CHECK_MS);
    const loop = window.setInterval(() => void check(), POLL_MS);

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastCheckAtRef.current < FOREGROUND_THROTTLE_MS) return;
      void check();
    };
    const onOnline = () => {
      void check();
    };
    const onManualReload = (event: Event) => {
      event.preventDefault();
      const custom = event as CustomEvent<{ delayMs?: number }>;
      scheduleReload(custom.detail?.delayMs ?? 900);
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener(ASKBIBLE_UPDATE_APPLIED_EVENT, onManualReload);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(loop);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener(ASKBIBLE_UPDATE_APPLIED_EVENT, onManualReload);
      if (reloadTimerRef.current != null) window.clearTimeout(reloadTimerRef.current);
    };
  }, [check, scheduleReload]);

  // 沉浸模式（首页全屏、电视常开）只是不弹提示条，已排定的刷新照样执行；
  // 以前这里会取消刷新定时器，而 reloadScheduledRef 又不复位，结果这个标签再也不会自动更新
  if (immersive) return null;
  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="assertive"
      className="app-update-notifier pointer-events-auto fixed left-3 right-3 z-[90] max-w-lg rounded-2xl border border-border/65 bg-canvas px-4 py-3 text-left text-ink shadow-[0_8px_32px_-8px_rgba(15,40,60,0.22)] sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
      style={{
        bottom: "max(5.75rem, calc(4.85rem + env(safe-area-inset-bottom, 0px)))",
      }}
    >
      <p className="text-[13px] leading-snug text-ink/90">{t("chrome.updateForced")}</p>
    </div>
  );
}
