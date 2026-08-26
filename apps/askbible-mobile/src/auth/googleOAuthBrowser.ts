import "./webCryptoPolyfill";
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import { AppState, Linking, Platform } from "react-native";
import { getSupabaseUrl, isSupabaseAuthConfigured } from "../config/supabaseAuth";
import {
  beginGoogleOAuthCallbackWait,
  cancelGoogleOAuthCallbackWait,
  deliverGoogleOAuthCallback,
} from "./googleOAuthPending";
import { exchangeOAuthCallbackOnce } from "./googleOAuthExchange";
import { installGoogleOAuthLinkingCapture } from "./googleOAuthLinking";
import {
  createMobileSupabaseClient,
  isGoogleOAuthCallbackUrl,
  type GoogleOAuthSessionResult,
} from "./googleOAuthSession";

installGoogleOAuthLinkingCapture();

/** HTTPS 回落页（Supabase 已有 /auth/mobile-callback） */
export const GOOGLE_OAUTH_HTTPS_REDIRECT_URI = "https://askbible.me/auth/mobile-callback";

export const GOOGLE_OAUTH_APP_REDIRECT_URI = "askbible://auth/callback";
export const GOOGLE_PRODUCTION_OAUTH_URL =
  "https://askbible.me/auth/callback?flow=mobile&provider=google&redirect_to=askbible://auth/callback";

export function getGoogleOAuthRedirectUri(): string {
  const mode = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_REDIRECT_MODE?.trim().toLowerCase();
  if (mode === "https" || mode === "web") {
    const override = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_REDIRECT_BASE_URL?.trim();
    if (override) {
      return `${override.replace(/\/$/, "")}/auth/callback?flow=mobile`;
    }
    return GOOGLE_OAUTH_HTTPS_REDIRECT_URI;
  }

  // App 内发起的登录默认回到 App；HTTPS 仅作为显式配置的回落方式。
  return GOOGLE_OAUTH_APP_REDIRECT_URI;
}

export function getGoogleOAuthAuthSessionRedirectPrefix(redirectTo: string): string {
  if (redirectTo.startsWith("askbible://")) return GOOGLE_OAUTH_APP_REDIRECT_URI;
  try {
    const u = new URL(redirectTo);
    return `${u.origin}${u.pathname}`;
  } catch {
    return redirectTo.split("?")[0] ?? redirectTo;
  }
}

export type GoogleBrowserOAuthResult = GoogleOAuthSessionResult;

async function resolveGoogleUserFromAccessToken(
  accessToken: string,
): Promise<{ id: string; email: string; name: string } | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      sub?: string;
      id?: string;
      email?: string;
      name?: string;
    };
    const id = (data.sub || data.id || "").trim();
    if (!id) return null;
    return {
      id,
      email: (data.email || "").trim(),
      name: (data.name || "").trim() || "Google",
    };
  } catch {
    return null;
  }
}

