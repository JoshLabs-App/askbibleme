/**
 * iOS / iPadOS（含「桌面模式」iPad）WebKit。
 * 此类环境下 `HTMLMediaElement.volume` 常不可调，静音需 `muted` 或 `pause()`。
 */
export function isIosLikeUserAgent(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
  return false;
}
