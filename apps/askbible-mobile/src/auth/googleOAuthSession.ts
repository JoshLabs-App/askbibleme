import "./webCryptoPolyfill";
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseAuthConfigured } from "../config/supabaseAuth";

let client: SupabaseClient | null = null;
let lastExchangedCode: string | null = null;

export type GoogleOAuthSessionResult =
  | {
      ok: true;
      sessionToken: string;
      expiresAt: string;
      user: { id: string; email: string; name: string };
    }
  | { ok: false; error: string; code?: string };

function parseQueryParams(url: string): { params: Record<string, string>; errorCode: string | null } {
  const queryIndex = url.indexOf("?");
  const hashIndex = url.indexOf("#");
  const params: Record<string, string> = {};

  const readSegment = (segment: string) => {
    for (const part of segment.split("&")) {
      if (!part) continue;
      const [rawKey, ...rest] = part.split("=");
      const key = decodeURIComponent(rawKey || "");
      const value = decodeURIComponent(rest.join("=") || "");
      if (key) params[key] = value;
    }
  };

  if (queryIndex >= 0) {
    const end = hashIndex >= 0 ? hashIndex : url.length;
    readSegment(url.slice(queryIndex + 1, end));
  }
  if (hashIndex >= 0) {
    readSegment(url.slice(hashIndex + 1));
  }

  return { params, errorCode: params.error_code || params.error || null };
}

export function createMobileSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseAuthConfigured()) return null;
  if (!client) {
    client = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      auth: {
        flowType: "pkce",
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        // PKCE code_verifier must survive App 切到浏览器再深链回来
        storage: AsyncStorage,
      },
    });
  }
  return client;
}

function displayNameFromSession(session: Session): string {
  const meta = session.user.user_metadata;
  if (typeof meta?.full_name === "string" && meta.full_name.trim()) return meta.full_name.trim();
  if (typeof meta?.name === "string" && meta.name.trim()) return meta.name.trim();
  return session.user.email || session.user.id;
}

export function isGoogleOAuthCallbackUrl(url: string): boolean {
  if (url.startsWith("askbible://auth/callback")) return true;
  try {
    const u = new URL(url);
    return u.pathname === "/auth/callback" || u.pathname === "/auth/mobile-callback";
  } catch {
    return false;
  }
}

export async function completeGoogleOAuthFromCallbackUrl(url: string): Promise<GoogleOAuthSessionResult> {
  const supabase = createMobileSupabaseClient();
  if (!supabase) return { ok: false, error: "google_not_configured", code: "google_not_configured" };

  const { params, errorCode } = parseQueryParams(url);
  if (errorCode) {
    return { ok: false, error: errorCode, code: errorCode };
  }

  const code = params.code?.trim();
  if (code) {
    if (code === lastExchangedCode) {
      return { ok: false, error: "code_already_used", code: "google_failed" };
    }
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.session) {
      if (__DEV__) {
        console.warn("[googleOAuthSession] exchangeCodeForSession", error?.message ?? "no session");
      }
      return { ok: false, error: error?.message ?? "exchange_failed", code: "google_failed" };
    }
    lastExchangedCode = code;
    const expiresAtMs = data.session.expires_at ? data.session.expires_at * 1000 : Date.now() + 3600_000;
    return {
      ok: true,
      sessionToken: data.session.access_token,
      expiresAt: new Date(expiresAtMs).toISOString(),
      user: {
        id: data.session.user.id,
        email: data.session.user.email || "",
        name: displayNameFromSession(data.session),
      },
    };
  }

  const accessToken = params.access_token?.trim();
  const refreshToken = params.refresh_token?.trim();
  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error || !data.session) {
      return { ok: false, error: error?.message ?? "set_session_failed", code: "google_failed" };
    }
    const expiresAtMs = data.session.expires_at ? data.session.expires_at * 1000 : Date.now() + 3600_000;
    return {
      ok: true,
      sessionToken: data.session.access_token,
      expiresAt: new Date(expiresAtMs).toISOString(),
      user: {
        id: data.session.user.id,
        email: data.session.user.email || "",
        name: displayNameFromSession(data.session),
      },
    };
  }

  return { ok: false, error: "missing_code", code: "google_failed" };
}

function isGoogleNonceMismatchMessage(msg: string): boolean {
  return /nonce/i.test(msg) && /(both exist|mismatch|id_token)/i.test(msg);
}

export async function signInWithGoogleIdTokenInApp(
  idToken: string,
  nonce?: string,
): Promise<GoogleOAuthSessionResult> {
  const supabase = createMobileSupabaseClient();
  if (!supabase) return { ok: false, error: "google_not_configured", code: "google_not_configured" };

  try {
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
      ...(nonce ? { nonce } : null),
    });
    if (error || !data.session?.user) {
      const message = error?.message ?? "google_auth_failed";
      if (__DEV__) {
        console.warn("[googleOAuthSession] signInWithIdToken", message);
      }
      if (isGoogleNonceMismatchMessage(message)) {
        return { ok: false, error: message, code: "google_nonce_mismatch" };
      }
      return { ok: false, error: message, code: "google_auth_failed" };
    }

    const expiresAtMs = data.session.expires_at ? data.session.expires_at * 1000 : Date.now() + 3600_000;
    return {
      ok: true,
      sessionToken: data.session.access_token,
      expiresAt: new Date(expiresAtMs).toISOString(),
      user: {
        id: data.session.user.id,
        email: data.session.user.email || "",
        name: displayNameFromSession(data.session),
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (__DEV__) {
      console.warn("[googleOAuthSession] signInWithIdToken threw", msg);
    }
    if (/network request failed|failed to fetch|network error|timed out|failed to connect/i.test(msg)) {
      return { ok: false, error: "network", code: "network" };
    }
    return { ok: false, error: msg || "google_auth_failed", code: "google_auth_failed" };
  }
}
