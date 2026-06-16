import { Platform } from "react-native";
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { getGoogleIosClientId, getGoogleWebClientId, isGoogleSignInConfigured } from "../config/googleAuth";

let configured = false;

function ensureGoogleSignInConfigured(): boolean {
  if (!isGoogleSignInConfigured()) return false;
  if (configured) return true;

  const webClientId = getGoogleWebClientId();
  if (!webClientId) return false;

  try {
    GoogleSignin.configure({
      webClientId,
      iosClientId: getGoogleIosClientId() || undefined,
    });
  } catch (error) {
    if (__DEV__) {
      console.warn("[googleSignInNative] configure failed", error);
    }
    return false;
  }
  configured = true;
  return true;
}

export async function signInWithGoogleNativeIdToken(): Promise<
  | { ok: true; idToken: string }
  | { ok: false; error: string; code?: string }
> {
  if (!ensureGoogleSignInConfigured()) {
    return { ok: false, error: "google_not_configured", code: "google_not_configured" };
  }

  try {
    if (Platform.OS === "android") {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    // 清掉 App 内 Google 会话，下次 signIn 会弹出账号选择（避免静默用上次账号）。
    try {
      await GoogleSignin.signOut();
    } catch {
      // optional — first sign-in or already signed out
    }
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) {
      return { ok: false, error: "google_cancelled", code: "google_cancelled" };
    }
    const idToken = response.data.idToken;
    if (!idToken) {
      return { ok: false, error: "google_no_token", code: "google_no_token" };
    }
    return { ok: true, idToken };
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        return { ok: false, error: "google_cancelled", code: "google_cancelled" };
      }
      if (error.code === statusCodes.IN_PROGRESS) {
        return { ok: false, error: "google_in_progress", code: "google_in_progress" };
      }
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return { ok: false, error: "google_play_services", code: "google_play_services" };
      }
      if (error.code === "10" || String(error.message).includes("DEVELOPER_ERROR")) {
        return { ok: false, error: "google_android_setup", code: "google_android_setup" };
      }
    }
    if (__DEV__) {
      console.warn("[googleSignInNative]", error);
    }
    return { ok: false, error: "google_failed", code: "google_failed" };
  }
}
