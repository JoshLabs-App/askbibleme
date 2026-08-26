import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
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
  configured = true;
  return true;
}

export async function signInWithGoogleNativeIdToken(): Promise<
  | { ok: true; idToken: string; nonce?: string }
  | { ok: false; error: string; code?: string }
> {
  if (!ensureGoogleSignInConfigured()) {
    return { ok: false, error: "google_not_configured", code: "google_not_configured" };
  }

  const { GoogleSignin, statusCodes } = await import("@react-native-google-signin/google-signin");
  try {
    const webClientId = getGoogleWebClientId()!;
    const iosClientId = getGoogleIosClientId();
    GoogleSignin.configure({
      webClientId,
      ...(Platform.OS === "ios" && iosClientId ? { iosClientId } : null),
    });
    if (Platform.OS === "android") {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    // iOS AppAuth embeds nonce in id_token; Supabase needs the raw value.
    // Pass SHA-256(raw) to Google (same pattern as Apple Sign In).
    let rawNonce: string | undefined;
    let signInOptions: { loginHint?: string; nonce?: string } | undefined;
    if (Platform.OS === "ios") {
      rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      signInOptions = { nonce: hashedNonce };
    }

    const result = await GoogleSignin.signIn(signInOptions as Parameters<typeof GoogleSignin.signIn>[0]);
    const idToken = result.data?.idToken;
    if (!idToken) return { ok: false, error: "google_auth_failed", code: "google_auth_failed" };
    return rawNonce ? { ok: true, idToken, nonce: rawNonce } : { ok: true, idToken };
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    if (code === statusCodes.SIGN_IN_CANCELLED) return { ok: false, error: "google_cancelled", code: "google_cancelled" };
    if (code === statusCodes.IN_PROGRESS) return { ok: false, error: "google_in_progress", code: "google_failed" };
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return { ok: false, error: "google_play_services", code: "google_play_services" };
    }
    return { ok: false, error: error instanceof Error ? error.message : "google_auth_failed", code: "google_auth_failed" };
  }
}
