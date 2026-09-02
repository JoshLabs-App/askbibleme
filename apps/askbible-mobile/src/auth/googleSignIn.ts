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

async function signInWithSupabaseIdToken(
  idToken: string,
  nonce?: string,
): Promise<GoogleSignInMobileResult> {
  if (!isSupabaseAuthConfigured()) {
    return { ok: false, error: "google_not_configured", code: "google_not_configured" };
  }
  const { signInWithGoogleIdTokenInApp } = await import("./googleOAuthSession");
  const direct = await signInWithGoogleIdTokenInApp(idToken, nonce);
  if (!direct.ok) {
    authTrace("supabase signInWithIdToken failed", `${direct.code} ${direct.error}`);
  }
  return mapSupabaseDirectResult(direct);
}

/** 原生 idToken → 会话：优先 Supabase（不依赖 Mac 本地 API）。 */
async function exchangeGoogleIdToken(idToken: string, nonce?: string): Promise<GoogleSignInMobileResult> {
  const direct = await signInWithSupabaseIdToken(idToken, nonce);
  if (direct.ok || (direct.code !== "network" && direct.code !== "google_nonce_mismatch")) {
    return direct;
  }

  if (direct.code === "google_nonce_mismatch") {
    // Caller may fall back to browser OAuth; keep code for that branch.
    return direct;
  }

  authTrace("supabase unreachable, trying production API");
  const { loginMobileMemberWithGoogleAt, MOBILE_OAUTH_EDGE_FUNCTION_BASE_URL } = await import("../api/memberAuth");
  return mapApiLoginResult(
    await loginMobileMemberWithGoogleAt(MOBILE_OAUTH_EDGE_FUNCTION_BASE_URL, {
      idToken,
      locale: getLocale(),
    }),
  );
}

/**
 * Google 登录：
 * - 原生 SDK 可用时只走原生（选帐户一次）；失败不回落浏览器，避免第二次选帐户
 * - 未启用原生时走 Supabase / 生产浏览器 OAuth（一次）
 */
export async function signInWithGoogleMobile(): Promise<GoogleSignInMobileResult> {
  try {
    if (isNativeGoogleSignInReady()) {
      authTrace("path", "native Google SDK");
      const nativeMod = await import("./googleSignInNativeImpl");
      const nativeId = await nativeMod.signInWithGoogleNativeIdToken();
      if (!nativeId.ok) {
        authTrace("native idToken failed", `${nativeId.code} ${nativeId.error}`);
        // 仅在原生根本未配置/未拉起时回落浏览器；用户已见过帐户选择后禁止再开浏览器 OAuth。
        if (nativeId.code !== "google_not_configured") {
          return nativeId;
        }
        authTrace("native not configured, falling back to browser OAuth");
      } else {
        const exchanged = await exchangeGoogleIdToken(nativeId.idToken, nativeId.nonce);
        if (exchanged.ok || exchanged.code !== "google_nonce_mismatch") {
          return exchanged;
        }
        // 原生 nonce 未生效时（旧二进制未打 patch）再回落浏览器，避免卡死。
        authTrace("native idToken nonce mismatch, falling back to browser OAuth");
      }
    } else {
      authTrace("path", "Supabase browser OAuth");
    }

    const browserMod = await import("./googleOAuthBrowser");
    const browserResult = isSupabaseAuthConfigured()
      ? await browserMod.signInWithGoogleBrowserOAuth()
      : await browserMod.signInWithGoogleProductionOAuth();
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
