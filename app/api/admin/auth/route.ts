import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getAskbibleAuthSqlitePath } from "@/lib/admin-askbible-path";
import { verifyAskbibleAdminCredentials } from "@/lib/admin-askbible-login";
import {
  ADMIN_ASKBIBLE_SESSION_COOKIE,
  signAskbibleSessionCookie,
} from "@/lib/admin-askbible-session";
import {
  ADMIN_GATE_COOKIE,
  computeAdminGateToken,
  getAdminPassword,
} from "@/lib/admin-gate";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** 反向代理后须看 `x-forwarded-proto`；勿仅用 NODE_ENV，否则线上偶发无法种下 Secure cookie。 */
function adminCookieSecure(req: Request): boolean {
  const fwd = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (fwd === "https") return true;
  if (fwd === "http") return false;
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}

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

/** 登录页用：是否可走 AskBible 库 / Supabase / 工作室口令 */
export async function GET() {
  return NextResponse.json({
    askbible: Boolean(getAskbibleAuthSqlitePath()),
    supabase: isSupabaseConfigured(),
  });
}

/**
 * 登录优先级：
 * 1) 若存在 AskBible `auth.sqlite` 且请求体含 `email`：邮箱+密码 + `is_admin=1`（与旧站相同库即可复用）。
 * 2) 否则若已配 Supabase：本接口不接受工作室口令（请用 Supabase 登录页）。
 * 3) 否则：工作室单口令 → `selah_admin_gate`。
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

  const dbPath = getAskbibleAuthSqlitePath();
  if (dbPath && emailRaw) {
    const auth = await verifyAskbibleAdminCredentials(dbPath, emailRaw, password);
    if (!auth.ok) {
      return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
    }
    const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const token = await signAskbibleSessionCookie({ v: 1, sub: auth.userId, email: auth.email, exp });
    const res = NextResponse.json({ ok: true, mode: "askbible" });
    const secure = adminCookieSecure(req);
    res.cookies.set(ADMIN_ASKBIBLE_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  }

  if (isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase auth enabled; use email sign-in on /admin/login." },
      { status: 410 },
    );
  }

  if (!timingSafeEqualUtf8(password, getAdminPassword())) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const token = await computeAdminGateToken();
  const res = NextResponse.json({ ok: true, mode: "legacy" });
  const secure = adminCookieSecure(req);
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
  const secure = adminCookieSecure(req);
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
