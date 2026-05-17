"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { isDisplayStandalone, isIosDevice } from "@/lib/pwa/display-mode";
import {
  isInstallDismissedRecently,
  markInstallCompleted,
  markInstallDismissed,
  readInstallCompleted,
} from "@/lib/pwa/install-prompt-persistence";

const SHOW_DELAY_MS = 2_500;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type PromptMode = "native" | "ios";

function shouldOfferOnPath(pathname: string): boolean {
  const p = pathname || "/";
  if (p.startsWith("/admin") || p.startsWith("/studio") || p.startsWith("/api")) return false;
  return true;
}

function shouldSuppressPrompt(): boolean {
  if (isDisplayStandalone()) return true;
  if (readInstallCompleted()) return true;
  if (isInstallDismissedRecently()) return true;
  return false;
}

function registerMinimalServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
    /* 非 HTTPS 或浏览器不支持时忽略 */
  });
}

/**
 * 打开站点后：可安装时提示「添加到主屏幕」；iOS Safari 显示操作说明。
 */
export function PwaInstallPrompt() {
  const { t } = useLocale();
  const pathname = usePathname() ?? "";
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<PromptMode | null>(null);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const scheduledRef = useRef(false);

  const clearShowTimer = useCallback(() => {
    if (showTimerRef.current != null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearShowTimer();
    setVisible(false);
    setMode(null);
  }, [clearShowTimer]);

  const scheduleShow = useCallback(
    (nextMode: PromptMode) => {
      if (scheduledRef.current || shouldSuppressPrompt() || !shouldOfferOnPath(pathname)) return;
      scheduledRef.current = true;
      clearShowTimer();
      showTimerRef.current = window.setTimeout(() => {
        showTimerRef.current = null;
        if (shouldSuppressPrompt() || !shouldOfferOnPath(pathname)) return;
        setMode(nextMode);
        setVisible(true);
      }, SHOW_DELAY_MS);
    },
    [clearShowTimer, pathname],
  );

  const onDismiss = useCallback(() => {
    markInstallDismissed();
    hide();
  }, [hide]);

  const onInstall = useCallback(async () => {
    const ev = deferredRef.current;
    if (!ev) return;
    try {
      await ev.prompt();
      const { outcome } = await ev.userChoice;
      if (outcome === "accepted") {
        markInstallCompleted();
        hide();
      } else {
        markInstallDismissed();
        hide();
      }
    } catch {
      onDismiss();
    } finally {
      deferredRef.current = null;
    }
  }, [hide, onDismiss]);

  useEffect(() => {
    registerMinimalServiceWorker();
  }, []);

  useEffect(() => {
    if (!shouldOfferOnPath(pathname)) hide();
  }, [hide, pathname]);

  useEffect(() => {
    if (shouldSuppressPrompt()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredRef.current = e as BeforeInstallPromptEvent;
      scheduleShow("native");
    };

    const onInstalled = () => {
      markInstallCompleted();
      deferredRef.current = null;
      hide();
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    let iosTimer: number | undefined;
    if (isIosDevice()) {
      iosTimer = window.setTimeout(() => {
        if (deferredRef.current || shouldSuppressPrompt()) return;
        scheduleShow("ios");
      }, SHOW_DELAY_MS + 400);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      if (iosTimer != null) window.clearTimeout(iosTimer);
    };
  }, [hide, scheduleShow]);

  if (!visible || !mode) return null;

  const body =
    mode === "ios" ? t("chrome.pwaInstallBodyIos") : t("chrome.pwaInstallBody");

  return (
    <div
      role="dialog"
      aria-labelledby="selah-pwa-install-title"
      aria-describedby="selah-pwa-install-body"
      className="pointer-events-auto fixed left-3 right-3 z-[88] max-w-lg rounded-2xl border border-border/55 bg-canvas/95 px-4 py-3.5 text-left text-ink shadow-[0_8px_32px_-8px_rgba(15,40,60,0.22)] backdrop-blur-md sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
      style={{
        bottom: "max(5.75rem, calc(4.85rem + env(safe-area-inset-bottom, 0px)))",
      }}
    >
      <p id="selah-pwa-install-title" className="text-[14px] font-medium leading-snug text-ink">
        {t("chrome.pwaInstallTitle")}
      </p>
      <p id="selah-pwa-install-body" className="mt-1.5 text-[13px] leading-relaxed text-ink/78">
        {body}
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full px-3 py-1.5 text-[13px] text-ink/65 transition hover:text-ink"
        >
          {t("chrome.pwaInstallDismiss")}
        </button>
        {mode === "native" ? (
          <button
            type="button"
            onClick={() => void onInstall()}
            className="rounded-full border border-border/60 bg-ink/[0.06] px-3.5 py-1.5 text-[13px] font-medium text-ink transition hover:bg-ink/[0.1]"
          >
            {t("chrome.pwaInstallAction")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
