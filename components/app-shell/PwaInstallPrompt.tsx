"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { isDisplayStandalone } from "@/lib/pwa/display-mode";
import {
  APP_INSTALL_IOS_URL,
  buildAndroidTrialMailto,
  resolveAppInstallAndroidEmail,
} from "@/lib/app-install-urls";
import {
  isInstallDismissedRecently,
  markInstallDismissed,
} from "@/lib/pwa/install-prompt-persistence";

const SHOW_DELAY_MS = 2_500;

function shouldOfferOnPath(pathname: string): boolean {
  const p = pathname || "/";
  if (p.startsWith("/admin") || p.startsWith("/studio") || p.startsWith("/api")) return false;
  if (p === "/install" || p.startsWith("/install/")) return false;
  return true;
}

function shouldSuppressPrompt(androidEmail: string): boolean {
  if (isDisplayStandalone()) return true;
  if (isInstallDismissedRecently()) return true;
  if (!APP_INSTALL_IOS_URL && !androidEmail) return true;
  return false;
}

function registerMinimalServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const isLocalDevHost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  if (process.env.NODE_ENV !== "production" || isLocalDevHost) {
    // 本地开发不启用 SW，避免缓存旧的 /_next/static 代码导致调试与上传流程异常。
    void navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((reg) => reg.unregister())))
      .catch(() => {
        /* ignore */
      });
    return;
  }
  void navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then((reg) => {
      void reg.update();
    })
    .catch(() => {
      /* 非 HTTPS 或浏览器不支持时忽略 */
    });
}

/**
 * 打开站点后：显示 App 安装入口（App Store / Android 试用邮件）。
 */
export function PwaInstallPrompt() {
  const { t } = useLocale();
  const pathname = usePathname() ?? "";
  const [visible, setVisible] = useState(false);
  const showTimerRef = useRef<number | null>(null);
  const scheduledRef = useRef(false);
  const androidEmail = resolveAppInstallAndroidEmail();
  const androidMailto = useMemo(
    () =>
      buildAndroidTrialMailto(
        t("chrome.pwaInstallAndroidMailSubject"),
        t("chrome.pwaInstallAndroidMailBody"),
      ),
    [t],
  );

  const clearShowTimer = useCallback(() => {
    if (showTimerRef.current != null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearShowTimer();
    setVisible(false);
  }, [clearShowTimer]);

  const scheduleShow = useCallback(
    () => {
      if (scheduledRef.current || shouldSuppressPrompt(androidEmail) || !shouldOfferOnPath(pathname)) {
        return;
      }
      scheduledRef.current = true;
      clearShowTimer();
      showTimerRef.current = window.setTimeout(() => {
        showTimerRef.current = null;
        if (shouldSuppressPrompt(androidEmail) || !shouldOfferOnPath(pathname)) return;
        setVisible(true);
      }, SHOW_DELAY_MS);
    },
    [androidEmail, clearShowTimer, pathname],
  );

  const onDismiss = useCallback(() => {
    markInstallDismissed();
    hide();
  }, [hide]);

  useEffect(() => {
    registerMinimalServiceWorker();
  }, []);

  useEffect(() => {
    if (!shouldOfferOnPath(pathname)) hide();
  }, [hide, pathname]);

  useEffect(() => {
    if (shouldSuppressPrompt(androidEmail)) return;
    scheduleShow();

    return () => {
      clearShowTimer();
    };
  }, [androidEmail, clearShowTimer, scheduleShow]);

  if (!visible) return null;

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
        {t("chrome.pwaInstallBody")}
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {androidEmail ? (
          <a
            href={androidMailto}
            className="rounded-full border border-border/60 bg-ink/[0.06] px-3.5 py-1.5 text-[13px] font-medium text-ink transition hover:bg-ink/[0.1]"
          >
            {t("chrome.pwaInstallActionAndroid")}
          </a>
        ) : null}
        {APP_INSTALL_IOS_URL ? (
          <a
            href={APP_INSTALL_IOS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-border/60 bg-ink/[0.06] px-3.5 py-1.5 text-[13px] font-medium text-ink transition hover:bg-ink/[0.1]"
          >
            {t("chrome.pwaInstallActionIos")}
          </a>
        ) : null}
        <Link
          href="/install"
          className="rounded-full px-3 py-1.5 text-[13px] text-ink/65 transition hover:text-ink"
        >
          {t("install.guideLink")}
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full px-3 py-1.5 text-[13px] text-ink/65 transition hover:text-ink"
        >
          {t("chrome.pwaInstallDismiss")}
        </button>
      </div>
    </div>
  );
}
