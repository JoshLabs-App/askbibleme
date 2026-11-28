import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./tokens/tokens.css";
import "./tokens/base.css";
import { App } from "./App";
import { isNativeShell } from "./bridge/platform-adapter";
import { startSilentUpdater } from "./updater/silent-updater";

startSilentUpdater();

// 仅纯浏览器环境注册 Service Worker；原生轻壳内严禁重复注册
if (!isNativeShell() && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline or dev preview without SW
    });
  });
}

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
