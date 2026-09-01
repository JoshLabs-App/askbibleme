import { NextResponse } from "next/server";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import {
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

export async function GET(req: Request) {
  const token = readSessionToken(req);

  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        schemaVersion: SCHEMA_VERSION,
        configured: false,
        user: null,
      },
      { status: 503 },
    );
  }

  if (!token || !isLikelySupabaseAccessToken(token)) {
    return NextResponse.json({
      ok: true,
      schemaVersion: SCHEMA_VERSION,
      configured: true,
      user: null,
    });
  }

  const user = await getAskbibleUserFromAccessToken(token);
  return NextResponse.json({
    ok: true,
    schemaVersion: SCHEMA_VERSION,
    configured: true,
    user: user
      ? { id: user.id, email: user.email, name: user.name, locale: user.locale }
      : null,
  });
}
