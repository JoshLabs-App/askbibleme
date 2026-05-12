import { Platform } from "react-native";

/**
 * 与 Next 站点同源请求自然配置、静态资源。
 * - 生产：在 `.env` 或 EAS 里设置 `EXPO_PUBLIC_SELAH_BASE_URL=https://你的域名`（无末尾 `/`）。
 * - 开发：未设置时 Android 模拟器用 `10.0.2.2` 访问本机 Next（默认端口 3450，与仓库 `npm run dev` 一致）；iOS 模拟器用 `localhost`。
 */
export function getSelahBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_SELAH_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (__DEV__) {
    return Platform.OS === "android" ? "http://10.0.2.2:3450" : "http://localhost:3450";
  }
  return "https://selah.my";
}

export function toAbsoluteUrl(baseUrl: string, src: string): string {
  const s = src.trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  const path = s.startsWith("/") ? s : `/${s}`;
  try {
    return new URL(path, baseUrl).href;
  } catch {
    return s;
  }
}
