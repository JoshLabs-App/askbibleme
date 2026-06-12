import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAskbibleAuthSqlitePath } from "@/lib/admin-askbible-path";
import { deleteAskbibleSqliteUser } from "@/lib/askbible-user-sqlite";
import {
  ASKBIBLE_USER_SESSION_COOKIE,
  parseAskbibleUserSessionCookie,
} from "@/lib/askbible-user-session";
import { authCookieSecure } from "@/lib/auth-cookie-secure";
import { readMobileContentFlagsSync } from "@/lib/admin/mobile-content-flags-store";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteAskbibleSupabaseUser } from "@/lib/askbible-supabase-auth";

export const runtime = "nodejs";

function missingSqliteResponse() {
  return NextResponse.json(
    { ok: false, error: "AskBible sqlite auth not configured", code: "auth_not_configured" },
    { status: 503 },
  );
}

export async function DELETE(req: Request) {
  const flags = readMobileContentFlagsSync(process.cwd()).flags;
  if (!flags.memberRegisterEnabled) {
    return NextResponse.json(
      { ok: false, error: "会员账号功能尚未开放。", code: "auth_disabled" },
      { status: 503 },
    );
  }

  if (isSupabaseAuthConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        { ok: false, error: "Supabase auth not configured", code: "auth_not_configured" },
        { status: 503 },
      );
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return NextResponse.json({ ok: false, error: "请先登录。", code: "unauthorized" }, { status: 401 });
    }

    const deleted = await deleteAskbibleSupabaseUser(data.user.id);
    if (!deleted.ok) {
      return NextResponse.json(
        { ok: false, error: deleted.error, code: deleted.code },
        { status: deleted.status },
      );
    }

    const res = NextResponse.json({ ok: true });
    const signOutClient = await createSupabaseServerClient(res);
    await signOutClient?.auth.signOut();
    return res;
  }

  const dbPath = getAskbibleAuthSqlitePath();
  if (!dbPath) return missingSqliteResponse();

  const store = await cookies();
  const sessionCookie = store.get(ASKBIBLE_USER_SESSION_COOKIE)?.value;
  const session = await parseAskbibleUserSessionCookie(sessionCookie);
  if (!session) {
    return NextResponse.json({ ok: false, error: "请先登录。", code: "unauthorized" }, { status: 401 });
  }

  const deleted = await deleteAskbibleSqliteUser({ dbPath, userId: session.sub });
  if (!deleted.ok) {
    return NextResponse.json(
      { ok: false, error: deleted.error, code: deleted.code },
      { status: deleted.status },
    );
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
