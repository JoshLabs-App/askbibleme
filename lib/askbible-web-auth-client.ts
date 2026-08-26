"use client";

import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseAuthConfigured } from "@/lib/supabase/config";

export type AskbibleWebUser = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  /** 账号注册时间（ISO），用于探索页「一起走过」 */
  createdAt: string | null;
};

function displayNameFromUser(user: User, fallback?: string): string {
  const trimmed = fallback?.trim();
  if (trimmed) return trimmed;
  const meta = user.user_metadata;
  if (typeof meta?.full_name === "string" && meta.full_name.trim()) return meta.full_name.trim();
  if (typeof meta?.name === "string" && meta.name.trim()) return meta.name.trim();
  if (typeof meta?.display_name === "string" && meta.display_name.trim()) return meta.display_name.trim();
  return user.email || user.id;
}

async function loadProfile(
  supabase: NonNullable<ReturnType<typeof createSupabaseBrowserClient>>,
  userId: string,
): Promise<{ display_name: string | null; locale: string | null; is_admin: boolean | null } | null> {
  const { data } = await supabase
    .from("askbible_profiles")
    .select("display_name, locale, is_admin")
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

async function ensureOwnProfile(input: {
  supabase: NonNullable<ReturnType<typeof createSupabaseBrowserClient>>;
  user: User;
  displayName?: string;
  locale?: string;
}): Promise<void> {
  const existing = await loadProfile(input.supabase, input.user.id);
  const displayName = existing?.display_name?.trim() || displayNameFromUser(input.user, input.displayName);
  const locale = input.locale?.trim() || existing?.locale || "zh";
  if (existing?.display_name?.trim() && (!input.locale || input.locale === existing.locale)) return;
  await input.supabase.from("askbible_profiles").upsert(
    {
      user_id: input.user.id,
      display_name: displayName,
      locale,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

export async function fetchAskbibleWebSessionUser(): Promise<{
  configured: boolean;
  user: AskbibleWebUser | null;
}> {
  if (!isSupabaseAuthConfigured()) {
    return { configured: false, user: null };
  }
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return { configured: false, user: null };

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) {
    return { configured: true, user: null };
  }
  const profile = await loadProfile(supabase, data.user.id);
  const createdAt =
    typeof data.user.created_at === "string" && data.user.created_at.trim()
      ? data.user.created_at.trim()
      : null;
  return {
    configured: true,
    user: {
      id: data.user.id,
      email: data.user.email,
      name: profile?.display_name?.trim() || displayNameFromUser(data.user),
      isAdmin: Boolean(profile?.is_admin),
      createdAt,
    },
  };
}

export async function signInAskbibleWebWithPassword(input: {
  email: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return { ok: false, error: "auth_not_configured" };
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  });
  if (error || !data.user) {
    return { ok: false, error: error?.message || "invalid_credentials" };
  }
  await ensureOwnProfile({ supabase, user: data.user });
  return { ok: true };
}

export async function signUpAskbibleWebWithPassword(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return { ok: false, error: "auth_not_configured" };
  const displayName = input.name?.trim() || "";
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: displayName ? { name: displayName, display_name: displayName } : undefined,
    },
  });
  if (error) return { ok: false, error: error.message };
  if (data.session?.user) {
    await ensureOwnProfile({
      supabase,
      user: data.session.user,
      displayName,
    });
    return { ok: true };
  }
  if (data.user) {
    return { ok: false, error: "email_confirmation_required" };
  }
  return { ok: false, error: "register_failed" };
}

export async function signOutAskbibleWeb(): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function deleteAskbibleWebAccount(): Promise<
  { ok: true } | { ok: false; error: string; code?: string }
> {
  if (!isSupabaseAuthConfigured()) {
    return { ok: false, error: "auth_not_configured", code: "supabase_not_configured" };
  }
  const supabase = createSupabaseBrowserClient();
  if (!supabase) {
    return { ok: false, error: "auth_not_configured", code: "supabase_not_configured" };
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return { ok: false, error: "unauthorized", code: "unauthorized" };
  }

  const url = `${getSupabaseUrl().replace(/\/$/, "")}/functions/v1/delete-account`;
  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: getSupabaseAnonKey(),
      },
    });
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      code?: string;
    } | null;
    if (!res.ok || data?.ok !== true) {
      return {
        ok: false,
        error: typeof data?.error === "string" ? data.error : `HTTP ${res.status}`,
        code: typeof data?.code === "string" ? data.code : undefined,
      };
    }
    await supabase.auth.signOut();
    return { ok: true };
  } catch {
    return { ok: false, error: "network", code: "network" };
  }
}
