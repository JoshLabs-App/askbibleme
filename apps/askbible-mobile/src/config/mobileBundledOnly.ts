/**
 * 全局离线优先开关：
 * - `1`：完全离线模式（禁止请求网站）
 * - `0`：允许联网模式（用于联调）
 * - 未设置：默认开启（离线优先）
 */
export function isMobileOfflineFirst(): boolean {
  const flag = process.env.EXPO_PUBLIC_MOBILE_OFFLINE_FIRST?.trim();
  if (flag === "0") return false;
  if (flag === "1") return true;
  return true;
}

/** Release 侧载包：为 `1` 时仅使用 APK 内打包的 JSON / SQLite / 媒体，不请求 askbible.me。 */
export function isMobileBundledOnly(): boolean {
  if (isMobileOfflineFirst()) return true;
  const flag = process.env.EXPO_PUBLIC_MOBILE_BUNDLED_ONLY?.trim();
  if (flag === "0") return false;
  if (flag === "1") return true;
  /** 非开发构建默认纯本地（EAS production / 本机 assembleRelease）。 */
  return !__DEV__;
}

export { isMemberRegisterEnabled } from "../auth/member-register-enabled";
