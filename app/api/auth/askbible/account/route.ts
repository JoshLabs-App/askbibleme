import { NextResponse } from "next/server";
import { readMobileContentFlagsSync } from "@/lib/admin/mobile-content-flags-store";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteAskbibleSupabaseUser } from "@/lib/askbible-supabase-auth";

export const runtime = "nodejs";

export async function DELETE() {
  const flags = readMobileContentFlagsSync(process.cwd()).flags;
  if (!flags.memberRegisterEnabled) {
    return NextResponse.json(
      { ok: false, error: "会员账号功能尚未开放。", code: "auth_disabled" },
      { status: 503 },
    );
  }

  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Supabase auth not configured", code: "auth_not_configured" },
      { status: 503 },
    );
  }

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
