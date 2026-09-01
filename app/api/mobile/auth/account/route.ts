import { NextResponse } from "next/server";
import { readMobileContentFlagsSync } from "@/lib/admin/mobile-content-flags-store";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import {
  deleteAskbibleSupabaseUser,
  getAskbibleUserFromAccessToken,
  isLikelySupabaseAccessToken,
} from "@/lib/askbible-supabase-auth";

export const runtime = "nodejs";

const SCHEMA_VERSION = 1;

function readSessionToken(req: Request): string {
  const auth = req.headers.get("authorization")?.trim() ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return req.headers.get("x-askbible-session")?.trim() ?? "";
}

export async function DELETE(req: Request) {
  const flags = readMobileContentFlagsSync(process.cwd()).flags;
  if (!flags.memberRegisterEnabled) {
    return NextResponse.json(
      {
        ok: false,
        schemaVersion: SCHEMA_VERSION,
        error: "会员账号功能尚未开放。",
        code: "auth_disabled",
      },
      { status: 503 },
    );
  }

  const token = readSessionToken(req);
  if (!token || !isSupabaseAuthConfigured() || !isLikelySupabaseAccessToken(token)) {
    return NextResponse.json(
      {
        ok: false,
        schemaVersion: SCHEMA_VERSION,
        error: "请先登录。",
        code: "unauthorized",
      },
      { status: 401 },
    );
  }

  const user = await getAskbibleUserFromAccessToken(token);
  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        schemaVersion: SCHEMA_VERSION,
        error: "请先登录。",
        code: "unauthorized",
      },
      { status: 401 },
    );
  }

  const deleted = await deleteAskbibleSupabaseUser(user.id);
  if (!deleted.ok) {
    return NextResponse.json(
      {
        ok: false,
        schemaVersion: SCHEMA_VERSION,
        error: deleted.error,
        code: deleted.code,
      },
      { status: deleted.status },
    );
  }

  return NextResponse.json({
    ok: true,
    schemaVersion: SCHEMA_VERSION,
  });
}
