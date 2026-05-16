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
  var color = dark ? "#1a1512" : "#ecd9b9";
  var w = window.innerWidth || 0;
  var h = window.innerHeight || 1;
  var wide = w >= 480 && (w > h || w / h >= 4 / 3);
  var bgUrl = wide ? "/read/parchment-scroll-bg-wide.jpg" : "/read/parchment-scroll-bg.jpg";

  html.dataset.appShellSafeFill = "parchment";
  html.style.backgroundColor = color;
  html.style.backgroundImage = "url(" + bgUrl + ")";
  html.style.backgroundRepeat = "no-repeat";
  html.style.backgroundSize = "100% 100%";
  html.style.backgroundPosition = "center center";
  html.style.colorScheme = dark ? "dark" : "light";

  var topPx = 32;
  try {
    var probe = document.createElement("div");
    probe.style.cssText =
      "position:fixed;top:0;left:0;height:0;width:0;visibility:hidden;padding-top:env(safe-area-inset-top,0px);";
    html.appendChild(probe);
    var envTop = probe.getBoundingClientRect().height;
    probe.remove();
    if (envTop > 0) topPx = Math.round(envTop);
    else if (/Samsung|SM-S9/i.test(navigator.userAgent)) topPx = 32;
    else if (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches
    ) {
      topPx = 28;
    }
  } catch (e) {}

  html.style.setProperty("--app-shell-safe-top-effective", topPx + "px");
  html.style.setProperty("--app-shell-safe-top-fallback", topPx + "px");

  var metas = document.querySelectorAll('meta[name="theme-color"]');
  for (var i = 0; i < metas.length; i++) metas[i].setAttribute("content", color);
})();
`.trim();
