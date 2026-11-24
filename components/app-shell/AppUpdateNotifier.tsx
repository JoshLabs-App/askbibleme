"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  ASKBIBLE_UPDATE_APPLIED_EVENT,
  fetchRemoteBuildMeta,
  getLoadedBuildId,
  getStagedBuildMeta,
  isPageSafeForSilentReload,
  shouldSkipBuildId,
  stageRemoteBuildMeta,
} from "@/lib/pwa/check-app-update";
import {
  purgeOfflineCachesForBuildUpdate,
  refreshServiceWorkerRegistration,
  skipWaitingServiceWorker,
} from "@/lib/pwa/sw-client";

const POLL_MS = 5 * 60 * 1000;
const FIRST_CHECK_MS = 30_000;
const FOREGROUND_THROTTLE_MS = 30_000;
const IDLE_BLUR_APPLY_DELAY_MS = 2_400;

/**
 * 静默无感自动更新守护（严禁打断式大弹窗或强行掐断阅读/音频状态）：
 * 1. 后台定时轮询 + 网络恢复 + 回到前台比对 `/app-build.json`；
 * 2. 检测到新版时先后台静默清理旧缓存并预热新 Service Worker（写入 staged 状态，底栏版本号轻量同步）；
 * 3. 仅当标签页切入后台隐藏（`document.hidden`）或窗口失焦闲置（`!document.hasFocus()`）且无音频播放/表单输入/弹窗时，自动静默切换就绪；
 * 4. 用户在底栏或抽屉主动点击手动更新时（`ASKBIBLE_UPDATE_APPLIED_EVENT`），按指定短延迟立即切换。
 */
export function AppUpdateNotifier() {
  const loadedRef = useRef<string | null>(null);
  const lastCheckAtRef = useRef(0);
  const reloadingRef = useRef(false);
  const blurTimerRef = useRef<number | null>(null);

  const performReloadNow = useCallback((delayMs = 0) => {
    if (reloadingRef.current) return;
    reloadingRef.current = true;
    void purgeOfflineCachesForBuildUpdate();
    void skipWaitingServiceWorker();
    void refreshServiceWorkerRegistration();
    if (delayMs <= 0) {
      window.location.reload();
      return;
    }
    window.setTimeout(() => {
      window.location.reload();
    }, delayMs);
  }, []);

  const tryApplyStagedSilently = useCallback(() => {
    if (reloadingRef.current) return;
    if (!getStagedBuildMeta()) return;
    const isHiddenOrUnfocused = document.hidden || !document.hasFocus();
    if (!isHiddenOrUnfocused) return;
    if (!isPageSafeForSilentReload()) return;
    performReloadNow(0);
  }, [performReloadNow]);

  const check = useCallback(async () => {
    if (reloadingRef.current) return;
    lastCheckAtRef.current = Date.now();
    const loaded = loadedRef.current ?? getLoadedBuildId();
    if (shouldSkipBuildId(loaded)) return;
    loadedRef.current = loaded;
    const remote = await fetchRemoteBuildMeta();
    if (!remote || shouldSkipBuildId(remote.id)) return;
    if (remote.id === loaded) return;
    stageRemoteBuildMeta(remote);
    tryApplyStagedSilently();
  }, [tryApplyStagedSilently]);

  useEffect(() => {
    loadedRef.current = getLoadedBuildId() || null;
    const first = window.setTimeout(() => void check(), FIRST_CHECK_MS);
    const loop = window.setInterval(() => void check(), POLL_MS);

    const onVisibility = () => {
      if (document.hidden) {
        tryApplyStagedSilently();
        return;
      }
      if (Date.now() - lastCheckAtRef.current < FOREGROUND_THROTTLE_MS) return;
      void check();
    };
    const onBlur = () => {
      if (!getStagedBuildMeta()) return;
      if (blurTimerRef.current != null) window.clearTimeout(blurTimerRef.current);
      blurTimerRef.current = window.setTimeout(() => {
        blurTimerRef.current = null;
        tryApplyStagedSilently();
      }, IDLE_BLUR_APPLY_DELAY_MS);
    };
    const onFocus = () => {
      if (blurTimerRef.current != null) {
        window.clearTimeout(blurTimerRef.current);
        blurTimerRef.current = null;
      }
    };
    const onOnline = () => {
      void check();
    };
    const onManualReload = (event: Event) => {
      event.preventDefault();
      const custom = event as CustomEvent<{ delayMs?: number }>;
      performReloadNow(custom.detail?.delayMs ?? 600);
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener(ASKBIBLE_UPDATE_APPLIED_EVENT, onManualReload);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(loop);
      if (blurTimerRef.current != null) window.clearTimeout(blurTimerRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener(ASKBIBLE_UPDATE_APPLIED_EVENT, onManualReload);
    };
  }, [check, performReloadNow, tryApplyStagedSilently]);

  return null;
}
