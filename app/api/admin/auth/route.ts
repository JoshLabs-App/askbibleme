import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  ADMIN_GATE_COOKIE,
  computeAdminGateToken,
  getAdminPassword,
} from "@/lib/admin-gate";

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

/** 登录设 cookie；登出清 cookie。 */
export async function POST(req: Request) {
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
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set(ADMIN_GATE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_GATE_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return res;
}
