import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseAuthConfigured } from "../config/supabaseAuth";
import { SCHEMA_VERSION } from "../api/memberAuthShared";
import type { MobileAuthUser, MobileLoginResult, MobileRegisterResult } from "../api/memberAuthTypes";
import { createMobileSupabaseClient } from "./googleOAuthSession";

type ProfileRow = {
  display_name: string | null;
  locale: string | null;
};

export function isLikelySupabaseAccessToken(token: string): boolean {
  return token.startsWith("eyJ") && token.split(".").length === 3;
}

function displayNameFromUser(user: User, fallbackName?: string): string {
  const trimmed = fallbackName?.trim();
  if (trimmed) return trimmed;
  const meta = user.user_metadata;
  if (typeof meta?.full_name === "string" && meta.full_name.trim()) return meta.full_name.trim();
  if (typeof meta?.name === "string" && meta.name.trim()) return meta.name.trim();
  if (typeof meta?.display_name === "string" && meta.display_name.trim()) return meta.display_name.trim();
  return user.email || user.id;
}

function authUserFromSession(session: Session, profile?: ProfileRow | null, fallbackName?: string): MobileAuthUser {
  return {
    id: session.user.id,
    email: session.user.email || "",
    name: profile?.display_name?.trim() || displayNameFromUser(session.user, fallbackName),
    locale: profile?.locale?.trim() || null,
    createdAt:
      typeof session.user.created_at === "string" && session.user.created_at.trim()
        ? session.user.created_at.trim()
        : null,
  };
}

