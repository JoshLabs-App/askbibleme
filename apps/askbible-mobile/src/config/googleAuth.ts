import Constants from "expo-constants";

type GoogleAuthExtra = {
  webClientId?: string | null;
  iosClientId?: string | null;
  androidClientId?: string | null;
  iosUrlScheme?: string | null;
};

function readExtra(): GoogleAuthExtra {
  const extra = Constants.expoConfig?.extra?.googleAuth;
  if (!extra || typeof extra !== "object") return {};
  return extra as GoogleAuthExtra;
}

function trim(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const next = value.trim();
  return next || null;
}

export function getGoogleWebClientId(): string | null {
  return (
    trim(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) ||
    trim(readExtra().webClientId) ||
    trim(process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID) ||
    null
  );
}

export function getGoogleIosClientId(): string | null {
  return trim(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) || trim(readExtra().iosClientId) || null;
}

export function getGoogleAndroidClientId(): string | null {
  return trim(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID) || trim(readExtra().androidClientId) || null;
}

export function isGoogleSignInConfigured(): boolean {
  return Boolean(getGoogleWebClientId());
}
