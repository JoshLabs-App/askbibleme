import { NextResponse } from "next/server";
import { readExploreModulesBundleSync } from "@/lib/explore/explore-modules-bundle-store";

export const runtime = "nodejs";

export async function GET() {
  const bundle = readExploreModulesBundleSync(process.cwd());
  if (!bundle) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const etag = bundle.contentVersion?.trim() || "v1";
  return NextResponse.json(bundle, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      ETag: `"${etag}"`,
    },
  });
}
