import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import {
  getGoogleIosClientId,
  getGoogleWebClientId,
  isGoogleSignInConfigured,
} from "../config/googleAuth";

let configured = false;

function ensureGoogleSignInConfigured(): boolean {
  if (!isGoogleSignInConfigured()) return false;
  if (configured) return true;

  const webClientId = getGoogleWebClientId();
  if (!webClientId) return false;

  GoogleSignin.configure({
    webClientId,
    iosClientId: getGoogleIosClientId() || undefined,
  });
  configured = true;
  return true;
}

export type NativeGoogleSignInResult =
  | { ok: true; idToken: string }
  | { ok: false; error: string; code?: string };

export function isNativeGoogleSignInAvailable(): boolean {
  return isGoogleSignInConfigured();
}

export async function signInWithGoogleNative(): Promise<NativeGoogleSignInResult> {
  if (!ensureGoogleSignInConfigured()) {
    return { ok: false, error: "google_not_configured", code: "google_not_configured" };
  }

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
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
    }
    return { ok: false, error: "google_failed", code: "google_failed" };
  }
}
