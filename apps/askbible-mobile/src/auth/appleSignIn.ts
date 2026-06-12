import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

export type NativeAppleSignInResult =
  | { ok: true; idToken: string; nonce: string; displayName?: string }
  | { ok: false; error: string; code?: string };

export async function isNativeAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

function formatAppleFullName(
  fullName: AppleAuthentication.AppleAuthenticationFullName | null,
): string | undefined {
  if (!fullName) return undefined;
  const parts = [fullName.givenName, fullName.familyName].filter(Boolean);
  const joined = parts.join(" ").trim();
  return joined || undefined;
}

export async function signInWithAppleNative(): Promise<NativeAppleSignInResult> {
  if (!(await isNativeAppleSignInAvailable())) {
    return { ok: false, error: "apple_not_available", code: "apple_not_available" };
  }

  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      return { ok: false, error: "apple_no_token", code: "apple_no_token" };
    }

    return {
      ok: true,
      idToken: credential.identityToken,
      nonce: rawNonce,
      displayName: formatAppleFullName(credential.fullName),
    };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";
    if (code === "ERR_REQUEST_CANCELED") {
      return { ok: false, error: "apple_cancelled", code: "apple_cancelled" };
    }
    return { ok: false, error: "apple_failed", code: "apple_failed" };
  }
}
