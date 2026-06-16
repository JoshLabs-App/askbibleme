import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAskbibleAuthSqlitePath } from "@/lib/admin-askbible-path";
import { verifyAskbibleUserCredentials } from "@/lib/admin-askbible-login";
import { authCookieSecure } from "@/lib/auth-cookie-secure";
import {
  ASKBIBLE_USER_SESSION_COOKIE,
  parseAskbibleUserSessionCookie,
  signAskbibleUserSessionCookie,
} from "@/lib/askbible-user-session";
import { readMobileContentFlagsSync } from "@/lib/admin/mobile-content-flags-store";
import { getAskbibleUserById, registerAskbibleSqliteUser } from "@/lib/askbible-user-sqlite";
import { signInMemberWithPasswordServer, shouldFallbackMemberRegisterToSqlite } from "@/lib/member-auth-backend";
import { jsonResponseWithCookies } from "@/lib/next-response-cookies";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchAskbibleProfile,
  toAskbibleAuthUser,
  upsertAskbibleProfile,
} from "@/lib/askbible-supabase-auth";

export const runtime = "nodejs";

function missingSqliteResponse() {
  return NextResponse.json(
    { error: "AskBible sqlite auth not configured (ASKBIBLE_AUTH_SQLITE_PATH or DATA_ROOT/admin_data/auth.sqlite)" },
    { status: 503 },
  );
}

function readString(o: Record<string, unknown>, key: string): string {
  const v = o[key];
  return typeof v === "string" ? v.trim() : "";
}

export async function GET() {
  if (isSupabaseAuthConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return NextResponse.json({ configured: false, user: null });

    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) {
      const profile = await fetchAskbibleProfile(supabase, data.user.id);
      const user = toAskbibleAuthUser(data.user, profile);
      return NextResponse.json({
        configured: true,
        user: { id: user.id, email: user.email, name: user.name },
        isAdmin: user.isAdmin,
      });
    }
  }

  const dbPath = getAskbibleAuthSqlitePath();
  if (!dbPath) {
    return NextResponse.json({
      configured: isSupabaseAuthConfigured(),
      user: null,
    });
  }

  const store = await cookies();
  const sessionCookie = store.get(ASKBIBLE_USER_SESSION_COOKIE)?.value;

  const session = await parseAskbibleUserSessionCookie(sessionCookie);
  if (!session) {
    return NextResponse.json({
      configured: true,
      user: null,
    });
  }

  const user = await getAskbibleUserById(dbPath, session.sub);
  if (!user) {
    return NextResponse.json({ configured: true, user: null });
  }
  return NextResponse.json({ configured: true, user });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const action = readString(o, "action") || "login";
  const email = readString(o, "email");
  const password = typeof o.password === "string" ? o.password : "";
  const name = readString(o, "name");
  const locale = readString(o, "locale") || "zh";

  if (!email || !password) {
    return NextResponse.json({ error: "缺少邮箱或密码" }, { status: 400 });
  }

  if (isSupabaseAuthConfigured()) {
    const cookieRes = NextResponse.json({ ok: false });
    const supabase = await createSupabaseServerClient(cookieRes);
    if (!supabase) {
      return NextResponse.json({ error: "Supabase auth not configured" }, { status: 503 });
    }

    let useSqliteRegister = false;

    if (action === "register") {
      const flags = readMobileContentFlagsSync(process.cwd()).flags;
      if (!flags.memberRegisterEnabled) {
        return NextResponse.json({ error: "会员注册尚未开放。" }, { status: 503 });
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: name || email },
        },
      });

      if (signUpError) {
        const msg = signUpError.message || "注册失败";
        if (shouldFallbackMemberRegisterToSqlite(msg) && getAskbibleAuthSqlitePath()) {
          useSqliteRegister = true;
        } else {
          const status = /already registered|already exists/i.test(msg) ? 409 : 400;
          return NextResponse.json({ error: msg }, { status });
        }
      } else {
        const user = signUpData.user;
        if (user) {
          await upsertAskbibleProfile({
            userId: user.id,
            displayName: name || email,
            locale,
          });
        }

        if (signUpData.session?.user) {
          const profile = await fetchAskbibleProfile(supabase, signUpData.session.user.id);
          const signedInUser = toAskbibleAuthUser(signUpData.session.user, profile);
          return jsonResponseWithCookies(
            {
              ok: true,
              user: { id: signedInUser.id, email: signedInUser.email, name: signedInUser.name },
            },
            cookieRes,
          );
        }

        if (signUpData.user) {
          const auth = await signInMemberWithPasswordServer(supabase, email, password);
          if (!auth.ok && auth.status === 401) {
            return NextResponse.json(
              { error: "注册成功，请查收确认邮件后再登录。" },
              { status: 403 },
            );
          }
          if (auth.ok && auth.backend === "supabase") {
            return jsonResponseWithCookies({ ok: true, user: auth.user }, cookieRes);
          }
          if (auth.ok && auth.backend === "sqlite") {
            useSqliteRegister = true;
          }
        }
      }
    }

    if (!useSqliteRegister) {
      const auth = await signInMemberWithPasswordServer(supabase, email, password);
      if (!auth.ok) {
        if (action === "register" && auth.status === 401) {
          return NextResponse.json(
            { error: "注册成功，请查收确认邮件后再登录。" },
            { status: 403 },
          );
        }
        return NextResponse.json({ error: auth.error }, { status: auth.status });
      }

      if (auth.backend === "supabase") {
        return jsonResponseWithCookies(
          {
            ok: true,
            user: auth.user,
          },
          cookieRes,
        );
      }

      useSqliteRegister = true;
    }

    if (!useSqliteRegister) {
      return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
    }
  }

  const dbPath = getAskbibleAuthSqlitePath();
  if (!dbPath) return missingSqliteResponse();

  if (action === "register") {
    const flags = readMobileContentFlagsSync(process.cwd()).flags;
    if (!flags.memberRegisterEnabled) {
      return NextResponse.json({ error: "会员注册尚未开放。" }, { status: 503 });
    }
    const reg = await registerAskbibleSqliteUser({ dbPath, email, password, name });
    if (!reg.ok) {
      return NextResponse.json({ error: reg.error }, { status: reg.status });
    }
  }

  const auth = await verifyAskbibleUserCredentials(dbPath, email, password);
  if (!auth.ok) {
    return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
  }

  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const token = await signAskbibleUserSessionCookie({
    v: 1,
    sub: auth.userId,
    email: auth.email,
    name: auth.name,
    exp,
  });
  const res = NextResponse.json({
    ok: true,
    user: { id: auth.userId, email: auth.email, name: auth.name },
  });
  const secure = authCookieSecure(req);
  res.cookies.set(ASKBIBLE_USER_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

export async function DELETE(req: Request) {
  if (isSupabaseAuthConfigured()) {
    const res = NextResponse.json({ ok: true });
    const supabase = await createSupabaseServerClient(res);
    if (!supabase) return NextResponse.json({ error: "Supabase auth not configured" }, { status: 503 });
    await supabase.auth.signOut();
    return res;
  }

  const secure = authCookieSecure(req);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ASKBIBLE_USER_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  });
  return res;
}
