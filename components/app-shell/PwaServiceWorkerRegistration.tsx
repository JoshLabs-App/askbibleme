"use client";

import { useEffect } from "react";

function registerMinimalServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const isLocalDevHost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  if (process.env.NODE_ENV !== "production" || isLocalDevHost) {
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

/** 仅注册 PWA Service Worker；安装入口已移至探索页底部弱提示。 */
export function PwaServiceWorkerRegistration() {
  useEffect(() => {
    registerMinimalServiceWorker();
  }, []);

  return null;
}
