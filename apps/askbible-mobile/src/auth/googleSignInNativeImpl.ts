import { getGoogleWebClientId, isGoogleSignInConfigured } from "../config/googleAuth";

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
  | { ok: true; idToken: string }
  | { ok: false; error: string; code?: string }
> {
  if (!ensureGoogleSignInConfigured()) {
    return { ok: false, error: "google_not_configured", code: "google_not_configured" };
  }

  // 原生 Google Sign-In 依赖已从当前 release 路径移除。
  // 保留这个入口只是为了让旧的 native 分支在运行时自动回落到浏览器 OAuth。
  if (__DEV__) {
    console.warn("[googleSignInNative] native SDK disabled in this build, falling back");
  }
  return { ok: false, error: "google_not_configured", code: "google_not_configured" };
}
