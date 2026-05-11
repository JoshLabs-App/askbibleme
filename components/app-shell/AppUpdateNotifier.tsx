"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";

const POLL_MS = 5 * 60 * 1000;
const FIRST_CHECK_MS = 45_000;

/** 本地开发或未写入构建 id 时不提示，避免误报 */
function shouldSkipBuildId(id: string | null | undefined): boolean {
  const v = (id ?? "").trim();
  return v.length === 0 || v === "development" || v === "unknown";
}

/**
 * 部署新版本后：已打开的 WebApp 标签仍可能是旧 HTML/旧 chunk；轮询对比后提示刷新。
 */
export function AppUpdateNotifier() {
  const { t } = useLocale();
  const [visible, setVisible] = useState(false);
  const loadedRef = useRef<string | null>(null);

  const check = useCallback(async () => {
    const loaded =
      loadedRef.current ?? document.body?.getAttribute("data-app-build")?.trim() ?? "";
    if (shouldSkipBuildId(loaded)) return;
    loadedRef.current = loaded;
    try {
      const res = await fetch("/api/app-build", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { id?: string };
      const remote = data.id?.trim() ?? "";
      if (shouldSkipBuildId(remote)) return;
      if (remote !== loaded) setVisible(true);
    } catch {
      /* 离线等：忽略 */
    }
  }, []);

  useEffect(() => {
    loadedRef.current = document.body?.getAttribute("data-app-build")?.trim() ?? null;
    const first = window.setTimeout(() => void check(), FIRST_CHECK_MS);
    const loop = window.setInterval(() => void check(), POLL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(loop);
    };
  }, [check]);

  const onRefresh = useCallback(() => {
    window.location.reload();
  }, []);

  const onLater = useCallback(() => {
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto fixed left-3 right-3 z-[90] max-w-lg rounded-2xl border border-border/55 bg-canvas/95 px-4 py-3 text-left text-ink shadow-[0_8px_32px_-8px_rgba(15,40,60,0.22)] backdrop-blur-md sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
      style={{
        bottom: "max(5.75rem, calc(4.85rem + env(safe-area-inset-bottom, 0px)))",
      }}
    >
      <p className="text-[13px] leading-snug text-ink/90">{t("chrome.updateAvailable")}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRefresh}
          className="min-h-[40px] rounded-full bg-ink px-4 text-[13px] font-medium text-canvas transition hover:bg-ink/90 active:scale-[0.98]"
        >
          {t("chrome.updateRefresh")}
        </button>
        <button
          type="button"
          onClick={onLater}
          className="min-h-[40px] rounded-full border border-border/70 bg-transparent px-4 text-[13px] font-medium text-ink/80 transition hover:bg-ink/[0.04]"
        >
          {t("chrome.updateLater")}
        </button>
      </div>
    </div>
  );
}