function sessionPayload(session: Session): { sessionToken: string; expiresAt: string } {
  const expiresAtMs = session.expires_at ? session.expires_at * 1000 : Date.now() + 3600_000;
  return {
    sessionToken: session.access_token,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

function mapAuthErrorMessage(message: string): { error: string; code: string } {
  const msg = message.trim() || "auth_failed";
  if (/invalid login credentials|invalid_credentials/i.test(msg)) {
    return { error: "邮箱或密码不正确。", code: "invalid_credentials" };
  }
  if (/email not confirmed/i.test(msg)) {
    return { error: "请先完成邮箱验证后再登录。", code: "email_not_confirmed" };
  }
  if (/user already registered|already been registered/i.test(msg)) {
    return { error: "该邮箱已注册。", code: "email_taken" };
  }
  if (/network request failed|failed to fetch|network error|timed out|failed to connect/i.test(msg)) {
    return { error: "network", code: "network" };
  }
  return { error: msg, code: "auth_failed" };
}

/** 用 access token 建一次性客户端，便于 getUser / 读 askbible_profiles（不经 askbible.me）。 */
export function createAuthedMobileSupabaseClient(accessToken: string) {
  if (!isSupabaseAuthConfigured() || !accessToken.trim()) return null;
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    global: { headers: { Authorization: `Bearer ${accessToken.trim()}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function fetchOwnProfile(
  accessToken: string,
  userId: string,
): Promise<ProfileRow | null> {
  const supabase = createAuthedMobileSupabaseClient(accessToken);
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("askbible_profiles")
    .select("display_name, locale")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as ProfileRow;
}

async function ensureOwnProfile(input: {
  accessToken: string;
  user: User;
  displayName?: string;
  locale?: string;
}): Promise<ProfileRow | null> {
  const existing = await fetchOwnProfile(input.accessToken, input.user.id);
  const locale = input.locale?.trim().slice(0, 24) || "";
  const displayName = displayNameFromUser(input.user, input.displayName);
  if (existing?.display_name?.trim() && (!locale || locale === (existing.locale ?? ""))) {
    return existing;
  }

  const supabase = createAuthedMobileSupabaseClient(input.accessToken);
  if (!supabase) return existing;
  const row: Record<string, unknown> = {
    user_id: input.user.id,
    display_name: existing?.display_name?.trim() || displayName,
    updated_at: new Date().toISOString(),
  };
  if (locale) row.locale = locale;
  const { error } = await supabase.from("askbible_profiles").upsert(row, { onConflict: "user_id" });
  if (error) {
    if (__DEV__) {
      console.warn("[supabaseMemberAuth] profile upsert", error.message);
    }
    return existing;
  }
  return (await fetchOwnProfile(input.accessToken, input.user.id)) ?? existing;
}

export async function signInWithPasswordInApp(input: {
  email: string;
  password: string;
  locale?: string;
}): Promise<MobileLoginResult> {
  const supabase = createMobileSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      schemaVersion: SCHEMA_VERSION,
      error: "Supabase 未配置",
      code: "supabase_not_configured",
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email.trim(),
      password: input.password,
    });
    if (error || !data.session?.user) {
      const mapped = mapAuthErrorMessage(error?.message ?? "login_failed");
      return { ok: false, schemaVersion: SCHEMA_VERSION, ...mapped };
    }

    const tokens = sessionPayload(data.session);
    const profile = await ensureOwnProfile({
      accessToken: tokens.sessionToken,
      user: data.session.user,
      locale: input.locale,
    });
    return {
      ok: true,
      schemaVersion: SCHEMA_VERSION,
      user: authUserFromSession(data.session, profile),
      sessionToken: tokens.sessionToken,
      expiresAt: tokens.expiresAt,
    };
  } catch (err) {
    const mapped = mapAuthErrorMessage(err instanceof Error ? err.message : String(err));
    return { ok: false, schemaVersion: SCHEMA_VERSION, ...mapped };
  }
}

export async function signUpWithPasswordInApp(input: {
  email: string;
  password: string;
  name?: string;
  locale?: string;
}): Promise<MobileRegisterResult> {
  const supabase = createMobileSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      schemaVersion: SCHEMA_VERSION,
      error: "Supabase 未配置",
      code: "supabase_not_configured",
    };
  }

  const displayName = input.name?.trim() || "";
  const locale = input.locale?.trim() || "";

  try {
    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        data: {
          ...(displayName ? { name: displayName, display_name: displayName } : null),
          ...(locale ? { locale } : null),
        },
      },
    });
    if (error) {
      const mapped = mapAuthErrorMessage(error.message);
      return { ok: false, schemaVersion: SCHEMA_VERSION, ...mapped };
    }

    if (data.session?.user && data.session.access_token) {
      const tokens = sessionPayload(data.session);
      const profile = await ensureOwnProfile({
        accessToken: tokens.sessionToken,
        user: data.session.user,
        displayName,
        locale,
      });
      return {
        ok: true,
        schemaVersion: SCHEMA_VERSION,
        user: authUserFromSession(data.session, profile, displayName),
        sessionToken: tokens.sessionToken,
        expiresAt: tokens.expiresAt,
        nextAction: "login",
      };
    }

    if (data.user) {
      return {
        ok: false,
        schemaVersion: SCHEMA_VERSION,
        error: "请查收验证邮件后再登录。",
        code: "email_confirmation_required",
      };
    }

    return {
      ok: false,
      schemaVersion: SCHEMA_VERSION,
      error: "注册失败",
      code: "register_failed",
    };
  } catch (err) {
    const mapped = mapAuthErrorMessage(err instanceof Error ? err.message : String(err));
    return { ok: false, schemaVersion: SCHEMA_VERSION, ...mapped };
  }
}

export async function pullMemberProfileFromSupabase(sessionToken: string): Promise<MobileAuthUser | null> {
  if (!isSupabaseAuthConfigured() || !isLikelySupabaseAccessToken(sessionToken)) return null;
  const supabase = createAuthedMobileSupabaseClient(sessionToken);
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.auth.getUser(sessionToken);
    if (error || !data.user?.email) return null;
    const profile = await fetchOwnProfile(sessionToken, data.user.id);
    return {
      id: data.user.id,
      email: data.user.email,
      name: profile?.display_name?.trim() || displayNameFromUser(data.user),
      locale: profile?.locale?.trim() || null,
      createdAt:
        typeof data.user.created_at === "string" && data.user.created_at.trim()
          ? data.user.created_at.trim()
          : null,
    };
  } catch (err) {
    if (__DEV__) {
      console.warn("[supabaseMemberAuth] pull profile", err);
    }
    return null;
  }
}
