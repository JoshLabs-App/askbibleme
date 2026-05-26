import { NextResponse } from "next/server";
import { readMobileContentFlagsSync } from "@/lib/admin/mobile-content-flags-store";

export const runtime = "nodejs";

const SCHEMA_VERSION = 1;

export async function GET() {
  const file = readMobileContentFlagsSync(process.cwd());
  const payload = {
    ok: true,
    schemaVersion: SCHEMA_VERSION,
    flags: file.flags,
    updatedAt: file.updatedAt,
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" },
  });
}
