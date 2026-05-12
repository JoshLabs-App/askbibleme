import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
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

/** 登录设 cookie；登出清 cookie。已启用 Supabase 时关闭此路径（请用账号登录）。 */
export async function POST(req: Request) {
  if (isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase auth enabled; use email sign-in on /admin/login." },
      { status: 410 },
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const password = typeof body === "object" && body !== null && "password" in body ? String((body as { password: unknown }).password) : "";
  if (!timingSafeEqualUtf8(password, getAdminPassword())) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const token = await computeAdminGateToken();
  const res = NextResponse.json({ ok: true });
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
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_GATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: adminCookieSecure(req),
    path: "/",
    maxAge: 0,
  });
  return res;
}
