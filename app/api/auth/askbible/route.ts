import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAskbibleAuthSqlitePath } from "@/lib/admin-askbible-path";
import { verifyAskbibleUserCredentials } from "@/lib/admin-askbible-login";
import {
  getLegacyUserLoginUrl,
  isLegacyRemoteUserAuthConfigured,
  postLegacyAskbibleLogin,
} from "@/lib/askbible-legacy-remote-login";
import {
  parseAskbibleSessionCookie,
  signAskbibleSessionCookie,
  USER_ASKBIBLE_SESSION_COOKIE,
} from "@/lib/admin-askbible-session";
import { authCookieSecure } from "@/lib/auth-cookie-secure";

const USER_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;

export type AskbibleAuthMeUser = { id: string; email: string; name: string };

/**
 * GET：是否已配置旧站远程或 sqlite + 当前前台用户会话（HttpOnly cookie）。
 * POST：邮箱+密码 — 优先 POST 到 `ASKBIBLE_LEGACY_*` 旧站接口；否则读本地 auth.sqlite。
 * DELETE：登出并清除 `selah_user_askbible`。
 */
export async function GET() {
  const dbPath = getAskbibleAuthSqlitePath();
  const configured = Boolean(dbPath) || isLegacyRemoteUserAuthConfigured();
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

  const legacyUrl = getLegacyUserLoginUrl();
  let auth: { userId: string; email: string; name: string };

  if (legacyUrl) {
    const remote = await postLegacyAskbibleLogin(legacyUrl, email, password, "user");
    if (!remote.ok) {
      return NextResponse.json(
        { error: remote.error || "Wrong email or password" },
        { status: remote.status >= 400 && remote.status < 600 ? remote.status : 502 },
      );
    }
    auth = { userId: remote.userId, email: remote.email, name: remote.name };
  } else {
    const dbPath = getAskbibleAuthSqlitePath();
    if (!dbPath) {
      return NextResponse.json(
        { error: "AskBible auth not configured (no legacy URL and no auth.sqlite)" },
        { status: 503 },
      );
    }
    const local = await verifyAskbibleUserCredentials(dbPath, email, password);
    if (!local.ok) {
      return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
    }
    auth = { userId: local.userId, email: local.email, name: local.name };
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
