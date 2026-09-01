import { NextResponse } from "next/server";
import { readMobileContentFlagsSync } from "@/lib/admin/mobile-content-flags-store";
import { signInMemberWithPasswordServer } from "@/lib/member-auth-backend";
import { jsonResponseWithCookies } from "@/lib/next-response-cookies";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchAskbibleProfile,
  toAskbibleAuthUser,
  upsertAskbibleProfile,
} from "@/lib/askbible-supabase-auth";

export const runtime = "nodejs";

function readString(o: Record<string, unknown>, key: string): string {
  const v = o[key];
  return typeof v === "string" ? v.trim() : "";
}

export async function GET() {
  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json({ configured: false, user: null });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ configured: false, user: null });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return NextResponse.json({ configured: true, user: null });
  }

  const profile = await fetchAskbibleProfile(supabase, data.user.id);
  const user = toAskbibleAuthUser(data.user, profile);
  return NextResponse.json({
    configured: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    },
    isAdmin: user.isAdmin,
  });
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

  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json({ error: "Supabase auth not configured" }, { status: 503 });
  }

  const cookieRes = NextResponse.json({ ok: false });
  const supabase = await createSupabaseServerClient(cookieRes);
  if (!supabase) {
    return NextResponse.json({ error: "Supabase auth not configured" }, { status: 503 });
  }

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
      const status = /already registered|already exists/i.test(msg) ? 409 : 400;
      return NextResponse.json({ error: msg }, { status });
    }

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
      if (auth.ok) {
        return jsonResponseWithCookies({ ok: true, user: auth.user }, cookieRes);
      }
    }
  }

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

  return jsonResponseWithCookies({ ok: true, user: auth.user }, cookieRes);
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  if (isSupabaseAuthConfigured()) {
    const supabase = await createSupabaseServerClient(res);
    if (!supabase) return NextResponse.json({ error: "Supabase auth not configured" }, { status: 503 });
    await supabase.auth.signOut();
  }
  return res;
}
