import { getLocale } from "../i18n/locale-store";
import {
  loginMobileMemberWithApple,
  loginMobileMemberWithAppleAt,
  MOBILE_AUTH_PRODUCTION_BASE_URL,
} from "../api/memberAuth";
import { createMobileSupabaseClient } from "./googleOAuthSession";

export type AppleSignInExchangeResult =
  | {
      ok: true;
      sessionToken: string;
      expiresAt: string;
      user: { id: string; email: string; name: string };
    }
  | { ok: false; error: string; code?: string };

function authTrace(step: string, detail?: string): void {
  if (!__DEV__) return;
  console.log(`[AskBibleAuth] apple ${step}${detail ? `: ${detail}` : ""}`);
}

function isNetworkErrorMessage(msg: string): boolean {
  return /network request failed|failed to fetch|network error|timed out|internet connection|offline|failed to connect|aborted/i.test(
    msg,
  );
}

function displayNameFromUserMetadata(meta: Record<string, unknown> | undefined, fallback: string): string {
  if (typeof meta?.full_name === "string" && meta.full_name.trim()) return meta.full_name.trim();
  if (typeof meta?.name === "string" && meta.name.trim()) return meta.name.trim();
  return fallback;
}

function mapApiLoginResult(
  api: Awaited<ReturnType<typeof loginMobileMemberWithAppleAt>>,
): AppleSignInExchangeResult {
  if (api.ok) {
    return {
      ok: true,
      sessionToken: api.sessionToken,
      expiresAt: api.expiresAt,
      user: api.user,
    };
  }
  return { ok: false, error: api.error, code: api.code };
}

/** 原生 Apple idToken → 会话：优先 Supabase（与 Google 一致，不依赖 Mac 本地 API）。 */
export async function exchangeAppleNativeCredential(input: {
  idToken: string;
  nonce: string;
  displayName?: string;
}): Promise<AppleSignInExchangeResult> {
  const locale = getLocale();
  const supabase = createMobileSupabaseClient();

  if (supabase) {
    authTrace("path", "Supabase signInWithIdToken");
    try {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: input.idToken,
        nonce: input.nonce,
      });
      if (!error && data.session?.user) {
        const expiresAtMs = data.session.expires_at ? data.session.expires_at * 1000 : Date.now() + 3600_000;
        const email = data.session.user.email || "";
        authTrace("supabase ok", email || data.session.user.id);
        return {
          ok: true,
          sessionToken: data.session.access_token,
          expiresAt: new Date(expiresAtMs).toISOString(),
          user: {
            id: data.session.user.id,
            email,
            name:
              input.displayName?.trim() ||
              displayNameFromUserMetadata(data.session.user.user_metadata as Record<string, unknown>, email || data.session.user.id),
          },
        };
      }
      const msg = error?.message?.trim() || "apple_auth_failed";
      authTrace("supabase failed", msg);
      if (!isNetworkErrorMessage(msg)) {
        return {
          ok: false,
          error: msg,
          code: /not configured|client_id|client id|bundle|audience/i.test(msg) ? "apple_not_configured" : "apple_auth_failed",
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      authTrace("supabase threw", msg);
      if (!isNetworkErrorMessage(msg)) {
        return { ok: false, error: msg || "apple_failed", code: "apple_failed" };
      }
    }
  } else {
    authTrace("blocked", "Supabase env missing");
  }

  authTrace("fallback", "local API");
  try {
    const local = await loginMobileMemberWithApple({
      idToken: input.idToken,
      nonce: input.nonce,
      locale,
      displayName: input.displayName,
    });
    if (local.ok || local.code !== "network") {
      return mapApiLoginResult(local);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!isNetworkErrorMessage(msg)) {
      return { ok: false, error: msg || "apple_failed", code: "apple_failed" };
    }
  }

  authTrace("fallback", "production API");
  try {
    return mapApiLoginResult(
      await loginMobileMemberWithAppleAt(MOBILE_AUTH_PRODUCTION_BASE_URL, {
        idToken: input.idToken,
        nonce: input.nonce,
        locale,
        displayName: input.displayName,
      }),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: isNetworkErrorMessage(msg) ? "network" : msg || "network", code: "network" };
  }
}
