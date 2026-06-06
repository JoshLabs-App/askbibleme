import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * 与 Next 站点同源请求自然配置、静态资源。
 * - 生产：`EXPO_PUBLIC_ASKBIBLE_BASE_URL=https://askbible.me`
 * - iOS 模拟器：`localhost:3450`（勿改成局域网 IP）
 * - Android 模拟器：`10.0.2.2:3450`
 * - 真机 Wi‑Fi：`http://<Mac-LAN-IP>:3450`（见 `env.device.example`）
 * - 真机 USB（adb reverse）：`http://127.0.0.1:3450`
 */
function isAndroidEmulator(): boolean {
  if (Platform.OS !== "android") return false;
  if (Constants.isDevice === false) return true;
  const hint = `${Constants.modelName ?? ""} ${Constants.brand ?? ""} ${Constants.deviceName ?? ""}`.toLowerCase();
  return /sdk_gphone|emulator|generic_x86|android sdk built for x86/.test(hint);
}

function isAndroidPhysicalDevice(): boolean {
  return Platform.OS === "android" && !isAndroidEmulator();
}

function metroLanHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return null;
  const host = hostUri.split(":")[0]?.trim();
  if (!host || host === "localhost" || host === "127.0.0.1") return null;
  return host;
}

function isIosSimulator(): boolean {
  if (Platform.OS !== "ios") return false;
  if (Constants.platform?.ios?.simulator === true) return true;
  if (Constants.isDevice === false) return true;
  const name = (Constants.deviceName ?? "").toLowerCase();
  return name.includes("simulator");
}

function isIosPhysicalDevice(): boolean {
  return Platform.OS === "ios" && !isIosSimulator();
}

function devPortFromBase(configured: string): string {
  try {
    const u = new URL(configured.startsWith("http") ? configured : `http://${configured}`);
    return u.port || "3450";
  } catch {
    return "3450";
  }
}

function resolveDevBaseUrl(configured: string): string {
  const trimmed = configured.replace(/\/$/, "");
  if (!__DEV__) return trimmed;

  if (isAndroidEmulator()) {
    try {
      const u = new URL(trimmed.startsWith("http") ? trimmed : `http://${trimmed}`);
      if (isLocalDevHost(u.hostname)) {
        u.hostname = "10.0.2.2";
        return u.toString().replace(/\/$/, "");
      }
    } catch {
      return trimmed.replace(/localhost/g, "10.0.2.2").replace(/127\.0\.0\.1/g, "10.0.2.2");
    }
  }

  if (isIosSimulator()) {
    return `http://localhost:${devPortFromBase(trimmed)}`;
  }

  if (/localhost|127\.0\.0\.1/.test(trimmed)) {
    const lan = metroLanHost();
    if (lan) return trimmed.replace(/localhost/g, lan).replace(/127\.0\.0\.1/g, lan);
  }

  // iPhone 真机开发：仅在 loopback 配置下回退云端；LAN IP 视为显式本机联调，保持本地地址。
  if (isIosPhysicalDevice()) {
    try {
      const u = new URL(trimmed.startsWith("http") ? trimmed : `http://${trimmed}`);
      if (isLoopbackDevHost(u.hostname)) return "https://askbible.me";
    } catch {
      return "https://askbible.me";
    }
  }
  return trimmed;
}

function isLocalDevHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  if (!h) return true;
  if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) return true;
  if (h.startsWith("10.") || h.startsWith("192.168.")) return true;
  const m = h.match(/^172\.(\d+)\./);
  if (m) {
    const octet = Number(m[1]);
    if (Number.isFinite(octet) && octet >= 16 && octet <= 31) return true;
  }
  return false;
}

function isLoopbackDevHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  if (!h) return true;
  return h === "localhost" || h === "127.0.0.1" || h.endsWith(".local");
}

function normalizeIosRemoteHttp(url: string): string {
  if (Platform.OS !== "ios" || __DEV__) return url;
  if (!/^http:\/\//i.test(url)) return url;
  try {
    const u = new URL(url);
    if (isLocalDevHost(u.hostname)) return url;
    u.protocol = "https:";
    return u.toString();
  } catch {
    return url;
  }
}

export function getAskBibleBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_ASKBIBLE_BASE_URL?.trim();
  if (fromEnv) return resolveDevBaseUrl(fromEnv);
  if (__DEV__) {
    const port = "3450";
    if (isAndroidEmulator()) return `http://10.0.2.2:${port}`;
    if (isIosSimulator()) return `http://localhost:${port}`;
    if (isIosPhysicalDevice()) return "https://askbible.me";
    if (isAndroidPhysicalDevice()) {
      const lan = metroLanHost();
      return lan ? `http://${lan}:${port}` : `http://localhost:${port}`;
    }
    const lan = metroLanHost();
    return lan ? `http://${lan}:${port}` : `http://localhost:${port}`;
  }
  return "https://askbible.me";
}

export function toAbsoluteUrl(baseUrl: string, src: string): string {
  const s = src.trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return normalizeIosRemoteHttp(s);
  const path = s.startsWith("/") ? s : `/${s}`;
  try {
    return normalizeIosRemoteHttp(new URL(path, baseUrl).href);
  } catch {
    return normalizeIosRemoteHttp(s);
  }
}
