import { getLocale } from "../i18n/locale-store";
import { isSupabaseAuthConfigured } from "../config/supabaseAuth";
import { isNativeGoogleSignInReady } from "./googleNativeAuthReady";
import type { GoogleOAuthSessionResult } from "./googleOAuthSession";

export type GoogleSignInMobileResult =
  | {
      ok: true;
      kind: "session";
      sessionToken: string;
      expiresAt: string;
      user: { id: string; email: string; name: string };
    }
  | { ok: true; kind: "idToken"; idToken: string }
  | { ok: false; error: string; code?: string };

function authTrace(step: string, detail?: string): void {
  if (!__DEV__) return;
  console.log(`[AskBibleAuth] ${step}${detail ? `: ${detail}` : ""}`);
}

function isNetworkErrorMessage(msg: string): boolean {
  return /network request failed|failed to fetch|network error|timed out|internet connection|offline|failed to connect|aborted/i.test(
    msg,
  );
}

function mapSupabaseDirectResult(direct: GoogleOAuthSessionResult): GoogleSignInMobileResult {
  if (direct.ok) {
    return {
      ok: true,
      kind: "session",
      sessionToken: direct.sessionToken,
      expiresAt: direct.expiresAt,
      user: direct.user,
    };
  }
  const msg = direct.error ?? "";
  if (isNetworkErrorMessage(msg)) {
    return { ok: false, error: "network", code: "network" };
  }
  return { ok: false, error: direct.error, code: direct.code };
}

function mapApiLoginResult(
  api: Awaited<ReturnType<typeof import("../api/memberAuth").loginMobileMemberWithGoogleAt>>,
): GoogleSignInMobileResult {
  if (api.ok) {
    return {
      ok: true,
      kind: "session",
      sessionToken: api.sessionToken,
      expiresAt: api.expiresAt,
      user: api.user,
    };
  }
  return { ok: false, error: api.error, code: api.code };
}

async function signInWithSupabaseIdToken(idToken: string): Promise<GoogleSignInMobileResult> {
  if (!isSupabaseAuthConfigured()) {
    return { ok: false, error: "google_not_configured", code: "google_not_configured" };
  }
  const { signInWithGoogleIdTokenInApp } = await import("./googleOAuthSession");
  const direct = await signInWithGoogleIdTokenInApp(idToken);
  if (!direct.ok) {
    authTrace("supabase signInWithIdToken failed", `${direct.code} ${direct.error}`);
  }
  return mapSupabaseDirectResult(direct);
}

/** 原生 idToken → 会话：优先 Supabase（不依赖 Mac 本地 API）。 */
async function exchangeGoogleIdToken(idToken: string): Promise<GoogleSignInMobileResult> {
  const direct = await signInWithSupabaseIdToken(idToken);
  if (direct.ok || direct.code !== "network") return direct;

  authTrace("supabase unreachable, trying production API");
  const { loginMobileMemberWithGoogleAt, MOBILE_AUTH_PRODUCTION_BASE_URL } = await import("../api/memberAuth");
  return mapApiLoginResult(
    await loginMobileMemberWithGoogleAt(MOBILE_AUTH_PRODUCTION_BASE_URL, {
      idToken,
      locale: getLocale(),
    }),
  );
}

async function signInWithNativeGoogle(): Promise<GoogleSignInMobileResult> {
  authTrace("path", "native Google SDK");
  const nativeMod = await import("./googleSignInNativeImpl");
  const native = await nativeMod.signInWithGoogleNativeIdToken();
  if (!native.ok) {
    authTrace("native failed", `${native.code} ${native.error}`);
    return native;
  }
  return exchangeGoogleIdToken(native.idToken);
}

/**
 * Google 登录：
 * - Android 默认 Supabase 浏览器 OAuth（无需 GCP Android client）
 * - iOS 无 native client 时也走浏览器 OAuth
 * - 配置了 Android/iOS native client 时优先原生 SDK
 */
export async function signInWithGoogleMobile(): Promise<GoogleSignInMobileResult> {
  try {
    if (isNativeGoogleSignInReady()) {
      const native = await signInWithNativeGoogle();
      if (native.ok) return native;
      if (native.code === "google_cancelled") return native;
      if (native.code === "google_android_setup" || native.code === "google_play_services") {
        return native;
      }
      authTrace("native failed, falling back to browser OAuth", native.code ?? native.error);
    } else {
      authTrace("path", "Supabase browser OAuth");
    }

    if (!isSupabaseAuthConfigured()) {
      authTrace("blocked", "Supabase env missing");
      return { ok: false, error: "google_not_configured", code: "google_not_configured" };
    }

    const browserMod = await import("./googleOAuthBrowser");
    const browserResult = await browserMod.signInWithGoogleBrowserOAuth();
    if (!browserResult.ok) {
      authTrace("browser OAuth failed", `${browserResult.code} ${browserResult.error}`);
      return browserResult;
    }
    authTrace("browser OAuth ok", browserResult.user.email || browserResult.user.id);
    return {
      ok: true,
      kind: "session",
      sessionToken: browserResult.sessionToken,
      expiresAt: browserResult.expiresAt,
      user: browserResult.user,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    authTrace("unexpected throw", msg);
    if (isNetworkErrorMessage(msg)) {
      return { ok: false, error: "network", code: "network" };
    }
    return { ok: false, error: msg || "google_failed", code: "google_failed" };
  }
}

/** @deprecated Use signInWithGoogleMobile */
export async function signInWithGoogleNative(): Promise<
  | { ok: true; idToken: string }
  | { ok: false; error: string; code?: string }
> {
  if (!isNativeGoogleSignInReady()) {
    return { ok: false, error: "google_not_configured", code: "google_not_configured" };
  }
  const mod = await import("./googleSignInNativeImpl");
  return mod.signInWithGoogleNativeIdToken();
}
