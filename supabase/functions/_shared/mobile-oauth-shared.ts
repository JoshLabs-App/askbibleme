import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const SCHEMA_VERSION = 1;
const WINDOW_MS = 60_000;
const MAX_HITS_PER_IP = 20;
const ipBuckets = new Map<string, { count: number; startAt: number }>();

export function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function errorResponse(status: number, error: string, code: string): Response {
  return jsonResponse({ ok: false, schemaVersion: SCHEMA_VERSION, error, code }, status);
}

export function trimString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function readClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")?.trim();
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * 与原 Render 路由的速率限制行为一致：单实例内存计数。Edge Function 可能有多个
 * 冷启动实例，限流效果会比单实例 Render 弱（各实例各算各的），可接受——目的是
 * 挡掉单一来源的暴力请求，不是精确配额。
 */
export function passRateLimit(ip: string): boolean {
  const now = Date.now();
  for (const [key, value] of ipBuckets) {
    if (now - value.startAt > WINDOW_MS * 2) ipBuckets.delete(key);
  }
  const current = ipBuckets.get(ip);
  if (!current || now - current.startAt >= WINDOW_MS) {
    ipBuckets.set(ip, { count: 1, startAt: now });
    return true;
  }
  if (current.count >= MAX_HITS_PER_IP) return false;
  current.count += 1;
  return true;
}

/**
 * 会员注册开关：原实现读取 Render 磁盘上的 data/admin/mobile-content-flags.json，
 * Edge Function 无法访问该磁盘，改读 Supabase secret MEMBER_REGISTER_ENABLED。
 * 若管理员今后只改 JSON 文件而不同步这个 secret，二者会不一致——已知限制。
 */
export function isMemberRegisterEnabled(): boolean {
  const raw = Deno.env.get("MEMBER_REGISTER_ENABLED")?.trim().toLowerCase();
  if (!raw) return true;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function createAdminClient(): SupabaseClient | null {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceRole) return null;
  return createClient(url, serviceRole);
}

export function createAuthClient(): SupabaseClient | null {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!url || !anonKey) return null;
  return createClient(url, anonKey);
}

export type MobileOAuthProvider = "google" | "apple";

export function mapOAuthSignInError(
  provider: MobileOAuthProvider,
  message: string,
): { error: string; code: string } {
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

type AskbibleProfileRow = {
  user_id: string;
  display_name: string | null;
  locale: string | null;
  is_admin: boolean | null;
};

function displayNameFromUser(user: User): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const fromMeta =
    typeof meta?.name === "string"
      ? meta.name.trim()
      : typeof meta?.display_name === "string"
        ? meta.display_name.trim()
        : "";
  return fromMeta || user.email || user.id;
}

async function fetchAskbibleProfile(
  admin: SupabaseClient,
  userId: string,
): Promise<AskbibleProfileRow | null> {
  const { data, error } = await admin
    .from("askbible_profiles")
    .select("user_id, display_name, locale, is_admin")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as AskbibleProfileRow;
}

async function upsertAskbibleProfile(
  admin: SupabaseClient,
  input: { userId: string; displayName: string; locale?: string },
): Promise<void> {
  const row: Record<string, unknown> = {
    user_id: input.userId,
    display_name: input.displayName,
    updated_at: new Date().toISOString(),
  };
  if (input.locale) row.locale = input.locale;
  const { error } = await admin.from("askbible_profiles").upsert(row, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

/** 与 lib/askbible-supabase-auth.ts 的 ensureAskbibleMemberProfile 保持一致。 */
export async function ensureAskbibleMemberProfile(input: {
  admin: SupabaseClient;
  user: User;
  locale?: string;
  displayName?: string;
}): Promise<AskbibleProfileRow | null> {
  const locale = input.locale?.trim().slice(0, 24) || "";
  const oauthName = input.displayName?.trim() || "";
  const metaName = displayNameFromUser(input.user);

  let profile = await fetchAskbibleProfile(input.admin, input.user.id);
  if (!profile) {
    try {
      await upsertAskbibleProfile(input.admin, {
        userId: input.user.id,
        displayName: oauthName || metaName,
        locale: locale || "zh",
      });
    } catch {
      return null;
    }
    return fetchAskbibleProfile(input.admin, input.user.id);
  }

  const resolvedName = profile.display_name?.trim() || oauthName || metaName;
  const shouldUpdateName = !profile.display_name?.trim() && Boolean(oauthName || metaName);
  const shouldUpdateLocale = Boolean(locale && locale !== (profile.locale ?? ""));

  if (!shouldUpdateName && !shouldUpdateLocale) {
    return profile;
  }

  try {
    await upsertAskbibleProfile(input.admin, {
      userId: input.user.id,
      displayName: resolvedName,
      ...(shouldUpdateLocale ? { locale } : {}),
    });
    profile = await fetchAskbibleProfile(input.admin, input.user.id);
  } catch {
    // Keep existing profile row.
  }

  return profile;
}

export function toAskbibleAuthUser(user: User, profile?: AskbibleProfileRow | null) {
  const name = profile?.display_name?.trim() || displayNameFromUser(user);
  const createdAt =
    typeof user.created_at === "string" && user.created_at.trim() ? user.created_at.trim() : null;
  return {
    id: user.id,
    email: user.email || "",
    name,
    locale: profile?.locale?.trim() || null,
    createdAt,
  };
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

export async function signInMobileMemberWithOAuthIdToken(
  admin: SupabaseClient,
  authClient: SupabaseClient,
  input: {
    provider: MobileOAuthProvider;
    idToken: string;
    nonce?: string;
    locale: string;
    displayName?: string;
  },
): Promise<
  | {
      ok: true;
      user: { id: string; email: string; name: string; locale: string | null };
      sessionToken: string;
      expiresAt: string;
    }
  | { ok: false; status: number; error: string; code: string }
> {
  const signInParams =
    input.provider === "apple" && input.nonce
      ? { provider: input.provider as "apple", token: input.idToken, nonce: input.nonce }
      : { provider: input.provider, token: input.idToken };

  const { data, error } = await authClient.auth.signInWithIdToken(signInParams);
  if (error || !data.user || !data.session) {
    const mapped = mapOAuthSignInError(input.provider, error?.message ?? "");
    return { ok: false, status: 401, error: mapped.error, code: mapped.code };
  }

  const profile = await ensureAskbibleMemberProfile({
    admin,
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
    user: { id: user.id, email: user.email, name: user.name, locale: user.locale },
    sessionToken: session.sessionToken,
    expiresAt: session.expiresAt,
  };
}
