import { NextResponse } from "next/server";
import { getAskbibleAuthSqlitePath } from "@/lib/admin-askbible-path";
import { getAskbibleUserById } from "@/lib/askbible-user-sqlite";
import { parseAskbibleUserSessionCookie } from "@/lib/askbible-user-session";

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
  const dbPath = getAskbibleAuthSqlitePath();
  if (!dbPath) {
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

  const token = readSessionToken(req);
  const session = await parseAskbibleUserSessionCookie(token);
  if (!session) {
    return NextResponse.json({
      ok: true,
      schemaVersion: SCHEMA_VERSION,
      configured: true,
      user: null,
    });
  }

  const user = await getAskbibleUserById(dbPath, session.sub);
  if (!user) {
    return NextResponse.json({
      ok: true,
      schemaVersion: SCHEMA_VERSION,
      configured: true,
      user: null,
    });
  }

  return NextResponse.json({
    ok: true,
    schemaVersion: SCHEMA_VERSION,
    configured: true,
    user,
  });
}
