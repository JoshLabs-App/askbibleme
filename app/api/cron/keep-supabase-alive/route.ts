import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Vercel Cron（见 vercel.json）每天调用一次，给共享 Supabase 项目（JoshLabs）产生一次真实
 * Auth API 请求，避免免费版因 7 天无活动被自动暂停。
 */
export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  }

  const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ ok: true, pingedAt: new Date().toISOString() });
}
