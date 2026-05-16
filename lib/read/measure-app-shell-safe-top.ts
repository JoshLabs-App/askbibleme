import { isSamsungGalaxyUa } from "@/lib/read/parchment-samsung-device";

/** Android 独立屏：`env(safe-area-inset-top)` 为 0 时的合理下限 */
const ANDROID_STANDALONE_MIN_TOP_PX = 28;
/** Samsung One UI 状态栏（S23 / S23 Ultra 等）略高 */
const SAMSUNG_STANDALONE_MIN_TOP_PX = 32;

function readSafeAreaInsetTopPx(): number {
  if (typeof document === "undefined") return 0;
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;top:0;left:0;height:0;width:0;visibility:hidden;pointer-events:none;" +
    "padding-top:constant(safe-area-inset-top,0px);padding-top:env(safe-area-inset-top,0px);";
  document.documentElement.appendChild(probe);
  const inset = probe.getBoundingClientRect().height;
  probe.remove();
  return inset;
}

function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
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

    if (!isAndroid()) {
      const layoutGap = Math.round(window.innerHeight - vv.height - vv.offsetTop);
      if (layoutGap > 0 && layoutGap <= 96) return layoutGap;
    }
  }

  if (isAndroid() && isDisplayStandalone()) {
    return isSamsungGalaxyUa() ? SAMSUNG_STANDALONE_MIN_TOP_PX : ANDROID_STANDALONE_MIN_TOP_PX;
  }

  return 0;
}