/** 无本地 Supabase 配置时，沿用 AskBible3 已验证的生产 OAuth 回落。 */
export async function signInWithGoogleProductionOAuth(): Promise<GoogleBrowserOAuthResult> {
  const pendingWait = beginGoogleOAuthCallbackWait();
  try {
    const WebBrowser = await import("expo-web-browser");
    WebBrowser.maybeCompleteAuthSession();
    const result = await WebBrowser.openAuthSessionAsync(
      GOOGLE_PRODUCTION_OAUTH_URL,
      GOOGLE_OAUTH_APP_REDIRECT_URI,
      { preferEphemeralSession: true, showInRecents: false },
    );
    const callbackUrl = result.type === "success" ? result.url : await pendingWait.catch(() => null);
    if (!callbackUrl) return { ok: false, error: "google_cancelled", code: "google_cancelled" };
    const fragment = callbackUrl.split("#")[1] || callbackUrl.split("?")[1] || "";
    const params = new URLSearchParams(fragment);
    const accessToken = params.get("access_token")?.trim();
    if (!accessToken) return { ok: false, error: "missing_access_token", code: "google_failed" };
    const user = await resolveGoogleUserFromAccessToken(accessToken);
    if (!user) return { ok: false, error: "missing_google_user", code: "google_failed" };
    return {
      ok: true,
      sessionToken: accessToken,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      user,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (Platform.OS === "android") {
      await Linking.openURL(GOOGLE_PRODUCTION_OAUTH_URL);
      const callbackUrl = await pendingWait.catch(() => null);
      const fragment = callbackUrl?.split("#")[1] || callbackUrl?.split("?")[1] || "";
      const accessToken = new URLSearchParams(fragment).get("access_token")?.trim();
      if (accessToken) {
        const user = await resolveGoogleUserFromAccessToken(accessToken);
        if (!user) return { ok: false, error: "missing_google_user", code: "google_failed" };
        return {
          ok: true,
          sessionToken: accessToken,
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          user,
        };
      }
    }
    return { ok: false, error: msg || "google_failed", code: "google_failed" };
  } finally {
    cancelGoogleOAuthCallbackWait();
    await dismissOAuthBrowser();
  }
}

function isNetworkErrorMessage(msg: string): boolean {
  return /network request failed|failed to fetch|network error|timed out|internet connection|offline|failed to connect|aborted/i.test(
    msg,
  );
}

function isMissingNativeModuleError(msg: string): boolean {
  return /cannot find native module|native module cannot be null|expo-web-browser/i.test(msg);
}

async function dismissOAuthBrowser(): Promise<void> {
  try {
    const WebBrowser = await import("expo-web-browser");
    WebBrowser.dismissBrowser?.();
    WebBrowser.maybeCompleteAuthSession();
  } catch {
    // optional
  }
}

async function resolveOAuthCallbackUrl(
  authSessionResult: { type: string; url?: string },
  pendingWait: Promise<string>,
): Promise<string | null> {
  if (authSessionResult.type === "success" && authSessionResult.url && isGoogleOAuthCallbackUrl(authSessionResult.url)) {
    cancelGoogleOAuthCallbackWait();
    return authSessionResult.url;
  }
  if (authSessionResult.type === "cancel" || authSessionResult.type === "dismiss") {
    cancelGoogleOAuthCallbackWait();
    return null;
  }

  try {
    return await pendingWait;
  } catch {
    return null;
  }
}

const ANDROID_OAUTH_DISMISS_GRACE_MS = 2500;

function takeOAuthCallbackUrl(url: string | null | undefined): string | null {
  return url && isGoogleOAuthCallbackUrl(url) ? url : null;
}

/**
 * Android Custom Tab + singleTask 深链回 App 时，openAuthSessionAsync 可能长期不 resolve，
 * 或先以 dismiss 结束（深链已把 Activity 拉回）。立刻当取消会清掉 pendingWait，授权码就丢了。
 * 与 Linking 深链 pendingWait 并行，谁先拿到 callback URL 谁赢。
 */
async function waitForGoogleOAuthCallbackUrl(
  authSessionPromise: Promise<{ type: string; url?: string }>,
  pendingWait: Promise<string>,
): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    let dismissGrace: ReturnType<typeof setTimeout> | null = null;
    const finish = (url: string | null) => {
      if (settled) return;
      settled = true;
      if (dismissGrace) clearTimeout(dismissGrace);
      cancelGoogleOAuthCallbackWait();
      resolve(url);
    };

    pendingWait
      .then((url) => finish(takeOAuthCallbackUrl(url)))
      .catch(() => finish(null));

    void authSessionPromise
      .then((result) => {
        const successUrl = result.type === "success" ? takeOAuthCallbackUrl(result.url) : null;
        if (successUrl) {
          finish(successUrl);
          return;
        }
        if (result.type !== "cancel" && result.type !== "dismiss") return;
        if (Platform.OS !== "android") {
          finish(null);
          return;
        }
        void Linking.getInitialURL().then((url) => {
          const callback = takeOAuthCallbackUrl(url);
          if (callback) finish(callback);
        });
        dismissGrace = setTimeout(() => finish(null), ANDROID_OAUTH_DISMISS_GRACE_MS);
      })
      .catch(() => finish(null));
  });
}

