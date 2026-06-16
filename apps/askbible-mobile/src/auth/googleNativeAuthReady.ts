import Constants from "expo-constants";
import { Platform } from "react-native";
import { getGoogleAndroidClientId, isGoogleSignInConfigured } from "../config/googleAuth";

function getGoogleAuthExtra(): { iosUrlScheme?: string | null } {
  const extra = Constants.expoConfig?.extra?.googleAuth;
  if (!extra || typeof extra !== "object") return {};
  return extra as { iosUrlScheme?: string | null };
}

function runtimeEnv(name: string): string {
  const raw = process.env[name];
  return typeof raw === "string" ? raw.trim() : "";
}

/** Config-only check — does not import `@react-native-google-signin` (may be unlinked). */
export function isNativeGoogleSignInReady(): boolean {
  if (!isGoogleSignInConfigured()) return false;

  if (Platform.OS === "ios") {
    // Require explicit runtime env — ignore stale iosClientId baked into old native builds.
    return Boolean(runtimeEnv("EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID") && getGoogleAuthExtra().iosUrlScheme);
  }

  if (Platform.OS === "android") {
    // 默认走 Supabase 浏览器 OAuth（见 scripts/mobile-google-oauth-setup.sh）。
    // 原生 Sign-In 需 GCP Android client + SHA-1，显式配置 EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID 后才启用。
    return Boolean(getGoogleAndroidClientId() || runtimeEnv("EXPO_PUBLIC_GOOGLE_ANDROID_NATIVE"));
  }

  return false;
}
