/** Android 独立屏：`env(safe-area-inset-top)` 为 0 时的合理下限 */
const ANDROID_STANDALONE_MIN_TOP_PX = 28;
/** Samsung One UI 状态栏（S23 系列等）略高 */
const SAMSUNG_STANDALONE_MIN_TOP_PX = 32;

function readSafeAreaInsetTopPx(): number {
  if (typeof document === "undefined") return 0;
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;top:0;left:0;height:0;width:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);";
  document.documentElement.appendChild(probe);
  const inset = probe.getBoundingClientRect().height;
  probe.remove();
  return inset;
}

function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

function isSamsungDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Samsung|SM-S9|SM-S2/i.test(navigator.userAgent);
}

function isDisplayStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (typeof navigator !== "undefined" &&
      "standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

/**
 * 顶栏 / 刘海与布局视口重叠高度（px）。
 * 供壳层安全区条与羊皮卷 `margin-top` 出血共用。
 */
export function measureAppShellSafeTopPx(): number {
  if (typeof window === "undefined") return 0;

  const envTop = readSafeAreaInsetTopPx();
  if (envTop > 0) return envTop;

  const vv = window.visualViewport;
  if (vv) {
    const offsetTop = Math.round(vv.offsetTop);
    if (offsetTop > 0) return offsetTop;

    const layoutGap = Math.round(window.innerHeight - vv.height - vv.offsetTop);
    if (layoutGap > 0 && layoutGap <= 96) return layoutGap;
  }

  if (isAndroid()) {
    if (isDisplayStandalone()) {
      return isSamsungDevice() ? SAMSUNG_STANDALONE_MIN_TOP_PX : ANDROID_STANDALONE_MIN_TOP_PX;
    }

    const screenGap = Math.round(window.screen.height - window.innerHeight);
    if (screenGap > 20 && screenGap <= 120) return Math.min(screenGap, 56);
  }

  return 0;
}
