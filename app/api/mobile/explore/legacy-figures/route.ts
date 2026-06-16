import { NextResponse } from "next/server";
import { readLegacyFiguresMobileBundleSync } from "@/lib/explore/legacy-figures-mobile-bundle-store";

export const runtime = "nodejs";

export async function GET() {
  const bundle = readLegacyFiguresMobileBundleSync(process.cwd());
  if (!bundle) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const etag = bundle.contentVersion?.trim() || `v${bundle.profiles.length}`;
  return NextResponse.json(bundle, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      ETag: `"${etag}"`,
    },
  });
}
