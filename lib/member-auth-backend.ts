import { getAskbibleAuthSqlitePath } from "@/lib/admin-askbible-path";
import { verifyAskbibleUserCredentials } from "@/lib/admin-askbible-login";
import { issueMobileUserSessionToken } from "@/lib/mobile-auth-session";
import {
  ensureAskbibleMemberProfile,
  fetchAskbibleProfile,
  supabaseSessionFromAuth,
  toAskbibleAuthUser,
} from "@/lib/askbible-supabase-auth";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { createSupabaseMobileAuthClient } from "@/lib/supabase/mobile-server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MemberAuthUser = { id: string; email: string; name: string; locale?: string | null };

export type MemberPasswordSignInResult =
  | {
      ok: true;
      backend: "supabase";
      user: MemberAuthUser;
      sessionToken: string;
      expiresAt: string;
    }
  | {
      ok: true;
      backend: "sqlite";
      user: MemberAuthUser;
      sessionToken: string;
      expiresAt: string;
    }
  | { ok: false; error: string; code: string; status: number };

/** 会员认证后端是否可用（Supabase 或本地 auth.sqlite 任一即可）。 */
export function isMemberAuthBackendConfigured(): boolean {
  return isSupabaseAuthConfigured() || Boolean(getAskbibleAuthSqlitePath());
}

export function isMemberRegisterSurfaceOpen(flags: { memberRegisterEnabled: boolean }): boolean {
  return flags.memberRegisterEnabled && isMemberAuthBackendConfigured();
}

/** Supabase 注册失败时是否可回退到本地 auth.sqlite（如限流、严格邮箱校验）。 */
export function shouldFallbackMemberRegisterToSqlite(message: string): boolean {
  return /rate limit|service unavailable|temporarily unavailable|invalid email/i.test(message);
}

function isInvalidCredentialsMessage(message: string): boolean {
  return /invalid login credentials|invalid email or password|邮箱或密码错误/i.test(message);
}

async function signInWithSupabaseMobile(
  supabase: SupabaseClient,
  email: string,
  password: string,
  locale?: string,
): Promise<MemberPasswordSignInResult | null> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user || !data.session) {
    if (error && isInvalidCredentialsMessage(error.message || "")) return null;
    if (error) {
      return {
        ok: false,
        error: error.message || "登录失败。",
        code: "auth_failed",
        status: 400,
      };
    }
    return null;
  }

  const profile = await ensureAskbibleMemberProfile({
    supabase,
    user: data.user,
    locale,
  });
  const user = toAskbibleAuthUser(data.user, profile);
  const session = supabaseSessionFromAuth(data.session);
  if (!session) {
    return { ok: false, error: "登录失败。", code: "auth_failed", status: 500 };
  }

  return {
    ok: true,
    backend: "supabase",
    user: { id: user.id, email: user.email, name: user.name, locale: user.locale },
    sessionToken: session.sessionToken,
    expiresAt: session.expiresAt,
  };
}

async function signInWithSqlite(email: string, password: string): Promise<MemberPasswordSignInResult | null> {
  const dbPath = getAskbibleAuthSqlitePath();
  if (!dbPath) return null;

  const auth = await verifyAskbibleUserCredentials(dbPath, email, password);
  if (!auth.ok) return null;

  const user = { id: auth.userId, email: auth.email, name: auth.name };
  const session = await issueMobileUserSessionToken(user);
  return {
    ok: true,
    backend: "sqlite",
    user,
    sessionToken: session.sessionToken,
    expiresAt: session.expiresAt,
  };
}

/** 移动端 / API：Supabase 优先，凭证错误时回退 sqlite。 */
export async function signInMemberWithPasswordMobile(
  email: string,
  password: string,
  locale?: string,
): Promise<MemberPasswordSignInResult> {
  if (isSupabaseAuthConfigured()) {
    const supabase = createSupabaseMobileAuthClient();
    if (supabase) {
      const supabaseResult = await signInWithSupabaseMobile(supabase, email, password, locale);
      if (supabaseResult?.ok) return supabaseResult;
      if (supabaseResult && !supabaseResult.ok) return supabaseResult;
    }
  }

  const sqliteResult = await signInWithSqlite(email, password);
  if (sqliteResult?.ok) return sqliteResult;

  if (!isMemberAuthBackendConfigured()) {
    return {
      ok: false,
      error: "登录服务尚未配置，请稍后再试。",
      code: "auth_not_configured",
      status: 503,
    };
  }

  return {
    ok: false,
    error: "邮箱或密码错误。",
    code: "invalid_credentials",
    status: 401,
  };
}

export type MemberSupabaseServerSignInResult =
  | { ok: true; user: MemberAuthUser }
  | { ok: false; error: string; status: number };

/** Web：Supabase SSR 登录；凭证错误时回退 sqlite（由调用方写 cookie）。 */
export async function signInMemberWithPasswordServer(
  supabase: SupabaseClient | null,
  email: string,
  password: string,
): Promise<
  | { ok: true; backend: "supabase"; user: MemberAuthUser }
  | { ok: true; backend: "sqlite"; user: MemberAuthUser }
  | { ok: false; error: string; status: number }
> {
  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.user) {
      const profile = await fetchAskbibleProfile(supabase, data.user.id);
      const user = toAskbibleAuthUser(data.user, profile);
      return {
        ok: true,
        backend: "supabase",
        user: { id: user.id, email: user.email, name: user.name },
      };
    }
    if (error && !isInvalidCredentialsMessage(error.message || "")) {
      return { ok: false, error: error.message || "登录失败。", status: 400 };
    }
  }

  const sqliteResult = await signInWithSqlite(email, password);
  if (sqliteResult?.ok) {
    return { ok: true, backend: "sqlite", user: sqliteResult.user };
  }

  if (!isMemberAuthBackendConfigured()) {
    return { ok: false, error: "AskBible auth not configured", status: 503 };
  }

  return { ok: false, error: "邮箱或密码错误", status: 401 };
}
