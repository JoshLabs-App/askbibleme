/**
 * 在 React 水合前执行：读经/祷告 PWA 首帧即改 `theme-color` 与根节点羊皮底，避免 Samsung 等仍露 manifest 深青顶栏。
 * 由 `app/layout.tsx` 以 `beforeInteractive` 注入。
 */
export const PARCHMENT_SHELL_BOOT_SCRIPT = `
(function () {
  var p = window.location.pathname;
  if (p !== "/read" && p.indexOf("/read/") !== 0 && p !== "/prayer" && p.indexOf("/prayer/") !== 0) return;

  var html = document.documentElement;
  var dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  var canvas = dark ? "#1a1512" : "#ecd9b9";
  var ua = navigator.userAgent || "";
  var samsung =
    /SamsungBrowser/i.test(ua) || /Samsung/i.test(ua) || /\\bSM-[A-Z]\\d/i.test(ua);
  var statusBar = samsung ? (dark ? "#1a151200" : "#ecd9b900") : "transparent";

  html.dataset.appShellSafeFill = "parchment";
  if (samsung) html.dataset.readParchmentSamsung = "1";
  html.style.backgroundColor = canvas;
  html.style.colorScheme = dark ? "dark" : "light";

  var topPx = 0;
  try {
    var probe = document.createElement("div");
    probe.style.cssText =
      "position:fixed;top:0;left:0;height:0;width:0;visibility:hidden;" +
      "padding-top:constant(safe-area-inset-top,0px);padding-top:env(safe-area-inset-top,0px);";
    html.appendChild(probe);
    var envTop = probe.getBoundingClientRect().height;
    probe.remove();
    if (envTop > 0) {
      topPx = Math.round(envTop);
    } else if (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches
    ) {
      topPx = samsung ? 32 : 28;
    }
  } catch (e) {}

  if (topPx > 0) {
    html.style.setProperty("--app-shell-safe-top-effective", topPx + "px");
    html.style.setProperty("--app-shell-safe-top-fallback", topPx + "px");
  }

  var metas = document.querySelectorAll('meta[name="theme-color"]');
  for (var i = 0; i < metas.length; i++) metas[i].setAttribute("content", statusBar);
})();
`.trim();
