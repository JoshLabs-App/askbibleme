import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchAskbibleProfile,
  supabaseSessionFromAuth,
  toAskbibleAuthUser,
  upsertAskbibleProfile,
} from "@/lib/askbible-supabase-auth";

export type MobileOAuthProvider = "google" | "apple";

type SignInOk = {
  ok: true;
  user: { id: string; email: string; name: string };
  sessionToken: string;
  expiresAt: string;
};

type SignInFail = {
  ok: false;
  status: number;
  error: string;
  code: string;
};

function displayNameFromUserMeta(
  meta: Record<string, unknown> | undefined,
  fallbackEmail: string | null | undefined,
  fallbackId: string,
  preferredName?: string,
): string {
  if (preferredName?.trim()) return preferredName.trim();
  const fromMeta =
    typeof meta?.name === "string"
      ? meta.name.trim()
      : typeof meta?.full_name === "string"
        ? meta.full_name.trim()
        : "";
  return fromMeta || fallbackEmail || fallbackId;
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
    return {
      ok: false,
      status: 401,
      error: input.provider === "apple" ? "Apple 登录失败，请重试。" : "Google 登录失败，请重试。",
      code: input.provider === "apple" ? "apple_auth_failed" : "google_auth_failed",
    };
  }

  const profile = await fetchAskbibleProfile(supabase, data.user.id);
  if (!profile) {
    const meta = data.user.user_metadata as Record<string, unknown> | undefined;
    const name = displayNameFromUserMeta(meta, data.user.email, data.user.id, input.displayName);
    try {
      await upsertAskbibleProfile({
        userId: data.user.id,
        displayName: name,
        locale: input.locale,
      });
    } catch {
      // Session is still valid.
    }
  }

  const user = toAskbibleAuthUser(data.user, profile);
  const session = supabaseSessionFromAuth(data.session);
  if (!session) {
    return { ok: false, status: 500, error: "登录失败。", code: "auth_failed" };
  }

  return {
    ok: true,
    user: { id: user.id, email: user.email, name: user.name },
    sessionToken: session.sessionToken,
    expiresAt: session.expiresAt,
  };
}
