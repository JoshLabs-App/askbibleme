"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  purgeOfflineCachesForBuildUpdate,
  refreshServiceWorkerRegistration,
  skipWaitingServiceWorker,
} from "@/lib/pwa/sw-client";

const POLL_MS = 5 * 60 * 1000;
const FIRST_CHECK_MS = 45_000;
const RELOAD_DELAY_MS = 1200;

/** 本地开发或未写入构建 id 时不提示，避免误报 */
function shouldSkipBuildId(id: string | null | undefined): boolean {
  const v = (id ?? "").trim();
  return v.length === 0 || v === "development" || v === "unknown";
}

async function fetchRemoteBuildId(): Promise<string | null> {
  try {
    const r1 = await fetch("/app-build.json", { cache: "no-store" });
    if (r1.ok) {
      const j = (await r1.json()) as { id?: string };
      const v = j.id?.trim() ?? "";
      if (v) return v;
    }
  } catch {
    /* ignore */
  }
  try {
    const r2 = await fetch("/api/app-build", { cache: "no-store" });
    if (!r2.ok) return null;
    const data = (await r2.json()) as { id?: string };
    return data.id?.trim() ?? null;
  } catch {
    return null;
  }
}

/**
 * 部署新版本后：已打开的标签可能仍是旧 HTML/旧 chunk。
 * 优先拉取 `/app-build.json`（与静态资源同源）；发现不一致则提示并在短延迟后强制刷新。
 */
export function AppUpdateNotifier() {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);
  const loadedRef = useRef<string | null>(null);
  const reloadScheduledRef = useRef(false);
  const reloadTimerRef = useRef<number | null>(null);

  const check = useCallback(async () => {
    if (reloadScheduledRef.current) return;
    const loaded =
      loadedRef.current ?? document.body?.getAttribute("data-app-build")?.trim() ?? "";
    if (shouldSkipBuildId(loaded)) return;
    loadedRef.current = loaded;
    const remote = await fetchRemoteBuildId();
    if (shouldSkipBuildId(remote)) return;
    if (remote === loaded) return;
    void purgeOfflineCachesForBuildUpdate();
    void skipWaitingServiceWorker();
    void refreshServiceWorkerRegistration();
    reloadScheduledRef.current = true;
    setVisible(true);
    if (reloadTimerRef.current != null) window.clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = window.setTimeout(() => {
      reloadTimerRef.current = null;
      window.location.reload();
    }, RELOAD_DELAY_MS);
  }, []);

  useEffect(() => {
    loadedRef.current = document.body?.getAttribute("data-app-build")?.trim() ?? null;
    const first = window.setTimeout(() => void check(), FIRST_CHECK_MS);
    const loop = window.setInterval(() => void check(), POLL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(loop);
      if (reloadTimerRef.current != null) window.clearTimeout(reloadTimerRef.current);
    };
  }, [check]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="assertive"
      className="pointer-events-auto fixed left-3 right-3 z-[90] max-w-lg rounded-2xl border border-border/55 bg-canvas/95 px-4 py-3 text-left text-ink shadow-[0_8px_32px_-8px_rgba(15,40,60,0.22)] backdrop-blur-md sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
      style={{
        bottom: "max(5.75rem, calc(4.85rem + env(safe-area-inset-bottom, 0px)))",
      }}
    >
      <p className="text-[13px] leading-snug text-ink/90">{t("chrome.updateForced")}</p>
    </div>
  );
}