export async function signInWithGoogleBrowserOAuth(): Promise<GoogleBrowserOAuthResult> {
  if (!isSupabaseAuthConfigured()) {
    return { ok: false, error: "google_not_configured", code: "google_not_configured" };
  }

  const supabase = createMobileSupabaseClient();
  if (!supabase) {
    return { ok: false, error: "google_not_configured", code: "google_not_configured" };
  }

  const redirectTo = getGoogleOAuthRedirectUri();
  const authSessionRedirect = getGoogleOAuthAuthSessionRedirectPrefix(redirectTo);

  if (__DEV__) {
    console.log("[AskBibleAuth] browser OAuth redirectTo=", redirectTo);
  }

  let data: { url?: string | null } | null = null;
  let oauthError: { message?: string } | null = null;
  try {
    const result = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: {
          prompt: "select_account",
        },
      },
    });
    data = result.data;
    oauthError = result.error;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (__DEV__) {
      console.error("[AskBibleAuth] signInWithOAuth threw", msg);
    }
    return {
      ok: false,
      error: isNetworkErrorMessage(msg) ? "network" : msg || "google_failed",
      code: isNetworkErrorMessage(msg) ? "network" : "google_failed",
    };
  }

  if (oauthError || !data?.url) {
    const msg = oauthError?.message?.trim() || "google_failed";
    if (__DEV__) {
      console.error("[AskBibleAuth] signInWithOAuth failed", msg);
    }
    return {
      ok: false,
      error: isNetworkErrorMessage(msg) ? "network" : msg,
      code: isNetworkErrorMessage(msg) ? "network" : "google_failed",
    };
  }

  const pendingWait = beginGoogleOAuthCallbackWait();
  const resumePoll =
    Platform.OS === "android"
      ? AppState.addEventListener("change", (state) => {
          if (state !== "active") return;
          void Linking.getInitialURL().then((url) => {
            if (url && isGoogleOAuthCallbackUrl(url)) deliverGoogleOAuthCallback(url);
          });
        })
      : null;

  try {
    let callbackUrl: string | null = null;

    try {
      const WebBrowser = await import("expo-web-browser");
      WebBrowser.maybeCompleteAuthSession();
      const authSessionPromise = WebBrowser.openAuthSessionAsync(
        data.url,
        authSessionRedirect,
        { preferEphemeralSession: true, showInRecents: false },
      );
      callbackUrl =
        Platform.OS === "android"
          ? await waitForGoogleOAuthCallbackUrl(authSessionPromise, pendingWait)
          : await resolveOAuthCallbackUrl(await authSessionPromise, pendingWait);
    } catch (browserErr) {
      const msg = browserErr instanceof Error ? browserErr.message : String(browserErr);
      if (__DEV__) {
        console.error("[AskBibleAuth] openAuthSessionAsync failed, trying Linking.openURL", msg);
      }
      if (Platform.OS === "android") {
        await Linking.openURL(data.url);
        try {
          callbackUrl = await pendingWait;
        } catch {
          callbackUrl = null;
        }
      } else if (isMissingNativeModuleError(msg)) {
        return { ok: false, error: "google_not_configured", code: "google_not_configured" };
      } else if (isNetworkErrorMessage(msg)) {
        return { ok: false, error: "network", code: "network" };
      } else {
        return { ok: false, error: msg || "google_failed", code: "google_failed" };
      }
    }

    await dismissOAuthBrowser();

    if (!callbackUrl) {
      return { ok: false, error: "google_cancelled", code: "google_cancelled" };
    }

    const exchange = await exchangeOAuthCallbackOnce(callbackUrl);
    if (!exchange.ok && __DEV__) {
      console.error("[AskBibleAuth] exchange failed", exchange.error, callbackUrl);
    }
    return exchange;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isMissingNativeModuleError(msg)) {
      return { ok: false, error: "google_not_configured", code: "google_not_configured" };
    }
    if (isNetworkErrorMessage(msg)) {
      return { ok: false, error: "network", code: "network" };
    }
    return { ok: false, error: msg || "google_failed", code: "google_failed" };
  } finally {
    resumePoll?.remove();
    cancelGoogleOAuthCallbackWait();
  }
}

export { getSupabaseUrl };
