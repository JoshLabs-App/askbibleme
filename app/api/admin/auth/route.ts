import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  getLegacyAdminLoginUrl,
  isLegacyRemoteAdminAuthConfigured,
  postLegacyAskbibleLogin,
} from "@/lib/askbible-legacy-remote-login";
import {
  ADMIN_ASKBIBLE_SESSION_COOKIE,
  signAskbibleSessionCookie,
} from "@/lib/admin-askbible-session";
import {
  ADMIN_GATE_COOKIE,
  computeAdminGateToken,
  getAdminPassword,
} from "@/lib/admin-gate";
import { authCookieSecure } from "@/lib/auth-cookie-secure";
import { isSelahSuperAdminEmail } from "@/lib/selah-super-admin";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { createSupabaseMobileAuthClient } from "@/lib/supabase/mobile-server";
import { fetchAskbibleProfile } from "@/lib/askbible-supabase-auth";

function timingSafeEqualUtf8(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** 登录页用：是否可走 Supabase / 工作室口令 */
export async function GET() {
  return NextResponse.json({
    askbible: Boolean(isSupabaseAuthConfigured() || isLegacyRemoteAdminAuthConfigured()),
  });
}

/**
 * 登录优先级：
 * 1) 若请求体含 `email`：优先 POST 到旧站 `ASKBIBLE_LEGACY_*` 管理登录 URL（由旧站校验）；否则走 Supabase：`is_admin=1` 或固定超级管理员邮箱。
 * 2) 否则：工作室单口令 → `selah_admin_gate`。
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const emailRaw = typeof o.email === "string" ? o.email.trim() : "";
  const password = typeof o.password === "string" ? o.password : "";

  const legacyAdminUrl = getLegacyAdminLoginUrl();
  if (emailRaw && legacyAdminUrl) {
    const remote = await postLegacyAskbibleLogin(legacyAdminUrl, emailRaw, password, "admin");
    if (remote.ok) {
      const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
      const token = await signAskbibleSessionCookie({
        v: 1,
        sub: remote.userId,
        email: remote.email,
        exp,
      });
      const res = NextResponse.json({ ok: true, mode: "askbible-legacy" });
      const secure = authCookieSecure(req);
      res.cookies.set(ADMIN_ASKBIBLE_SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure,
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
      return res;
    }
    return NextResponse.json(
      { error: remote.error || "Wrong email or password" },
      { status: remote.status >= 400 && remote.status < 600 ? remote.status : 502 },
    );
  }

  if (isSupabaseAuthConfigured() && emailRaw) {
    const supabase = createSupabaseMobileAuthClient();
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailRaw,
        password,
      });
      if (!error && data.user) {
        const profile = await fetchAskbibleProfile(supabase, data.user.id);
        const isAdmin = Boolean(profile?.is_admin) || isSelahSuperAdminEmail(emailRaw);
        if (isAdmin) {
          const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
          const token = await signAskbibleSessionCookie({
            v: 1,
            sub: data.user.id,
            email: data.user.email || emailRaw,
            exp,
          });
          const res = NextResponse.json({ ok: true, mode: "askbible-supabase" });
          const secure = authCookieSecure(req);
          res.cookies.set(ADMIN_ASKBIBLE_SESSION_COOKIE, token, {
            httpOnly: true,
            sameSite: "lax",
            secure,
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
          });
          return res;
        }
      }
    }
  }

  if (emailRaw) {
    return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
  }

  if (!timingSafeEqualUtf8(password, getAdminPassword())) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const token = await computeAdminGateToken();
  const res = NextResponse.json({ ok: true, mode: "legacy" });
  const secure = authCookieSecure(req);
  res.cookies.set(ADMIN_GATE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

export async function DELETE(req: Request) {
  const secure = authCookieSecure(req);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_GATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  });
  res.cookies.set(ADMIN_ASKBIBLE_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  });
  return res;
}
