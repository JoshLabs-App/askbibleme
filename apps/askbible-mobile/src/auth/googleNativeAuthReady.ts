import Constants from "expo-constants";
import { Platform } from "react-native";
import { getGoogleAndroidClientId, isGoogleSignInConfigured } from "../config/googleAuth";

function getGoogleAuthExtra(): { iosUrlScheme?: string | null } {
  const extra = Constants.expoConfig?.extra?.googleAuth;
  if (!extra || typeof extra !== "object") return {};
  return extra as { iosUrlScheme?: string | null };
}

/** Config-only check — does not import `@react-native-google-signin` (may be unlinked). */
export function isNativeGoogleSignInReady(): boolean {
  if (!isGoogleSignInConfigured()) return false;

  if (Platform.OS === "ios") {
    // Require explicit runtime env — ignore stale iosClientId baked into old native builds.
    // Native path uses a postinstall patch so GIDSignIn receives a custom nonce for Supabase.
    return Boolean(getGoogleAuthExtra().iosUrlScheme);
  }

  if (Platform.OS === "android") {
    // 默认走浏览器 OAuth；仅显式配置 Android client 时才启用原生（避免选完帐户又回落浏览器再选一次）。
    return Boolean(getGoogleAndroidClientId());
  }

  return false;
}
