import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAskbibleAuthSqlitePath } from "@/lib/admin-askbible-path";
import { verifyAskbibleUserCredentials } from "@/lib/admin-askbible-login";
import {
  parseAskbibleSessionCookie,
  signAskbibleSessionCookie,
  USER_ASKBIBLE_SESSION_COOKIE,
} from "@/lib/admin-askbible-session";
import { authCookieSecure } from "@/lib/auth-cookie-secure";

const USER_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;

export type AskbibleAuthMeUser = { id: string; email: string; name: string };

/**
 * GET：是否可读旧站库 + 当前前台用户会话（HttpOnly cookie）。
 * POST：邮箱+密码（与 AskBible `users` 表一致，不要求管理员）。
 * DELETE：登出并清除 `selah_user_askbible`。
 */
export async function GET() {
  const dbPath = getAskbibleAuthSqlitePath();
  const configured = Boolean(dbPath);
  const raw = (await cookies()).get(USER_ASKBIBLE_SESSION_COOKIE)?.value;
  const payload = await parseAskbibleSessionCookie(raw);
  const user: AskbibleAuthMeUser | null = payload
    ? {
        id: payload.sub,
        email: payload.email,
        name: (payload.name && String(payload.name).trim()) || payload.email,
      }
    : null;
  return NextResponse.json({ configured, user });
}

export async function POST(req: Request) {
  const dbPath = getAskbibleAuthSqlitePath();
  if (!dbPath) {
    return NextResponse.json({ error: "AskBible auth.sqlite not configured on server" }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const email = typeof o.email === "string" ? o.email.trim() : "";
  const password = typeof o.password === "string" ? o.password : "";
  if (!email || !password) {
    return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
  }

  const auth = await verifyAskbibleUserCredentials(dbPath, email, password);
  if (!auth.ok) {
    return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
  }

  const exp = Date.now() + USER_SESSION_MAX_AGE_SEC * 1000;
  const token = await signAskbibleSessionCookie({
    v: 1,
    sub: auth.userId,
    email: auth.email,
    name: auth.name,
    exp,
  });
  const res = NextResponse.json({
    ok: true,
    user: { id: auth.userId, email: auth.email, name: auth.name } satisfies AskbibleAuthMeUser,
  });
  const secure = authCookieSecure(req);
  res.cookies.set(USER_ASKBIBLE_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: USER_SESSION_MAX_AGE_SEC,
  });
  return res;
}

export async function DELETE(req: Request) {
  const secure = authCookieSecure(req);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(USER_ASKBIBLE_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  });
  return res;
}
