import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const okHeaders = {
  "content-type": "text/plain; charset=utf-8",
  "cache-control": "no-store, max-age=0, must-revalidate",
} as const;

export function GET() {
  return new NextResponse("ok", { status: 200, headers: okHeaders });
}

export function HEAD() {
  return new NextResponse(null, { status: 200, headers: okHeaders });
}
