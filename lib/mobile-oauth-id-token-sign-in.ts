import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ensureAskbibleMemberProfile,
  supabaseSessionFromAuth,
  toAskbibleAuthUser,
} from "@/lib/askbible-supabase-auth";

export type MobileOAuthProvider = "google" | "apple";

type SignInOk = {
  ok: true;
  user: { id: string; email: string; name: string; locale: string | null };
  sessionToken: string;
  expiresAt: string;
};

type SignInFail = {
  ok: false;
  status: number;
  error: string;
  code: string;
};

function mapOAuthSignInError(provider: MobileOAuthProvider, message: string): { error: string; code: string } {
  const msg = message.trim();
  const lower = msg.toLowerCase();

  if (provider === "apple") {
    if (/audience|client_id|client id|bundle/i.test(lower)) {
      return {
        error: "Apple 登录配置有误（App Bundle ID 未在 Supabase 授权）。",
        code: "apple_not_configured",
      };
    }
    if (/nonce/i.test(lower)) {
      return { error: "Apple 登录验证失败，请重试。", code: "apple_auth_failed" };
    }
    if (/email.*already|already.*registered|user.*already/i.test(lower)) {
      return { error: "该 Apple 账号已绑定其它登录方式，请改用原方式登录。", code: "apple_auth_failed" };
    }
    if (msg) return { error: msg, code: "apple_auth_failed" };
    return { error: "Apple 登录失败，请重试。", code: "apple_auth_failed" };
  }

  if (/nonce/i.test(lower) && /(both exist|mismatch|id_token)/i.test(lower)) {
    return { error: "Google 登录验证失败，请重试。", code: "google_nonce_mismatch" };
  }
  if (/invalid.*token|audience/i.test(lower)) {
    return { error: "Google 登录验证失败，请重试。", code: "google_auth_failed" };
  }
  if (msg) return { error: msg, code: "google_auth_failed" };
  return { error: "Google 登录失败，请重试。", code: "google_auth_failed" };
}

export async function signInMobileMemberWithOAuthIdToken(
  supabase: SupabaseClient,
  input: {
    provider: MobileOAuthProvider;
    idToken: string;
    nonce?: string;
    locale: string;
    displayName?: string;
  },
): Promise<SignInOk | SignInFail> {
  const signInParams =
    input.provider === "apple" && input.nonce
      ? { provider: input.provider as "apple", token: input.idToken, nonce: input.nonce }
      : { provider: input.provider, token: input.idToken };

  const { data, error } = await supabase.auth.signInWithIdToken(signInParams);
  if (error || !data.user || !data.session) {
    const mapped = mapOAuthSignInError(input.provider, error?.message ?? "");
    return {
      ok: false,
      status: 401,
      error: mapped.error,
      code: mapped.code,
    };
  }

  const profile = await ensureAskbibleMemberProfile({
    supabase,
    user: data.user,
    locale: input.locale,
    displayName: input.displayName,
  });

  const user = toAskbibleAuthUser(data.user, profile);
  const session = supabaseSessionFromAuth(data.session);
  if (!session) {
    return { ok: false, status: 500, error: "登录失败。", code: "auth_failed" };
  }

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      locale: user.locale,
    },
    sessionToken: session.sessionToken,
    expiresAt: session.expiresAt,
  };
}
