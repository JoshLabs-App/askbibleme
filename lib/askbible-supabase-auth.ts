import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "./supabase/admin";

export type AskbibleAuthUser = {
  id: string;
  email: string;
  name: string;
  locale: string | null;
  isAdmin: boolean;
  /** 账号注册时间（ISO） */
  createdAt: string | null;
};

type AskbibleProfileRow = {
  user_id: string;
  display_name: string | null;
  locale: string | null;
  is_admin: boolean | null;
  admin_role: string | null;
  online_seconds_total: number | null;
  color_theme_id: string | null;
};

function displayNameFromUser(user: User): string {
  const meta = user.user_metadata;
  const fromMeta =
    typeof meta?.name === "string"
      ? meta.name.trim()
      : typeof meta?.display_name === "string"
        ? meta.display_name.trim()
        : "";
  return fromMeta || user.email || user.id;
}

export function toAskbibleAuthUser(user: User, profile?: AskbibleProfileRow | null): AskbibleAuthUser {
  const name = profile?.display_name?.trim() || displayNameFromUser(user);
  const createdAt =
    typeof user.created_at === "string" && user.created_at.trim() ? user.created_at.trim() : null;
  return {
    id: user.id,
    email: user.email || "",
    name,
    locale: profile?.locale?.trim() || null,
    isAdmin: Boolean(profile?.is_admin),
    createdAt,
  };
}

export async function fetchAskbibleProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<AskbibleProfileRow | null> {
  const { data, error } = await supabase
    .from("askbible_profiles")
    .select("user_id, display_name, locale, is_admin, admin_role, online_seconds_total, color_theme_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as AskbibleProfileRow;
}

export async function upsertAskbibleProfile(input: {
  userId: string;
  displayName: string;
  locale?: string;
  isAdmin?: boolean;
  adminRole?: string;
  onlineSecondsTotal?: number;
  colorThemeId?: string;
}): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("Supabase admin not configured");

  const row: Record<string, unknown> = {
    user_id: input.userId,
    display_name: input.displayName,
    updated_at: new Date().toISOString(),
  };
  if (input.locale) row.locale = input.locale;
  if (typeof input.isAdmin === "boolean") row.is_admin = input.isAdmin;
  if (input.adminRole !== undefined) row.admin_role = input.adminRole;
  if (typeof input.onlineSecondsTotal === "number") row.online_seconds_total = input.onlineSecondsTotal;
  if (input.colorThemeId !== undefined) row.color_theme_id = input.colorThemeId;

  const { error } = await admin.from("askbible_profiles").upsert(row, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

/** 登录后合并 OAuth / 客户端 locale 与已有 askbible_profiles（保留已有 display_name）。 */
export async function ensureAskbibleMemberProfile(input: {
  supabase: SupabaseClient;
  user: User;
  locale?: string;
  displayName?: string;
}): Promise<AskbibleProfileRow | null> {
  const locale = input.locale?.trim().slice(0, 24) || "";
  const oauthName = input.displayName?.trim() || "";
  const metaName = displayNameFromUser(input.user);

  let profile = await fetchAskbibleProfile(input.supabase, input.user.id);
  if (!profile) {
    try {
      await upsertAskbibleProfile({
        userId: input.user.id,
        displayName: oauthName || metaName,
        locale: locale || "zh",
      });
    } catch {
      return null;
    }
    return fetchAskbibleProfile(input.supabase, input.user.id);
  }

  const resolvedName = profile.display_name?.trim() || oauthName || metaName;
  const shouldUpdateName = !profile.display_name?.trim() && Boolean(oauthName || metaName);
  const shouldUpdateLocale = Boolean(locale && locale !== (profile.locale ?? ""));

  if (!shouldUpdateName && !shouldUpdateLocale) {
    return profile;
  }

  try {
    await upsertAskbibleProfile({
      userId: input.user.id,
      displayName: resolvedName,
      ...(shouldUpdateLocale ? { locale } : {}),
    });
    profile = await fetchAskbibleProfile(input.supabase, input.user.id);
  } catch {
    // Keep existing profile row.
  }

  return profile;
}

export async function getAskbibleUserFromAccessToken(
  accessToken: string,
): Promise<AskbibleAuthUser | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data.user) return null;

  const profile = await fetchAskbibleProfile(admin, data.user.id);
  return toAskbibleAuthUser(data.user, profile);
}

export function isLikelySupabaseAccessToken(token: string): boolean {
  return token.startsWith("eyJ") && token.split(".").length === 3;
}

export async function deleteAskbibleSupabaseUser(userId: string): Promise<
  | { ok: true }
  | { ok: false; status: number; error: string; code: "not_found" | "admin_account" | "delete_failed" }
> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return { ok: false, status: 503, error: "Supabase admin not configured", code: "delete_failed" };
  }

  const profile = await fetchAskbibleProfile(admin, userId);
  if (profile?.is_admin) {
    return { ok: false, status: 403, error: "管理员账号无法在此注销。", code: "admin_account" };
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    const message = error.message || "删除失败";
    if (/not found/i.test(message)) {
      return { ok: false, status: 404, error: "账号不存在。", code: "not_found" };
    }
    return { ok: false, status: 500, error: message, code: "delete_failed" };
  }

  return { ok: true };
}

export function supabaseSessionFromAuth(
  session: { access_token: string; expires_at?: number | null } | null,
): { sessionToken: string; expiresAt: string } | null {
  if (!session?.access_token) return null;
  const expiresAt =
    typeof session.expires_at === "number"
      ? new Date(session.expires_at * 1000).toISOString()
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return { sessionToken: session.access_token, expiresAt };
}
